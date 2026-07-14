// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'
import { userHandlers } from '../../../mocks/handlers/users.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import {
  USERS_QUERY_KEYS,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useToggleUserActive,
  useResetUserPassword,
} from './useUsers'
import { getUserAuditTrailLog } from '../utils/userAuditTrail'

const server = setupServer(...userHandlers)
const SEED_IDS = new Set(authFixtures.map((u) => u.id))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  // Los usuarios creados durante los tests tienen ids generados dinámicamente
  // (`user-${Date.now()}-...`) — se remueven para no filtrar estado entre tests.
  for (let i = authFixtures.length - 1; i >= 0; i--) {
    if (!SEED_IDS.has(authFixtures[i].id)) authFixtures.splice(i, 1)
  }
})
afterAll(() => server.close())

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

describe('useCreateUser', () => {
  it('invalida el listado e incluye temporaryPassword en el resultado', async () => {
    const qc = newQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({
        nombre: 'Hook',
        apellido: 'Test',
        email: 'hook.test@shac.pe',
        rol: 'OPERARIO',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: USERS_QUERY_KEYS.all }),
    )
    expect(result.current.data?.temporaryPassword).toMatch(/^[A-Za-z0-9]{8}$/)
  })

  it('registra una entrada de audit trail al crear', async () => {
    const qc = newQueryClient()
    const before = getUserAuditTrailLog().length

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({
        nombre: 'Audit',
        apellido: 'Trail',
        email: 'audit.trail@shac.pe',
        rol: 'OPERARIO',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getUserAuditTrailLog().length).toBe(before + 1)
    expect(getUserAuditTrailLog().at(-1)).toMatchObject({ accion: 'CREADO', entidadTipo: 'Usuario' })
  })
})

describe('useUpdateUser', () => {
  it('invalida el listado y registra audit trail con CAMPO_EDITADO', async () => {
    const qc = newQueryClient()
    const { result: createResult } = renderHook(() => useCreateUser(), { wrapper: makeWrapper(qc) })
    await act(async () => {
      createResult.current.mutate({
        nombre: 'Editar',
        apellido: 'User',
        email: 'editar.user@shac.pe',
        rol: 'OPERARIO',
      })
    })
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true))
    const userId = createResult.current.data?.id
    if (!userId) throw new Error('createUser no devolvió id')

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateUser(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({ id: userId, data: { email: 'editar.user@shac.pe', rol: 'JEFE_CALIDAD_SYST' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: USERS_QUERY_KEYS.all }),
    )
    expect(result.current.data?.rol).toBe('JEFE_CALIDAD_SYST')
    expect(getUserAuditTrailLog().at(-1)).toMatchObject({ accion: 'CAMPO_EDITADO', entidadTipo: 'Usuario' })
  })
})

describe('useToggleUserActive', () => {
  it('invalida el listado y registra audit trail con ESTADO_CAMBIADO', async () => {
    const qc = newQueryClient()
    const { result: createResult } = renderHook(() => useCreateUser(), { wrapper: makeWrapper(qc) })
    await act(async () => {
      createResult.current.mutate({
        nombre: 'Toggle',
        apellido: 'User',
        email: 'toggle.user@shac.pe',
        rol: 'OPERARIO',
      })
    })
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true))
    const userId = createResult.current.data?.id
    if (!userId) throw new Error('createUser no devolvió id')

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useToggleUserActive(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate(userId)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: USERS_QUERY_KEYS.all }),
    )
    expect(result.current.data?.activo).toBe(false)
    expect(getUserAuditTrailLog().at(-1)).toMatchObject({
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: 'true',
      estadoNuevo: 'false',
    })
  })
})

describe('useResetUserPassword', () => {
  it('expone temporaryPassword en mutation.data', async () => {
    const qc = newQueryClient()
    const { result: createResult } = renderHook(() => useCreateUser(), { wrapper: makeWrapper(qc) })
    await act(async () => {
      createResult.current.mutate({
        nombre: 'Reset',
        apellido: 'Hook',
        email: 'reset.hook@shac.pe',
        rol: 'OPERARIO',
      })
    })
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true))
    const userId = createResult.current.data?.id
    if (!userId) throw new Error('createUser no devolvió id')

    const { result } = renderHook(() => useResetUserPassword(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate(userId)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.temporaryPassword).toMatch(/^[A-Za-z0-9]{8}$/)
  })
})

describe('useUsers', () => {
  it('retorna usuarios activos e inactivos sin filtros', async () => {
    const qc = newQueryClient()
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })
})
