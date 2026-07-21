import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { notificationHandlers, resetStore } from './notifications.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getNotificationsStore } from '../fixtures/notifications.fixtures'
import type { Notificacion } from '../../types/notification.types'

const server = setupServer(...notificationHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  resetStore()
  server.resetHandlers(...notificationHandlers)
})
afterAll(() => server.close())

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

describe('notifications.handlers — GET /api/notifications', () => {
  it('returns only the requesting user notifications, most recent first', async () => {
    const { status, data } = await call(
      api.get<Notificacion[]>('/api/notifications', authHeaders('operario@shac.pe')),
    )

    expect(status).toBe(200)
    expect(data.length).toBeGreaterThan(0)
    expect(data.every((n) => n.usuarioId === 'user-operario-001')).toBe(true)
    for (let i = 1; i < data.length; i++) {
      expect(new Date(data[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(data[i].createdAt).getTime(),
      )
    }
  })

  it('returns an empty list for a user with no notifications and does not leak others', async () => {
    const { status, data } = await call(
      api.get<Notificacion[]>('/api/notifications', authHeaders('gerencia@shac.pe')),
    )

    expect(status).toBe(200)
    expect(data.every((n) => n.usuarioId === 'user-gerencia-001')).toBe(true)
  })
})

describe('notifications.handlers — PATCH /api/notifications/:id/leida', () => {
  it('marks a single notification as read', async () => {
    const unread = getNotificationsStore().find((n) => !n.leida)!
    const { status, data } = await call(
      api.patch<Notificacion>(`/api/notifications/${unread.id}/leida`, undefined, authHeaders('operario@shac.pe')),
    )

    expect(status).toBe(200)
    expect(data.leida).toBe(true)
  })

  it('returns 404 for an unknown id', async () => {
    const { status } = await call(
      api.patch<Notificacion>('/api/notifications/does-not-exist/leida', undefined, authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(404)
  })
})

describe('notifications.handlers — PATCH /api/notifications/marcar-todas-leidas', () => {
  it("marks all of the requesting user's notifications as read without affecting other users", async () => {
    const { status, data } = await call(
      api.patch<Notificacion[]>('/api/notifications/marcar-todas-leidas', undefined, authHeaders('operario@shac.pe')),
    )

    expect(status).toBe(200)
    expect(data.every((n) => n.leida)).toBe(true)

    const otherUserNotification = getNotificationsStore().find((n) => n.usuarioId === 'user-jefedocs-001')
    expect(otherUserNotification?.leida).toBe(false)
  })
})

describe('notifications.handlers — vencimiento generation trigger', () => {
  it('invokes generateVencimientoNotifications before filtering', async () => {
    const generation = await import('../fixtures/notificationGeneration')
    const spy = vi.spyOn(generation, 'generateVencimientoNotifications')

    await call(api.get<Notificacion[]>('/api/notifications', authHeaders('operario@shac.pe')))

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
