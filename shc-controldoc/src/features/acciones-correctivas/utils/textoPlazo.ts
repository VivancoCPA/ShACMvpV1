import type { TFunction } from 'i18next'
import { calcularEstadoSemaforoFila } from '../../dashboard/utils/semaforoPendientes'
import type { AccionCorrectivaListadoItem } from '../types/accionesCorrectivasListado.types'

const SEMAFORO_TEXTO = {
  VERDE: 'text-success dark:text-success',
  AMARILLO: 'text-warning dark:text-amber',
  ROJO: 'text-error dark:text-error',
} as const

/** Texto del semáforo de plazo (D6). null para AC sin plazo vigente (pendiente de verificación o cerrada). */
export function textoPlazo(ac: AccionCorrectivaListadoItem, t: TFunction<'accionesCorrectivas'>): { texto: string; clase: string } | null {
  if (ac.estadoNormalizado === 'PENDIENTE_VERIFICACION' || ac.estadoNormalizado === 'CERRADA') return null
  if (ac.vencida) {
    const dias = Math.abs(ac.diasHabilesRestantes)
    return {
      texto: dias === 0 ? t('plazo.vencida') : t('plazo.vencidaHace', { count: dias }),
      clase: SEMAFORO_TEXTO.ROJO,
    }
  }
  const dias = Math.max(ac.diasHabilesRestantes, 0)
  const estado = dias === 0 ? 'AMARILLO' : calcularEstadoSemaforoFila(dias)
  return {
    texto: dias === 0 ? t('plazo.venceHoy') : t('plazo.venceEn', { count: dias }),
    clase: SEMAFORO_TEXTO[estado],
  }
}
