import type { QESeverity } from '../types/qualityEvent.types'
import { PLAZO_SUGERIDO_DIAS_HABILES } from './plazoAjuste.constants'

export function calcularRequiereAprobacionGerencia(
  qeSeveridad: QESeverity,
  incrementoDiasHabiles: number,
): boolean {
  if (qeSeveridad === 'CRITICA') return true
  if (qeSeveridad === 'ALTA') return incrementoDiasHabiles > PLAZO_SUGERIDO_DIAS_HABILES.ALTA * 0.5
  return false
}
