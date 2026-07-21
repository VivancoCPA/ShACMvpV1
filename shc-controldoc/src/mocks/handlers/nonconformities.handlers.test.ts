import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { nonconformityHandlers, resetStore } from './nonconformities.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { NoConformidad } from '../../features/nonconformities/types/nonconformity.types'

const server = setupServer(...nonconformityHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetStore()
  resetNotificationsStore()
})

interface Result<T> {
  status: number
  data: T
}

async function call<T>(promise: Promise<{ data: T; status: number }>): Promise<Result<T>> {
  try {
    const res = await promise
    return { status: res.status, data: res.data }
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return { status: error.response.status, data: error.response.data as T }
    }
    throw error
  }
}

function tokenFor(email: string): string {
  const user = authFixtures.find((u) => u.email === email)
  if (!user) throw new Error(`Fixture no encontrado: ${email}`)
  return `mock-access-token-${user.id}-${Date.now()}`
}

function authHeaders(email: string) {
  return { headers: { Authorization: `Bearer ${tokenFor(email)}` } }
}

describe('nonconformities.handlers — PATCH /api/nonconformities/:id notification emission', () => {
  it('notifies the reporter when estado changes', async () => {
    // nc-002's fixture reportadoPorId is user-004, a real resolvable account
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { estado: 'ANALISIS_COMPLETADO' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-004' && n.entidadId === 'nc-002' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('creates no CAMBIO_ESTADO notification when estado is not among the changed fields', async () => {
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { causaRaiz: 'Falta de procedimiento' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.entidadId === 'nc-002' && n.tipo === 'CAMBIO_ESTADO')
    expect(notif).toBeUndefined()
  })

  it('does not notify the acting user when they change their own NC estado', async () => {
    // ana.torres@shac.pe → id user-004, same as nc-002's reportadoPorId
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { estado: 'ANALISIS_COMPLETADO' },
        authHeaders('ana.torres@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.usuarioId === 'user-004' && n.entidadId === 'nc-002')
    expect(notif).toBeUndefined()
  })
})
