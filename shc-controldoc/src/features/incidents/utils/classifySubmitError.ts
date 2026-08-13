import { isAxiosError } from 'axios'

export type SubmitErrorClassification = 'network' | 'invalid-envelope' | 'server'

/**
 * Distingue por qué falló el envío del reporte mobile (m7-f2-offline-sync
 * design.md D6):
 * - 'network': sin conectividad real — el reporte SHALL encolarse.
 * - 'invalid-envelope': el Service Worker de MSW dejó de controlar la página
 *   (ver `lib/axios.ts`, código `ERR_INVALID_RESPONSE_ENVELOPE`) — es un bug
 *   de coordinación de Service Workers, no falta de conexión; encolar aquí
 *   enmascararía la regresión, así que SHALL NOT encolarse.
 * - 'server': el servidor respondió con un error real (validación/negocio) —
 *   SHALL NOT encolarse, mismo comportamiento que hoy.
 */
export function classifySubmitError(error: unknown): SubmitErrorClassification {
  if (isAxiosError(error)) {
    if (error.code === 'ERR_INVALID_RESPONSE_ENVELOPE') return 'invalid-envelope'
    if (error.code === 'ERR_NETWORK' || !error.response) return 'network'
    return 'server'
  }
  return 'server'
}
