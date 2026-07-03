import type { QualityEvent } from '../types/qualityEvent.types'

export function requiereNotificacionUrgente(qe: QualityEvent): boolean {
  return qe.severidad === 'CRITICA'
}

export function contarDiasHabiles(desde: Date, hasta: Date): number {
  let count = 0
  const cursor = new Date(desde)
  cursor.setHours(0, 0, 0, 0)
  const fin = new Date(hasta)
  fin.setHours(0, 0, 0, 0)

  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1)
    const dia = cursor.getDay()
    if (dia !== 0 && dia !== 6) {
      count++
    }
  }
  return count
}

export function estaVencidaVerificacion(qe: QualityEvent, hoy: Date): boolean {
  if (!qe.fechaVerificacionProgramada) return false
  if (qe.fechaVerificacionRealizada) return false

  const desde = new Date(qe.fechaVerificacionProgramada)
  const diasHabiles = contarDiasHabiles(desde, hoy)
  return diasHabiles > 10
}
