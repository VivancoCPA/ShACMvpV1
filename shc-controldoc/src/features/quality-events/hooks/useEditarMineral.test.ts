import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import type { User } from '../../../types/auth.types'
import { useEditarMineral } from './useEditarMineral'

const server = setupServer(...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ user: null, isAuthenticated: false })
})
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function loginAs(user: User) {
  useAuthStore.setState({ user, isAuthenticated: true })
}

describe('PATCH /api/quality-events/:id/editar-mineral', () => {
  it('returns 404 for an unknown id', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarMineral(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'does-not-exist', data: { mineralInvolucrado: 'Zinc' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request on a SST-tipo QE', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarMineral(), { wrapper: createWrapper() })
    // qe-2026-001 is tipo SST
    result.current.mutate({ id: 'qe-2026-001', data: { mineralInvolucrado: 'Zinc' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request from a non-JEFE_CALIDAD_SYST user', async () => {
    loginAs({ id: 'user-004', nombre: 'Ana', apellido: 'Torres', email: 'a@shac.internal', rol: 'AUDITOR_INTERNO', area: 'Auditoría' })
    const { result } = renderHook(() => useEditarMineral(), { wrapper: createWrapper() })
    // qe-2026-002 is tipo CALIDAD, EN_EJECUCION
    result.current.mutate({ id: 'qe-2026-002', data: { mineralInvolucrado: 'Zinc' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('updates mineralInvolucrado and appends an audit entry for a valid request', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarMineral(), { wrapper: createWrapper() })
    // qe-2026-002 is tipo CALIDAD, EN_EJECUCION
    result.current.mutate({ id: 'qe-2026-002', data: { mineralInvolucrado: 'Zinc' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.mineralInvolucrado).toBe('Zinc')
    const entries = result.current.data?.auditTrail.filter((e) => e.accion === 'QE_MINERAL_EDITADO')
    expect(entries).toHaveLength(1)
  })
})
