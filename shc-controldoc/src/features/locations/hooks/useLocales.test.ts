// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { localesHandlers } from '../../../mocks/handlers/locales.handlers'
import {
  LOCATION_ADMIN_QUERY_KEYS,
  useLocales,
  useCrearLocal,
  useDesactivarLocal,
  useDesactivarZona,
  useCrearZona,
  useZonas,
  useReactivarLocal,
  useReactivarZona,
} from './useLocales'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const server = setupServer(...localesHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useCrearLocal', () => {
  it('invalida el listado tras crear un local exitosamente', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCrearLocal(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({ nombre: 'Local de Prueba', direccion: 'Av. Siempre Viva 123' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: LOCATION_ADMIN_QUERY_KEYS.list }),
    )
  })
})

describe('useDesactivarLocal', () => {
  it('muestra toast.error con el mensaje del backend cuando hay incidentes bloqueantes', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    // loc-001 tiene incidentes ABIERTO/EN_INVESTIGACION en incidentFixtures (RN-LOC-002)
    const { result } = renderHook(() => useDesactivarLocal(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate('loc-001')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/incidentes/i),
    )
    expect(result.current.error).toBeDefined()
  })
})

describe('useZonas', () => {
  it('devuelve zonas de todos los locales, incluyendo inactivas', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { result: crearResult } = renderHook(() => useCrearZona(), { wrapper: makeWrapper(qc) })
    await act(async () => {
      crearResult.current.mutate({ localId: 'loc-002', data: { nombre: 'Zona sin incidentes' } })
    })
    await waitFor(() => expect(crearResult.current.isSuccess).toBe(true))
    const nuevaZonaId = crearResult.current.data?.id
    if (!nuevaZonaId) throw new Error('crearZona no devolvió id')

    const { result: desactivarResult } = renderHook(() => useDesactivarZona(), {
      wrapper: makeWrapper(qc),
    })
    await act(async () => {
      desactivarResult.current.mutate(nuevaZonaId)
    })
    await waitFor(() => expect(desactivarResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useZonas(), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const localIds = new Set(result.current.data?.map((z) => z.localId))
    expect(localIds.has('loc-001')).toBe(true)
    expect(localIds.has('loc-002')).toBe(true)
    expect(
      result.current.data?.some((z) => z.id === nuevaZonaId && z.activo === false),
    ).toBe(true)
  })
})

describe('useReactivarLocal', () => {
  it('muestra toast.error con el mensaje del backend cuando ya existen 5 locales activos (RN-LOC-001)', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { result: listResult } = renderHook(() => useLocales(), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))
    const activosActuales = listResult.current.data?.filter((l) => l.activo).length ?? 0
    const faltantes = Math.max(0, 5 - activosActuales)

    const { result: crearResult } = renderHook(() => useCrearLocal(), { wrapper: makeWrapper(qc) })
    for (let i = 0; i < faltantes; i++) {
      await act(async () => {
        crearResult.current.mutate({ nombre: `Local Extra ${i}`, direccion: 'Av. Prueba 1' })
      })
      await waitFor(() => expect(crearResult.current.isSuccess).toBe(true))
      crearResult.current.reset()
    }

    const { result } = renderHook(() => useReactivarLocal(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate('loc-003')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/5 locales activos/i))
  })
})

describe('useReactivarZona', () => {
  it('no invoca toast.error cuando la reactivación es exitosa', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { result } = renderHook(() => useReactivarZona(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate('zon-005')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { toast } = await import('sonner')
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('useCrearZona', () => {
  it('invalida el detalle del local padre tras crear una zona', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCrearZona(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({ localId: 'loc-002', data: { nombre: 'Zona de Prueba' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail('loc-002') }),
    )
  })
})
