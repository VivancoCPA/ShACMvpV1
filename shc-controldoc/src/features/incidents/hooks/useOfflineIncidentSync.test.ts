import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import React from 'react'
import { useOfflineIncidentSync } from './useOfflineIncidentSync'
import { enqueue, listPending, getById, markRetryPending, clearAll, type EnqueueInput } from '../../../lib/offlineQueue'
import { useAuthStore } from '../../../stores/authStore'
import { useOfflineQueueStore, notifyIncidentEnqueued } from '../stores/offlineQueueStore'

const mutateAsyncMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Errores axios sintéticos para ejercitar `classifySubmitError` (m7-f3-hardening
// design.md D1) sin depender de una request real — mismo criterio que usa
// `classifySubmitError.test.ts`: `isAxiosError` de axios solo exige
// `isAxiosError: true` en el objeto.
function makeAxiosNetworkError(): Error {
  return Object.assign(new Error('network down'), { isAxiosError: true, code: 'ERR_NETWORK' })
}

function makeAxiosServerError(status = 422): Error {
  return Object.assign(new Error('validation failed'), {
    isAxiosError: true,
    response: { status, data: {} },
  })
}

function makeAxiosEnvelopeError(): Error {
  return Object.assign(new Error('invalid envelope'), { isAxiosError: true, code: 'ERR_INVALID_RESPONSE_ENVELOPE' })
}

vi.mock('./useIncidents', () => ({
  useCreateIncidentOfflineSync: () => ({ mutateAsync: mutateAsyncMock }),
}))

function buildEnqueueInput(overrides: Partial<EnqueueInput> = {}): EnqueueInput {
  return {
    payload: {
      tipo: 'INCIDENTE',
      descripcion: 'Descripción de prueba con al menos veinte caracteres',
      areaId: 'area-001',
      turno: 'DIA',
      fechaEvento: '2026-01-01T00:00:00.000Z',
      huboLesionados: false,
    },
    photoBlobs: [],
    empresaId: 'empresa-001',
    ...overrides,
  }
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

beforeEach(async () => {
  await clearAll()
  mutateAsyncMock.mockReset()
  useAuthStore.setState({ user: { id: 'user-1' } as never })
  useOfflineQueueStore.setState({ items: [], pendingCount: 0, syncingId: null, hasErrors: false })
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useOfflineIncidentSync', () => {
  it('sincroniza los reportes pendientes en orden FIFO al montar (online)', async () => {
    const first = await enqueue(buildEnqueueInput())
    const second = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockResolvedValue({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => expect(await listPending()).toHaveLength(0))
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2)

    const firstCallOrder = mutateAsyncMock.mock.invocationCallOrder[0]
    const secondCallOrder = mutateAsyncMock.mock.invocationCallOrder[1]
    expect(firstCallOrder).toBeLessThan(secondCallOrder)
    expect(first).toBeLessThan(second)
  })

  it('un reporte que falla se marca en error y no bloquea al siguiente', async () => {
    await enqueue(buildEnqueueInput())
    await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(new Error('fallo de validación')).mockResolvedValueOnce({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const pending = await listPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].status).toBe('error')
    })
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2)
  })

  it('retry vuelve a poner en pending y re-sincroniza un reporte en error', async () => {
    await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(new Error('fallo de red'))

    const { result } = renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const [entry] = await listPending()
      expect(entry?.status).toBe('error')
    })
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inc-x' })

    const [errored] = await listPending()
    await act(async () => {
      await result.current.retry(errored.localId)
    })

    await waitFor(async () => expect(await listPending()).toHaveLength(0))
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2)
  })

  it('el store refleja la cantidad de reportes pending + error al montar el hook', async () => {
    mutateAsyncMock.mockImplementation(() => new Promise(() => {})) // nunca resuelve, mantiene la cola ocupada
    await enqueue(buildEnqueueInput())
    await enqueue(buildEnqueueInput())

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(useOfflineQueueStore.getState().pendingCount).toBeGreaterThan(0))
  })

  it('no deja listeners duplicados si el hook se desmonta y se vuelve a montar', async () => {
    mutateAsyncMock.mockResolvedValue({ id: 'inc-x' })
    const { unmount } = renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })
    unmount()

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })
    await enqueue(buildEnqueueInput())
    window.dispatchEvent(new Event('online'))

    await waitFor(async () => expect(await listPending()).toHaveLength(0))
    // Si hubiera dos instancias activas del ciclo de sync, el mismo reporte
    // se enviaría dos veces (una por cada listener `online` suscrito).
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('registra un syncTrigger en el store al montar y lo limpia al desmontar', async () => {
    const { unmount } = renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(useOfflineQueueStore.getState().syncTrigger).not.toBeNull())

    unmount()
    expect(useOfflineQueueStore.getState().syncTrigger).toBeNull()
  })

  it('notifyIncidentEnqueued() dispara el ciclo de sync registrado por el hook sin invocarlo de nuevo', async () => {
    mutateAsyncMock.mockResolvedValue({ id: 'inc-x' })
    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })
    await waitFor(() => expect(useOfflineQueueStore.getState().syncTrigger).not.toBeNull())

    await enqueue(buildEnqueueInput())
    await act(async () => {
      await notifyIncidentEnqueued()
    })

    await waitFor(async () => expect(await listPending()).toHaveLength(0))
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('un fallo de red con retryCount < 3 vuelve a pending, incrementa retryCount y no muestra toast.error', async () => {
    const localId = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(makeAxiosNetworkError())

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const entry = await getById(localId)
      expect(entry?.status).toBe('pending')
      expect(entry?.retryCount).toBe(1)
    })
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('un fallo de red con retryCount === 3 pasa a error y muestra toast.error', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markRetryPending(localId)
    await markRetryPending(localId)
    await markRetryPending(localId)
    mutateAsyncMock.mockRejectedValueOnce(makeAxiosNetworkError())

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const entry = await getById(localId)
      expect(entry?.status).toBe('error')
    })
    expect(toast.error).toHaveBeenCalled()
  })

  it('un fallo de servidor (4xx) pasa a error de inmediato sin incrementar retryCount', async () => {
    const localId = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(makeAxiosServerError(422))

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const entry = await getById(localId)
      expect(entry?.status).toBe('error')
    })
    const entry = await getById(localId)
    expect(entry?.retryCount).toBe(0)
    expect(toast.error).toHaveBeenCalled()
  })

  it('un fallo ERR_INVALID_RESPONSE_ENVELOPE pasa a error de inmediato, mismo criterio que servidor', async () => {
    const localId = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(makeAxiosEnvelopeError())

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const entry = await getById(localId)
      expect(entry?.status).toBe('error')
    })
    const entry = await getById(localId)
    expect(entry?.retryCount).toBe(0)
  })

  it('un fallo de red que vuelve a pending no bloquea la sincronización del siguiente reporte en el mismo ciclo', async () => {
    const first = await enqueue(buildEnqueueInput())
    const second = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockRejectedValueOnce(makeAxiosNetworkError()).mockResolvedValueOnce({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => {
      const entryFirst = await getById(first)
      expect(entryFirst?.status).toBe('pending')
      expect(entryFirst?.retryCount).toBe(1)
    })
    await waitFor(async () => expect(await getById(second)).toBeUndefined())
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2)
  })

  it('sincroniza propagando el caption de cada foto a descripcion, respetando el índice', async () => {
    const blobs = [new Blob(['foto1'], { type: 'image/jpeg' }), new Blob(['foto2'], { type: 'image/jpeg' })]
    await enqueue(buildEnqueueInput({ photoBlobs: blobs, photoCaptions: ['válvula dañada', undefined] }))
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1))
    const [{ data: payload }] = mutateAsyncMock.mock.calls[0]
    expect(payload.evidencias).toHaveLength(2)
    expect(payload.evidencias[0].descripcion).toBe('válvula dañada')
    expect(payload.evidencias[1].descripcion).toBeUndefined()
  })

  it('sincroniza una entrada sin photoCaptions (encolada antes de este cambio) sin descripcion ni error', async () => {
    const localId = await enqueue(buildEnqueueInput({ photoBlobs: [new Blob(['foto'], { type: 'image/jpeg' })] }))
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1))
    const [{ data: payload }] = mutateAsyncMock.mock.calls[0]
    expect(payload.evidencias).toHaveLength(1)
    expect(payload.evidencias[0].descripcion).toBeUndefined()
    await waitFor(async () => expect(await getById(localId)).toBeUndefined())
  })

  it('una sincronización exitosa elimina la entrada del store en vez de dejarla como synced', async () => {
    const localId = await enqueue(buildEnqueueInput())
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inc-x' })

    renderHook(() => useOfflineIncidentSync(), { wrapper: makeWrapper() })

    await waitFor(async () => expect(await getById(localId)).toBeUndefined())
  })
})
