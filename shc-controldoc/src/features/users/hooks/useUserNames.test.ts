// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { userHandlers } from '../../../mocks/handlers/users.handlers'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../../../mocks/fixtures/empresas.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { useUserNames } from './useUserNames'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const server = setupServer(...userHandlers, ...authHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  const mockUser = authFixtures.find((u) => u.email === 'admin@shac.pe')
  if (!mockUser) throw new Error('Fixture no encontrado: admin@shac.pe')
  const { password: _password, ...user } = mockUser
  const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
  useAuthStore.setState({
    user,
    accessToken: `mock-access-token-${user.id}-${Date.now()}`,
    isAuthenticated: true,
    empresaActivaId: empresasDisponibles[0]?.id ?? null,
    empresasDisponibles,
  })
})
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, empresaActivaId: null })
})
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('useUserNames', () => {
  it('getName devuelve un placeholder corto mientras carga', () => {
    const qc = newQueryClient()
    const { result } = renderHook(() => useUserNames(['user-jefedocs-001']), { wrapper: makeWrapper(qc) })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.getName('user-jefedocs-001')).not.toBe('user-jefedocs-001')
    expect(result.current.getName('user-jefedocs-001')).toBeTruthy()
  })

  it('getName devuelve el nombre resuelto una vez cargado', async () => {
    const qc = newQueryClient()
    const { result } = renderHook(() => useUserNames(['user-jefedocs-001']), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.getName('user-jefedocs-001')).not.toBe('user-jefedocs-001')
    expect(result.current.getName('user-jefedocs-001')).not.toBe('userNames.noDisponible')
  })

  it('getName devuelve el texto genérico para un id que el backend no resolvió', async () => {
    const qc = newQueryClient()
    // user-operario-101 solo está asignado a empresa-002; la sesión está en empresa-001.
    const { result } = renderHook(() => useUserNames(['user-operario-101']), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.getName('user-operario-101')).toBe('userNames.noDisponible')
  })

  it('filtra ids nulos/undefined sin romper y usa el texto genérico para ellos', () => {
    const qc = newQueryClient()
    const { result } = renderHook(() => useUserNames([undefined, null, 'user-jefedocs-001']), {
      wrapper: makeWrapper(qc),
    })

    expect(result.current.getName(undefined)).toBe('userNames.noDisponible')
    expect(result.current.getName(null)).toBe('userNames.noDisponible')
  })

  it('dos llamadas con los mismos ids en distinto orden comparten la misma query (dedupe + sort)', async () => {
    const qc = newQueryClient()
    const { result: a } = renderHook(() => useUserNames(['user-jefedocs-001', 'user-admin-001']), {
      wrapper: makeWrapper(qc),
    })
    const { result: b } = renderHook(() => useUserNames(['user-admin-001', 'user-jefedocs-001', 'user-admin-001']), {
      wrapper: makeWrapper(qc),
    })

    await waitFor(() => expect(a.current.isLoading).toBe(false))
    await waitFor(() => expect(b.current.isLoading).toBe(false))

    expect(qc.getQueryCache().findAll({ queryKey: ['users', 'nombres'] })).toHaveLength(1)
  })
})
