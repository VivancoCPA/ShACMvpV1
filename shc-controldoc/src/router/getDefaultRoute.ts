import type { UserRole } from '../types/auth.types'

/**
 * Única fuente de verdad para el destino post-autenticación por rol.
 * Cualquier redirect a un destino "por defecto" (login fresco, sesión ya
 * activa, ruta índice `/`) DEBE pasar por aquí — nunca hardcodear `/documentos`
 * o condicionar por rol en el sitio de uso (ver M6-S05).
 */
export function getDefaultRouteForRole(rol: UserRole): string {
  if (rol === 'ADMINISTRADOR_SISTEMA') return '/usuarios'
  return '/dashboard'
}
