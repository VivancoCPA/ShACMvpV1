import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { notificationHandlers, resetStore } from './notifications.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { useAuthStore } from '../../stores/authStore'
import { getNotificationsStore, addNotification } from '../fixtures/notifications.fixtures'
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

// `getSessionUser` (empresa-session, me-f2-sesion-rbac-login) resuelve el
// usuario actuante desde la sesión activa en memoria, no solo del Bearer
// token — este helper pobla `authStore` además de construir el token, para
// que los handlers de dominio reconozcan al usuario de cada fixture.
function authHeaders(email: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password: _password, ...user } = mockUser
  const accessToken = `mock-access-token-${user.id}-${Date.now()}`
  useAuthStore.setState({ user, accessToken, isAuthenticated: true, empresaActivaId: 'empresa-001' })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
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

describe('notifications.handlers — aislamiento por empresa activa (RN-EMP-004, me-f5-verificacion-cruzada)', () => {
  // user-supervisor-001: SUPERVISOR en empresa-001, JEFE_CALIDAD_SYST en
  // empresa-002 (ver empresas.fixtures.ts) — mismo usuario, notificaciones en
  // ambas empresas.
  it('GET /api/notifications solo devuelve las notificaciones de la empresa activa', async () => {
    addNotification({
      id: 'notif-test-empresa2',
      usuarioId: 'user-supervisor-001',
      empresaId: 'empresa-002',
      tipo: 'CAMBIO_ESTADO',
      entidadTipo: 'QE',
      entidadId: 'qe-e2-2026-001',
      entidadCodigo: 'QE-2026-E2-001',
      mensaje: 'Notificación de prueba en empresa-002.',
      leida: false,
      createdAt: new Date().toISOString(),
      link: '/quality-events/qe-e2-2026-001',
    })

    const headersEmpresa1 = authHeaders('supervisor@shac.pe') // empresaActivaId: 'empresa-001'
    const { data: dataEmpresa1 } = await call(api.get<Notificacion[]>('/api/notifications', headersEmpresa1))
    expect(dataEmpresa1.some((n) => n.id === 'notif-test-empresa2')).toBe(false)

    authHeaders('supervisor@shac.pe')
    useAuthStore.setState({ empresaActivaId: 'empresa-002' })
    const { data: dataEmpresa2 } = await call(api.get<Notificacion[]>('/api/notifications'))
    expect(dataEmpresa2.some((n) => n.id === 'notif-test-empresa2')).toBe(true)
  })

  it('marcar-todas-leidas no marca como leída una notificación de otra empresa', async () => {
    addNotification({
      id: 'notif-test-marcar-empresa2',
      usuarioId: 'user-supervisor-001',
      empresaId: 'empresa-002',
      tipo: 'CAMBIO_ESTADO',
      entidadTipo: 'QE',
      entidadId: 'qe-e2-2026-001',
      entidadCodigo: 'QE-2026-E2-001',
      mensaje: 'Notificación de prueba en empresa-002.',
      leida: false,
      createdAt: new Date().toISOString(),
      link: '/quality-events/qe-e2-2026-001',
    })

    await call(
      api.patch('/api/notifications/marcar-todas-leidas', undefined, authHeaders('supervisor@shac.pe')),
    )

    const stillUnread = getNotificationsStore().find((n) => n.id === 'notif-test-marcar-empresa2')
    expect(stillUnread?.leida).toBe(false)
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
