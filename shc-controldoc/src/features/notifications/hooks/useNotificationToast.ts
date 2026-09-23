import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { useNotifications } from './useNotifications'

export interface NotificationToastHandle {
  /** Marca un `createdAt` como ya visto (ya toasteado por otro canal — hoy solo
   *  `useNotificationsHub()`, para SEVERIDAD_CRITICA/CIERRE) para que el próximo
   *  refetch de `useNotifications()` no lo vuelva a toastear por acá. */
  markSeen(createdAt: string): void
}

// Estado final (notificaciones-real-time, cierra el Open Question dejado por
// cutover-notificaciones): este heurístico de diffing same-session sigue siendo
// la única fuente de toast para los 5 tipos no urgentes (CAMBIO_ESTADO,
// ASIGNACION, VENCIMIENTO, VERIFICACION_EFICAZ, COMERCIO_EXTERIOR) — para esos,
// una notificación creada para OTRO usuario en OTRA sesión solo se ve en su
// campana/bandeja en el próximo poll de `useNotifications()` (refetchInterval de
// 60s, ver notification-query-hooks), no instantáneamente.
//
// Para SEVERIDAD_CRITICA/CIERRE sí existe push real entre sesiones — vía
// `NotificationsHub` (SignalR), consumido por `useNotificationsHub()`. Ese hook
// es la fuente única de toast para esos 2 tipos y llama `markSeen()` (el handle
// que este hook devuelve) apenas los recibe, para que este heurístico de polling
// no los vuelva a toastear cuando el próximo refetch los traiga. Este heurístico
// sigue actuando como red de respaldo para esos 2 tipos si la conexión del hub
// estuvo caída al momento de crearse la notificación.
export function useNotificationToast(): NotificationToastHandle {
  const { data: notifications } = useNotifications()
  const user = useAuthStore((s) => s.user)
  const lastSeenCreatedAtRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const markSeen = useCallback((createdAt: string) => {
    const current = lastSeenCreatedAtRef.current
    if (!current || createdAt > current) {
      lastSeenCreatedAtRef.current = createdAt
    }
  }, [])

  useEffect(() => {
    if (!notifications || !user) return

    if (!initializedRef.current) {
      initializedRef.current = true
      lastSeenCreatedAtRef.current = notifications.reduce<string | null>(
        (latest, n) => (!latest || n.createdAt > latest ? n.createdAt : latest),
        null,
      )
      return
    }

    const baseline = lastSeenCreatedAtRef.current
    // Defensa en profundidad (CA-NOTIF-06): GET /api/notifications ya filtra
    // por usuarioId, pero nunca confiamos ciegamente en eso para decidir si
    // mostrar un toast al usuario actual.
    const fresh = notifications.filter(
      (n) => n.usuarioId === user.id && (!baseline || n.createdAt > baseline),
    )
    fresh.forEach((n) => toast(n.mensaje))

    lastSeenCreatedAtRef.current = notifications.reduce<string | null>(
      (latest, n) => (!latest || n.createdAt > latest ? n.createdAt : latest),
      baseline,
    )
  }, [notifications, user])

  return useMemo(() => ({ markSeen }), [markSeen])
}
