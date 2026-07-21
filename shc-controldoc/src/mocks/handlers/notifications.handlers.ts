import { http, HttpResponse, delay } from 'msw'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getNotificationsStore, resetStore } from '../fixtures/notifications.fixtures'
import { generateVencimientoNotifications } from '../fixtures/notificationGeneration'
import type { Notificacion } from '../../types/notification.types'

const LATENCY = 400

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const match = /^mock-access-token-(.+)-\d{13}$/.exec(token)
  const userId = match?.[1] ?? null
  return userId ? (authFixtures.find((u) => u.id === userId) ?? null) : null
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, message }, { status })
}

export const notificationHandlers = [
  // GET /api/notifications — recompute vencimiento notifications, then filter to the requesting user
  http.get('/api/notifications', async ({ request }) => {
    await delay(LATENCY)

    generateVencimientoNotifications()

    const requestUser = getUserFromRequest(request)
    if (!requestUser) return ok([])

    const items = getNotificationsStore()
      .filter((n) => n.usuarioId === requestUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return ok(items)
  }),

  // PATCH /api/notifications/:id/leida — mark one as read
  http.patch('/api/notifications/:id/leida', async ({ params }) => {
    await delay(LATENCY)

    const store = getNotificationsStore()
    const idx = store.findIndex((n) => n.id === params.id)
    if (idx === -1) return err('Notificación no encontrada', 404)

    const updated: Notificacion = { ...store[idx], leida: true }
    store[idx] = updated

    return ok(updated)
  }),

  // PATCH /api/notifications/marcar-todas-leidas — mark all of the requesting user's notifications as read
  http.patch('/api/notifications/marcar-todas-leidas', async ({ request }) => {
    await delay(LATENCY)

    const requestUser = getUserFromRequest(request)
    const store = getNotificationsStore()

    if (requestUser) {
      for (let i = 0; i < store.length; i++) {
        if (store[i].usuarioId === requestUser.id) {
          store[i] = { ...store[i], leida: true }
        }
      }
    }

    const items = store.filter((n) => n.usuarioId === requestUser?.id)
    return ok(items)
  }),
]

export { resetStore }
