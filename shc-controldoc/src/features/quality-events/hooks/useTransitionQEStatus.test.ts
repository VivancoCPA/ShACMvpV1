import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useTransitionQEStatus } from './useTransitionQEStatus'

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
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
})
