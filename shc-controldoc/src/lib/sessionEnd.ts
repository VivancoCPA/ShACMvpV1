import { useAuthStore } from '../stores/authStore'
import { queryClient } from './queryClient'
import { broadcastLogout } from './sessionActivity'
import { logoutUser } from '../features/auth/api/auth.api'
import type { SessionEndReason } from '../features/sesion/types/sesion.types'

interface EndSessionOptions {
  /** `false` cuando el servidor ya invalidó la sesión (401 con código) o el cierre viene de otra
   *  pestaña que ya llamó a /logout. */
  notifyServer?: boolean
  /** `false` cuando el cierre llega desde otra pestaña (evita rebotes infinitos). */
  broadcast?: boolean
}

let ending: Promise<void> | null = null

/**
 * Único camino de cierre de sesión (sesion-timeout-inactividad design.md D11): botón "Cerrar
 * sesión", detector de inactividad, interceptor de Axios, otra pestaña. Nunca toca la cola offline
 * de incidentes (IndexedDB) — se sincroniza cuando el mismo usuario vuelva a entrar (D13).
 *
 * La navegación al login la hace `RoleGuard` al ver `isAuthenticated: false`, conservando
 * `state.from` para volver a la ruta donde estaba el usuario tras re-loguearse.
 */
export function endSession(reason: SessionEndReason | null, options: EndSessionOptions = {}): Promise<void> {
  if (ending) return ending
  if (!useAuthStore.getState().isAuthenticated) return Promise.resolve()

  const { notifyServer = true, broadcast = true } = options
  ending = (async () => {
    // Se dispara ANTES de limpiar el store: el mock identifica la sesión por el refresh token
    // guardado en localStorage, que authStore.logout() borra.
    const serverLogout = notifyServer ? logoutUser().catch(() => undefined) : Promise.resolve()

    useAuthStore.getState().logout(reason)
    queryClient.clear()
    if (broadcast) broadcastLogout(reason)

    await serverLogout
  })().finally(() => {
    ending = null
  })
  return ending
}
