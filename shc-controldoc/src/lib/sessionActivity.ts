import type { SessionEndReason } from '../features/sesion/types/sesion.types'

// Última actividad REAL del usuario compartida entre pestañas del mismo origen, y difusión del
// cierre de sesión (sesion-timeout-inactividad design.md D10/D11). BroadcastChannel es el canal
// principal; el evento `storage` cubre navegadores sin BroadcastChannel. Ninguna petición de red
// marca actividad aquí — solo SessionTimeoutManager, a partir de eventos de interacción del DOM.

const LAST_ACTIVITY_KEY = 'shac_last_activity'
const LOGOUT_KEY = 'shac_session_logout'
const CHANNEL_NAME = 'shac-session'

export type SessionMessage =
  | { type: 'activity'; at: number }
  | { type: 'logout'; reason: SessionEndReason | null }

type Listener = (message: SessionMessage) => void

const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null
let storageListenerAttached = false
let lastActivity = readStoredActivity() ?? Date.now()

function readStoredActivity(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
    const value = raw ? Number(raw) : NaN
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function emit(message: SessionMessage): void {
  listeners.forEach((listener) => listener(message))
}

function handleIncoming(message: SessionMessage): void {
  if (message.type === 'activity') {
    if (message.at <= lastActivity) return
    lastActivity = message.at
  }
  emit(message)
}

function ensureTransport(): void {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<SessionMessage>) => handleIncoming(event.data)
  }
  if (!storageListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        handleIncoming({ type: 'activity', at: Number(event.newValue) })
      } else if (event.key === LOGOUT_KEY && event.newValue) {
        try {
          const { reason } = JSON.parse(event.newValue) as { reason: SessionEndReason | null }
          handleIncoming({ type: 'logout', reason })
        } catch {
          handleIncoming({ type: 'logout', reason: null })
        }
      }
    })
    storageListenerAttached = true
  }
}

export function getLastActivity(): number {
  return lastActivity
}

/** Marca actividad local y la difunde a las otras pestañas. */
export function markActivity(at: number = Date.now()): void {
  if (at <= lastActivity) return
  lastActivity = at
  ensureTransport()
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
  } catch {
    // Sin storage disponible (modo privado estricto): el BroadcastChannel sigue cubriendo.
  }
  channel?.postMessage({ type: 'activity', at } satisfies SessionMessage)
}

/** Reinicia el reloj al iniciar una sesión nueva (un valor viejo de otra sesión no cuenta). */
export function resetActivity(at: number = Date.now()): void {
  lastActivity = at
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
  } catch {
    // ignorado — ver markActivity
  }
}

export function broadcastLogout(reason: SessionEndReason | null): void {
  ensureTransport()
  channel?.postMessage({ type: 'logout', reason } satisfies SessionMessage)
  try {
    localStorage.setItem(LOGOUT_KEY, JSON.stringify({ reason, at: Date.now() }))
  } catch {
    // ignorado — ver markActivity
  }
}

/** Mensajes recibidos desde OTRAS pestañas (actividad o cierre de sesión). */
export function subscribeSessionMessages(listener: Listener): () => void {
  ensureTransport()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
