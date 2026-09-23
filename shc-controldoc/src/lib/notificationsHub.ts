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
export function createNotificationsHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${import.meta.env.VITE_API_BASE_URL}${NOTIFICATIONS_HUB_PATH}`, {
      accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
    })
    .withAutomaticReconnect()
    .build()
}
