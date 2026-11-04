import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import { endSession } from '../../../lib/sessionEnd'
import { getLastActivity, markActivity, subscribeSessionMessages } from '../../../lib/sessionActivity'
import { usePoliticaSesion, useRegistrarActividad } from '../hooks/useSesion'
import { sessionEndReasonFromError } from '../utils/sessionEndReason'
import { InactivityWarningModal } from './InactivityWarningModal'

/** El aviso aparece 60 s antes del cierre por inactividad (decisión D2 de Toño). */
export const WARNING_MS = 60_000
/** Cadencia máxima de `POST /api/auth/actividad` (design.md D10). */
export const REPORT_INTERVAL_MS = 60_000
/** Throttle de las marcas de actividad local. */
export const LOCAL_THROTTLE_MS = 5_000
const TICK_MS = 1_000

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

/**
 * Detector de inactividad (sesion-timeout-inactividad design.md D10). Se monta una vez por layout
 * autenticado (AppShell y MobileShell, hermanos en el router — nunca dos a la vez).
 *
 * Solo la interacción real del DOM cuenta como actividad: las peticiones de red (polling de
 * notificaciones, contador de pendientes, SignalR) nunca pasan por aquí. El servidor es quien hace
 * cumplir la política (refresh/actividad responden 401 con código); este temporizador es la
 * comodidad de avisar antes y cerrar a tiempo.
 */
export function SessionTimeoutManager() {
  const { t } = useTranslation('sesion')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: estado } = usePoliticaSesion()
  const registrarActividad = useRegistrarActividad()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // Las callbacks de la mutation cambian de identidad entre renders; los temporizadores del
  // efecto de abajo leen siempre la última vía ref para no re-armarse en cada render.
  const reportRef = useRef<() => Promise<unknown>>(() => Promise.resolve())
  useEffect(() => {
    reportRef.current = () => registrarActividad.mutateAsync()
  }, [registrarActividad])

  useEffect(() => {
    if (!isAuthenticated || !estado) return

    const inactividadMs = estado.inactividadMinutos * 60_000
    const sesionMaximaDeadline = estado.sesionIniciadaEn
      ? Date.parse(estado.sesionIniciadaEn) + estado.sesionMaximaHoras * 3_600_000
      : null
    // Tras un reload, la actividad local puede ser más vieja que la que el servidor ya registró.
    if (estado.ultimaActividadEn) markActivity(Date.parse(estado.ultimaActividadEn))

    const remaining = () => getLastActivity() + inactividadMs - Date.now()

    let lastLocalMark = 0
    let lastReport = 0
    let trailingReport: ReturnType<typeof setTimeout> | null = null

    const sendReport = () => {
      lastReport = Date.now()
      reportRef.current().catch(() => {
        // Un 401 con código ya cerró la sesión en el interceptor; otros fallos se ignoran — el
        // próximo reporte (o "Seguir conectado") lo reintenta.
      })
    }

    // Throttle de 60 s con envío trailing: el servidor registra la hora de recepción (≥ que la
    // actividad real), así nunca vence antes que el cliente.
    const scheduleReport = () => {
      const since = Date.now() - lastReport
      if (since >= REPORT_INTERVAL_MS) {
        sendReport()
      } else {
        trailingReport ??= setTimeout(() => {
          trailingReport = null
          sendReport()
        }, REPORT_INTERVAL_MS - since)
      }
    }

    const tick = () => {
      const now = Date.now()
      if (sesionMaximaDeadline !== null && now >= sesionMaximaDeadline) {
        void endSession('SESION_MAXIMA')
        return
      }
      const left = remaining()
      if (left <= 0) {
        void endSession('INACTIVIDAD')
        return
      }
      setSecondsLeft(left <= WARNING_MS ? Math.ceil(left / 1000) : null)
    }

    const onUserActivity = () => {
      const now = Date.now()
      if (now - lastLocalMark < LOCAL_THROTTLE_MS) return
      // Con el aviso abierto, la actividad pasiva no lo cierra: solo "Seguir conectado" (o
      // actividad real en otra pestaña).
      if (remaining() <= WARNING_MS) return
      lastLocalMark = now
      markActivity(now)
      scheduleReport()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // Primero se evalúa el vencimiento: una pestaña que vuelve ya vencida no se "revive".
      tick()
      if (useAuthStore.getState().isAuthenticated) onUserActivity()
    }

    const unsubscribe = subscribeSessionMessages((message) => {
      if (message.type === 'activity') tick()
      else void endSession(message.reason, { notifyServer: false, broadcast: false })
    })

    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, onUserActivity, { passive: true, capture: true }),
    )
    document.addEventListener('visibilitychange', onVisibilityChange)
    const interval = setInterval(tick, TICK_MS)
    tick()

    return () => {
      unsubscribe()
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onUserActivity, { capture: true }))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(interval)
      if (trailingReport) clearTimeout(trailingReport)
      setSecondsLeft(null)
    }
  }, [isAuthenticated, estado])

  const handleStayConnected = async () => {
    markActivity(Date.now())
    setSecondsLeft(null)
    try {
      await registrarActividad.mutateAsync()
      await useAuthStore.getState().refreshToken()
    } catch (error) {
      // Un 401 con código de política ya cerró la sesión vía interceptor.
      if (!sessionEndReasonFromError(error)) toast.error(t('warning.stayError'))
    }
  }

  if (!isAuthenticated || secondsLeft === null) return null

  return (
    <InactivityWarningModal
      secondsLeft={secondsLeft}
      isPending={registrarActividad.isPending}
      onStayConnected={() => void handleStayConnected()}
      onLogout={() => void endSession(null)}
    />
  )
}
