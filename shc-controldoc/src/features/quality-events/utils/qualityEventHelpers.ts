import type { QualityEvent, NormativaVinculada } from '../types/qualityEvent.types'
import { contarDiasHabiles } from '../../../utils/businessDays'

export { contarDiasHabiles }

const NORMA_ISO_LABELS: Record<'ISO_9001_2015' | 'ISO_45001_2018', string> = {
  ISO_9001_2015: 'ISO 9001:2015',
  ISO_45001_2018: 'ISO 45001:2018',
}

export function formatNormativaVinculada(normativa: NormativaVinculada): string {
  const normaLabel =
    normativa.norma === 'OTRA' ? (normativa.normaOtraDetalle ?? normativa.norma) : NORMA_ISO_LABELS[normativa.norma]
  return `${normaLabel} · §${normativa.clausula}`
}

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
