import { useAuthStore } from '../../../stores/authStore'
import type { User } from '../../../types/auth.types'

function readAccessTokenUserId(request: Request): string | undefined {
  const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  const match = token ? /^mock-access-token-(?:refreshed-)?(.+)-\d{13}$/.exec(token) : null
  return match?.[1]
}

/**
 * Usuario de la sesión activa, sin validar ningún token — para handlers que,
 * como `quality-events.handlers.ts`, ya resolvían el usuario actuante
 * directamente desde `authStore` sin pasar por un Bearer token. Mismo dato
 * que usa `getSessionUser(request)` abajo, expuesto sin el chequeo de token
 * para no forzar una firma con `Request` en call sites que no lo tenían.
 */
export function getSessionUserUnchecked(): User | null {
  return useAuthStore.getState().user
}

/**
 * Usuario actuante de un request de handler MSW de dominio. Lee la sesión
 * activa en memoria (`authStore`) en vez de re-derivar el usuario desde
 * `authFixtures`/`getUsersStore()` por el userId del Bearer token — MSW en
 * modo Service Worker corre en el mismo contexto JS que la app (no es un
 * backend separado), así que la sesión del navegador ya tiene el rol
 * efectivo resuelto para la empresa activa (ver me-f2-sesion-rbac-login
 * design.md, D3). El token se sigue validando: debe existir y corresponder
 * al usuario de la sesión, o se trata como no autenticado.
 */
export function getSessionUser(request: Request): User | null {
  const tokenUserId = readAccessTokenUserId(request)
  if (!tokenUserId) return null
  const sessionUser = getSessionUserUnchecked()
  if (!sessionUser || sessionUser.id !== tokenUserId) return null
  return sessionUser
}
