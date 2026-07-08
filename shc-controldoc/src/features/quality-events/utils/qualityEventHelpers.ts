import type { QualityEvent } from '../types/qualityEvent.types'
import { contarDiasHabiles } from '../../../utils/businessDays'

export { contarDiasHabiles }

export function requiereNotificacionUrgente(qe: QualityEvent): boolean {
  return qe.severidad === 'CRITICA'
}

export function estaVencidaVerificacion(qe: QualityEvent, hoy: Date): boolean {
  if (!qe.fechaVerificacionProgramada) return false
  if (qe.fechaVerificacionRealizada) return false

  const desde = new Date(qe.fechaVerificacionProgramada)
  const diasHabiles = contarDiasHabiles(desde, hoy)
  return diasHabiles > 10
}
