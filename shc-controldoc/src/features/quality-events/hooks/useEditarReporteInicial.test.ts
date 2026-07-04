import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { createElement } from 'react'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import type { User } from '../../../types/auth.types'
import { useEditarReporteInicial } from './useEditarReporteInicial'
import api from '../../../lib/axios'

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

async function primeWindow(id: string, overrides: Record<string, unknown> = {}) {
  await api.patch(`/api/quality-events/${id}`, {
    estado: 'ABIERTO',
    fechaHoraReporte: new Date().toISOString(),
    ...overrides,
  })
}

describe('PATCH /api/quality-events/:id/editar-reporte-inicial', () => {
  it('returns 404 for an unknown id', async () => {
    const { result } = renderHook(() => useEditarReporteInicial(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'does-not-exist', data: { areaAfectada: 'Almacén' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request outside the RN-QE-010 window', async () => {
    loginAs({ id: 'user-006', nombre: 'Pedro', apellido: 'Quispe', email: 'p@shac.internal', rol: 'OPERARIO', area: 'Almacén Sur' })
    const { result } = renderHook(() => useEditarReporteInicial(), { wrapper: createWrapper() })
    // qe-2026-006 is ABIERTO but fechaHoraReporte is far in the past
    result.current.mutate({ id: 'qe-2026-006', data: { areaAfectada: 'Almacén Modificado' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a request from a user who is neither creator nor area Supervisor', async () => {
    await primeWindow('qe-2026-011', { reportadoPorId: 'user-777', areaAfectada: 'Almacén Test' })
    loginAs({ id: 'user-999', nombre: 'Ajeno', apellido: 'Uno', email: 'a@shac.internal', rol: 'OPERARIO', area: 'Otra Área' })
    const { result } = renderHook(() => useEditarReporteInicial(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'qe-2026-011', data: { areaAfectada: 'Almacén Cambiado' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a payload containing a protected field even if otherwise valid', async () => {
    await primeWindow('qe-2026-018', { reportadoPorId: 'user-778', areaAfectada: 'Almacén Test' })
    loginAs({ id: 'user-778', nombre: 'Creador', apellido: 'Dos', email: 'c2@shac.internal', rol: 'OPERARIO', area: 'Almacén Test' })
    const { result } = renderHook(() => useEditarReporteInicial(), { wrapper: createWrapper() })
    result.current.mutate({
      id: 'qe-2026-018',
      // @ts-expect-error — intentionally sending a protected field to verify server-side rejection
      data: { numero: 'QE-2026-999', descripcion: 'Descripción cambiada de más de diez caracteres' },
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('updates only changed fields and appends one audit entry per field', async () => {
    await primeWindow('qe-2026-007', { reportadoPorId: 'user-779', areaAfectada: 'Almacén Original' })
    loginAs({ id: 'user-779', nombre: 'Creador', apellido: 'Tres', email: 'c3@shac.internal', rol: 'OPERARIO', area: 'Almacén Original' })
    const { result } = renderHook(() => useEditarReporteInicial(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'qe-2026-007', data: { areaAfectada: 'Almacén Sur' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.areaAfectada).toBe('Almacén Sur')
    const nuevasEntradas = result.current.data?.auditTrail.filter(
      (e) => e.accion === 'QE_REPORTE_INICIAL_EDITADO',
    )
    expect(nuevasEntradas).toHaveLength(1)
    expect(nuevasEntradas?.[0].campoModificado).toBe('areaAfectada')
  })
})
