import type { QEAuditTrailEntry, QualityEvent } from '../../../features/quality-events/types/qualityEvent.types'

// qe-reapertura-reinicia-cierre (espejo de QEReaperturaHelper, backend): el ciclo nuevo arranca con
// cierre, verificación y firma de la causa raíz en blanco. El análisis, el responsable y las AC del
// ciclo anterior se conservan. El resumen del ciclo que termina queda en CICLO_REINICIADO.
export const CAMPOS_REINICIADOS_AL_REABRIR = {
  resultadoCierre: undefined,
  plazoVerificacionDias: undefined,
  cerradoPorId: undefined,
  cerradoPorNombre: undefined,
  cierreFirmaSupervisorId: undefined,
  cierreFirmaSupervisorNombre: undefined,
  cierreFirmaSupervisorRol: undefined,
  fechaCierre: undefined,
  fechaVerificacionProgramada: undefined,
  fechaVerificacionRealizada: undefined,
  resultadoVerificacion: undefined,
  evidenciaVerificacion: undefined,
  causaRaizAprobadaPorId: undefined,
  causaRaizFirmadaEn: undefined,
} satisfies Partial<QualityEvent>

const fecha = (iso?: string) => (iso ? iso.slice(0, 10) : '')

export function buildCicloReiniciadoEntry(
  qe: QualityEvent,
  resultadoVerificacion: string,
  actor: { id: string; nombre: string },
  now: string,
  id: string,
): QEAuditTrailEntry {
  const partes = [`Ciclo ${qe.ciclo}`]
  if (qe.resultadoCierre) partes.push(`Cierre: ${qe.resultadoCierre.slice(0, 100)}`)
  if (qe.cerradoPorId) partes.push(`Firma JCA: ${qe.cerradoPorNombre ?? '—'}`)
  if (qe.cierreFirmaSupervisorId) partes.push(`Firma supervisor: ${qe.cierreFirmaSupervisorNombre ?? '—'}`)
  partes.push(`Verificación: ${resultadoVerificacion} ${fecha(now)}`)
  if (qe.causaRaizFirmadaEn) partes.push(`Causa raíz aprobada ${fecha(qe.causaRaizFirmadaEn)}`)
  return {
    id,
    entidadTipo: 'QualityEvent',
    entidadId: qe.id,
    accion: 'CICLO_REINICIADO',
    campoModificado: 'cierre/verificacion/causaRaiz',
    valorAnterior: partes.join(' · '),
    valorNuevo: `Ciclo ${qe.ciclo + 1}`,
    realizadoPorId: actor.id,
    realizadoPorNombre: actor.nombre,
    timestamp: now,
    generadoPorIA: false,
  }
}
