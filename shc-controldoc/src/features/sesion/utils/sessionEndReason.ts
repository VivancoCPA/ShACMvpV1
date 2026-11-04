import { isAxiosError } from 'axios'
import { SESION_INACTIVA, SESION_MAXIMA_ALCANZADA, type SessionEndReason } from '../types/sesion.types'

/** Motivo de cierre según el `errorCode` de un 401 del backend (sesion-timeout-inactividad
 *  design.md D7/D12). `null` para cualquier otro error, incluido un 401 "Sesión expirada" genérico. */
export function sessionEndReasonFromError(error: unknown): SessionEndReason | null {
  if (!isAxiosError(error) || error.response?.status !== 401) return null
  const errorCode = (error.response.data as { errorCode?: string } | undefined)?.errorCode
  if (errorCode === SESION_INACTIVA) return 'INACTIVIDAD'
  if (errorCode === SESION_MAXIMA_ALCANZADA) return 'SESION_MAXIMA'
  return null
}
