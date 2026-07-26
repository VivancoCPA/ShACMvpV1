import { http, HttpResponse, delay } from 'msw'
import { getNotificationsStore, resetStore } from '../fixtures/notifications.fixtures'
import { generateVencimientoNotifications } from '../fixtures/notificationGeneration'
import { getSessionUser as getUserFromRequest } from './shared/session'
import { useAuthStore } from '../../stores/authStore'
import type { Notificacion } from '../../types/notification.types'

const LATENCY = 400

// RN-EMP-004: mismo patrón que los demás handlers (cada uno define su propia
// copia, ver quality-events.handlers.ts).
function getActiveEmpresaId(): string | null {
  return useAuthStore.getState().empresaActivaId
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

    const activeEmpresaId = getActiveEmpresaId()
    const items = getNotificationsStore()
      .filter((n) => n.usuarioId === requestUser.id && n.empresaId === activeEmpresaId)
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
    const activeEmpresaId = getActiveEmpresaId()
    const store = getNotificationsStore()

    if (requestUser) {
      for (let i = 0; i < store.length; i++) {
        if (store[i].usuarioId === requestUser.id && store[i].empresaId === activeEmpresaId) {
          store[i] = { ...store[i], leida: true }
        }
      }
    }

    const items = store.filter((n) => n.usuarioId === requestUser?.id && n.empresaId === activeEmpresaId)
    return ok(items)
  }),
]

export { resetStore }
