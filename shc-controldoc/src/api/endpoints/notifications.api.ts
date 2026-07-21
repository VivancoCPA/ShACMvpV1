import api from '../../lib/axios'
import type { Notificacion } from '../../types/notification.types'

export async function getNotifications(): Promise<Notificacion[]> {
  const response = await api.get<Notificacion[]>('/api/notifications')
  return response.data
}

export async function markNotificationRead(id: string): Promise<Notificacion> {
  const response = await api.patch<Notificacion>(`/api/notifications/${id}/leida`)
  return response.data
}

export async function markAllNotificationsRead(): Promise<Notificacion[]> {
  const response = await api.patch<Notificacion[]>('/api/notifications/marcar-todas-leidas')
  return response.data
}
