import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '../../../api/endpoints/notifications.api'

export const QUERY_KEYS = {
  notifications: {
    all: ['notifications'] as const,
  },
} as const

export function useNotifications() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.all,
    queryFn: getNotifications,
    // Polling liviano (notificaciones-real-time) — cubre los 5 tipos sin push
    // real, y sirve de red de respaldo para SEVERIDAD_CRITICA/CIERRE si la
    // conexión de NotificationsHub estuvo caída al momento de crearse.
    refetchInterval: 60_000,
  })
}
