import type { QESeverity } from '../types/qualityEvent.types'

export const PLAZO_SUGERIDO_DIAS_HABILES: Record<QESeverity, number> = {
  BAJA: 30,
  MEDIA: 20,
  ALTA: 10,
  CRITICA: 5,
}

export const PLAZO_MINIMO_DIAS_HABILES: Record<QESeverity, number> = {
  BAJA: 15,
  MEDIA: 10,
  ALTA: 5,
  CRITICA: 2,
}
