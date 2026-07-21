import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useTransitionQEStatus } from './useTransitionQEStatus'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const server = setupServer(...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function createWrapper(queryClient: QueryClient = createQueryClient()) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useTransitionQEStatus', () => {
  it('calls toast.error with RN-QE-002 message when transitioning qe-2026-007 to EN_EJECUCION', async () => {
    const { toast } = await import('sonner')
    const { result } = renderHook(() => useTransitionQEStatus(), {
      wrapper: createWrapper(),
    })

    // qe-2026-007 is ANALISIS_COMPLETADO with causaRaizFirmadaEn ausente
    result.current.mutate({ id: 'qe-2026-007', data: { nuevoEstado: 'EN_EJECUCION' } })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('RN-QE-002')
    )
  })

  it('invalidates both the Incidente detail and list queries of the linked incidente on transition', async () => {
    // qe-2026-005 is REABIERTO with incidenteId 'inc-001' — no extra guard blocks this transition.
    const queryClient = createQueryClient()
    const detailKey = INCIDENT_QUERY_KEYS.detail('inc-001')
    const listKey = INCIDENT_QUERY_KEYS.list({})
    queryClient.setQueryData(detailKey, { id: 'inc-001', estado: 'REABIERTO' })
    queryClient.setQueryData(listKey, { items: [{ id: 'inc-001', estado: 'REABIERTO' }] })

    const { result } = renderHook(() => useTransitionQEStatus(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ id: 'qe-2026-005', data: { nuevoEstado: 'EN_INVESTIGACION' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })
})
