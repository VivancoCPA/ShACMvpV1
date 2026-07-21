import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { incidentHandlers, resetStore } from './incidents.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { Incidente } from '../../features/incidents/types/incident.types'

const server = setupServer(...incidentHandlers)

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

describe('incidents.handlers — PATCH /api/incidents/:id/status notification emission', () => {
  it('notifies the reporter on a valid transition', async () => {
    // inc-005's fixture reportadoPorId is user-005, a real resolvable account
    const { status } = await call(
      api.patch<Incidente>(
        '/api/incidents/inc-005/status',
        { estado: 'PENDIENTE_CIERRE' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-005' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('does not notify the acting user when they perform their own transition', async () => {
    // luis.paredes@shac.pe → id user-005, same as inc-005's reportadoPorId
    const { status } = await call(
      api.patch<Incidente>(
        '/api/incidents/inc-005/status',
        { estado: 'PENDIENTE_CIERRE' },
        authHeaders('luis.paredes@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-005')
    expect(notif).toBeUndefined()
  })
})
