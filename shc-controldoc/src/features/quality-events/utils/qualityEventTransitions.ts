import type { QEStatus } from '../types/qualityEvent.types'

export const VALID_QE_TRANSITIONS: Record<QEStatus, QEStatus[]> = {
  ABIERTO: ['EN_INVESTIGACION'],
  EN_INVESTIGACION: ['ANALISIS_COMPLETADO'],
  ANALISIS_COMPLETADO: ['EN_EJECUCION'],
  EN_EJECUCION: ['PENDIENTE_CIERRE'],
  PENDIENTE_CIERRE: ['CERRADO'],
  CERRADO: ['EN_VERIFICACION'],
  EN_VERIFICACION: ['VERIFICADO', 'REABIERTO'],
  VERIFICADO: [],
  REABIERTO: ['EN_INVESTIGACION'],
}

export function getValidQETransitions(estado: QEStatus): QEStatus[] {
  return VALID_QE_TRANSITIONS[estado]
}
