import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { queryClient } from '../../../lib/queryClient'
import { createNotificationsHubConnection } from '../../../lib/notificationsHub'
import { QUERY_KEYS } from './useNotifications'
import type { NotificationToastHandle } from './useNotificationToast'
import type { Notificacion } from '../../../types/notification.types'

// Push en tiempo real exclusivo para SEVERIDAD_CRITICA/CIERRE (notificaciones-real-time,
// notifications-realtime-client). Conecta una sola vez por sesión de pestaña, atado a
// `isAuthenticated` (no al montaje/desmontaje del componente que invoca este hook) —
// montado una sola vez en NotificationBell.tsx, junto a useNotificationToast().
export function useNotificationsHub(toastHandle: NotificationToastHandle): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    // Sin VITE_API_BASE_URL no hay backend real al que conectar (p.ej. desarrollo puro contra
    // MSW, sin cutover — ver CLAUDE.md, .env.development trae VITE_API_BASE_URL vacío en ese
    // modo). El hub simplemente no existe ahí; los 7 tipos de notificación siguen funcionando
    // vía polling (useNotifications, refetchInterval). Sin este guard,
    // HubConnectionBuilder.build() revienta de forma SÍNCRONA con una URL vacía y tira abajo el
    // árbol de React entero (no es un rechazo de promesa capturable con try/catch async).
    if (!isAuthenticated || !import.meta.env.VITE_API_BASE_URL) return

    const connection = createNotificationsHubConnection()

    connection.on('notificacionNueva', (notificacion: Notificacion) => {
      queryClient.setQueryData<Notificacion[]>(QUERY_KEYS.notifications.all, (current) =>
        current ? [notificacion, ...current] : [notificacion],
      )
      // El hub es la fuente única de toast para este evento — se marca como
      // visto antes de que el próximo poll de useNotifications() lo traiga, para
      // que el heurístico de diffing de useNotificationToast no lo duplique.
      toastHandle.markSeen(notificacion.createdAt)
      toast(notificacion.mensaje)
    })

    // Un fallo de conexión (backend real inalcanzable) no debe bloquear la app — el polling de
    // useNotifications() sigue siendo la red de respaldo para todos los tipos, incluidos los 2
    // urgentes (ver notification-query-hooks).
    connection.start().catch(() => {})

    return () => {
      void connection.stop()
    }
  }, [isAuthenticated, toastHandle])
}
