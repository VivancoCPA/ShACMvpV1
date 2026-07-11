import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useForzarVencimientoVerificacion } from './useForzarVencimientoVerificacion'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

describe('useForzarVencimientoVerificacion', () => {
  it('persists auditorAsignadoId when forcing from CERRADO', async () => {
    const { result } = renderHook(() => useForzarVencimientoVerificacion(), {
      wrapper: createWrapper(),
    })

    // qe-2026-009 is CERRADO in the fixtures
    result.current.mutate({ id: 'qe-2026-009', auditorAsignadoId: 'user-004' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.estado).toBe('EN_VERIFICACION')
    expect(result.current.data?.auditorAsignadoId).toBe('user-004')
  })

  it('does not touch auditorAsignadoId when forcing timeout from EN_VERIFICACION', async () => {
    const { result } = renderHook(() => useForzarVencimientoVerificacion(), {
      wrapper: createWrapper(),
    })

    // qe-2026-008 is EN_VERIFICACION with auditorAsignadoId: 'user-auditor-001' in the fixtures
    result.current.mutate({ id: 'qe-2026-008' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.estado).not.toBe('EN_VERIFICACION')
    expect(result.current.data?.auditorAsignadoId).toBe('user-auditor-001')
  })
})
