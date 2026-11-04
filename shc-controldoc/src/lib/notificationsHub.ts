import { HubConnectionBuilder } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { useAuthStore } from '../stores/authStore'

export const NOTIFICATIONS_HUB_PATH = '/hubs/notifications'

// Un HubConnection de navegador no puede mandar el header Authorization en el
// handshake — @microsoft/signalr manda el token vía accessTokenFactory como
// query string (?access_token=), aceptado por el backend solo para este path
// (ver JwtBearerEvents.OnMessageReceived en ServiceCollectionExtensions). Mismo
// patrón de lectura de token que `lib/axios.ts` (leído del store en cada
// intento de conexión/reconexión, nunca capturado por closure una sola vez).
/** `true` solo si `token` es un JWT con `exp` ya vencido. Un token no decodificable (p. ej. el
 *  token opaco del mock MSW) se trata como vigente. */
export function isJwtExpired(token: string, now: number = Date.now()): boolean {
  const payload = token.split('.')[1]
  if (!payload) return false
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof json.exp === 'number' && json.exp * 1000 <= now
  } catch {
    return false
  }
}

export function createNotificationsHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${import.meta.env.VITE_API_BASE_URL}${NOTIFICATIONS_HUB_PATH}`, {
      // sesion-timeout-inactividad (design.md D5): el access token dura 5 min. Una conexión ya
      // abierta no se corta al vencer, pero cada reconexión necesita uno vigente — si el JWT en
      // memoria ya expiró, se refresca primero (single-flight, ver authStore.refreshToken).
      accessTokenFactory: async () => {
        const token = useAuthStore.getState().accessToken
        if (token && isJwtExpired(token)) {
          try {
            await useAuthStore.getState().refreshToken()
          } catch {
            return ''
          }
        }
        return useAuthStore.getState().accessToken ?? ''
      },
    })
    .withAutomaticReconnect()
    .build()
}
