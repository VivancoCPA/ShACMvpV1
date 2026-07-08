import { calcularDiasHabilesRestantes } from '../../../utils/businessDays'
import type { SemaforoEstadoFila } from '../types/semaforo.types'

export function calcularEstadoSemaforoFila(diasHabilesRestantes: number): SemaforoEstadoFila {
  if (diasHabilesRestantes > 5) return 'VERDE'
  if (diasHabilesRestantes >= 1) return 'AMARILLO'
  return 'ROJO'
}

export function calcularEstadoSemaforoDesdeFecha(
  fechaVencimiento: string | Date,
  hoy: Date = new Date(),
  feriados: string[] = [],
): { estado: SemaforoEstadoFila; diasHabilesRestantes: number } {
  const fecha = typeof fechaVencimiento === 'string' ? new Date(fechaVencimiento) : fechaVencimiento
  const diasHabilesRestantes = calcularDiasHabilesRestantes(hoy, fecha, feriados)
  return { estado: calcularEstadoSemaforoFila(diasHabilesRestantes), diasHabilesRestantes }
}
