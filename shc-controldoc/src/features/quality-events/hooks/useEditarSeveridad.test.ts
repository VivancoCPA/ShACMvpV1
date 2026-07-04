import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import type { User } from '../../../types/auth.types'
import { useEditarSeveridad } from './useEditarSeveridad'

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

describe('PATCH /api/quality-events/:id/editar-severidad', () => {
  it('returns 404 for an unknown id', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarSeveridad(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'does-not-exist', data: { severidad: 'ALTA' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request from a non-JEFE_CALIDAD_SYST user', async () => {
    loginAs({ id: 'user-003', nombre: 'María', apellido: 'Castro', email: 'm@shac.internal', rol: 'SUPERVISOR', area: 'Operaciones' })
    const { result } = renderHook(() => useEditarSeveridad(), { wrapper: createWrapper() })
    // qe-2026-001 is EN_INVESTIGACION
    result.current.mutate({ id: 'qe-2026-001', data: { severidad: 'ALTA' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request on a CERRADO QE', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarSeveridad(), { wrapper: createWrapper() })
    // qe-2026-009 is CERRADO
    result.current.mutate({ id: 'qe-2026-009', data: { severidad: 'ALTA' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('updates severidad and appends an audit entry for a valid request', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarSeveridad(), { wrapper: createWrapper() })
    // qe-2026-001 is EN_INVESTIGACION with severidad CRITICA
    result.current.mutate({ id: 'qe-2026-001', data: { severidad: 'ALTA' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.severidad).toBe('ALTA')
    const entries = result.current.data?.auditTrail.filter((e) => e.accion === 'QE_SEVERIDAD_EDITADA')
    expect(entries).toHaveLength(1)
  })

  it('flags the notification requirement when changing to CRITICA', async () => {
    loginAs({ id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })
    const { result } = renderHook(() => useEditarSeveridad(), { wrapper: createWrapper() })
    // qe-2026-002 has severidad ALTA
    result.current.mutate({ id: 'qe-2026-002', data: { severidad: 'CRITICA' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.requiereNotificacionUrgente).toBe(true)
  })
})
