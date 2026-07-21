import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { useNotifications } from './useNotifications'

// Limitación conocida (mock-only, ver design.md "Non-Goals" / decisión de
// diseño de esta spec): esto SOLO dispara un toast para notificaciones creadas
// dentro de la MISMA pestaña/sesión del navegador (p.ej. una mutación propia
// que además generó una notificación para el propio usuario actual, como un
// firmante de QE que también es responsable de una AC). No existe WebSocket/SSE
// en el entorno MSW, así que una notificación creada para OTRO usuario en OTRA
// sesión nunca dispara un toast aquí — esa persona solo la ve en su campana/
// bandeja la próxima vez que su propio `useNotifications()` haga fetch (p.ej.
// el refetch periódico normal de TanStack Query). Esto queda resuelto recién
// cuando exista un backend .NET real con push entre sesiones.
export function useNotificationToast(): void {
  const { data: notifications } = useNotifications()
  const user = useAuthStore((s) => s.user)
  const lastSeenCreatedAtRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

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
}
