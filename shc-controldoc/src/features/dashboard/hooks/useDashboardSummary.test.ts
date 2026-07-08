// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { dashboardHandlers } from '../../../mocks/handlers/dashboard.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { useDashboardSummary } from './useDashboardSummary'

const server = setupServer(...dashboardHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function loginAs(email: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password: _password, ...user } = mockUser
  useAuthStore.getState().login({ user, accessToken: `mock-access-token-${user.id}-${Date.now()}` })
}

describe('useDashboardSummary', () => {
  it('no ejecuta la consulta sin usuario autenticado', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper(qc) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('retorna data.rol === SUPERVISOR para un usuario SUPERVISOR autenticado', async () => {
    loginAs('supervisor@shac.pe')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.rol).toBe('SUPERVISOR')
  })

  it('filtra qePorEstado según las areasAsignadas de cada Supervisor — cada uno ve solo lo suyo', async () => {
    // supervisor@shac.pe -> areasAsignadas: ['Galpón B', 'Galpón C'] -> 2 QE (QE-2026-008, QE-2026-018)
    // supervisor.almacen@shac.pe -> areasAsignadas: ['Almacén Norte', 'Almacén Sur'] -> 4 QE
    // (QE-2026-005, QE-2026-011, QE-2026-001, QE-2026-006). Los conjuntos son disjuntos.
    loginAs('supervisor@shac.pe')
    const qcGalpones = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const galpones = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper(qcGalpones) })
    await waitFor(() => expect(galpones.result.current.isSuccess).toBe(true))
    const dataGalpones = galpones.result.current.data
    if (dataGalpones?.rol !== 'SUPERVISOR') throw new Error('esperaba rol SUPERVISOR')
    const totalGalpones = Object.values(dataGalpones.data.qePorEstado).reduce((a, b) => a + b, 0)

    loginAs('supervisor.almacen@shac.pe')
    const qcAlmacenes = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const almacenes = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper(qcAlmacenes) })
    await waitFor(() => expect(almacenes.result.current.isSuccess).toBe(true))
    const dataAlmacenes = almacenes.result.current.data
    if (dataAlmacenes?.rol !== 'SUPERVISOR') throw new Error('esperaba rol SUPERVISOR')
    const totalAlmacenes = Object.values(dataAlmacenes.data.qePorEstado).reduce((a, b) => a + b, 0)

    expect(totalGalpones).toBe(2)
    expect(totalAlmacenes).toBe(4)
    expect(totalGalpones).not.toBe(totalAlmacenes)
  })
})
