import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import { useForzarVencimientoVerificacion } from './useForzarVencimientoVerificacion'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const server = setupServer(...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// qe-2026-008/009 fixtures belong to empresa-001 — el handler ahora filtra por
// empresa activa de sesión (me-f3-scoping-modulos).
beforeEach(() => {
  useAuthStore.setState({ empresaActivaId: 'empresa-001' })
})
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
