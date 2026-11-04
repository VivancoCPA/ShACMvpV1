import { getIncidentsStore } from './incidents.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import type { QualityEvent, QEStatus } from '../../features/quality-events/types/qualityEvent.types'
import type { IncidentStatus, AuditTrailEntry as IncidentAuditTrailEntry } from '../../features/incidents/types/incident.types'
import type { NCStatus, AuditTrailEntry as NCAuditTrailEntry } from '../../features/nonconformities/types/nonconformity.types'

// Único punto de escritura para la sincronización Incidente/NC <- QE. Se invoca desde
// commitQE() en quality-events.handlers.ts cada vez que el estado del QE cambia, para un QE con
// incidenteId o ncId vinculado (origen O1_INCIDENTE_CAMPO / O2_NC_DETECTADA respectivamente).
// Generaliza lo que antes vivía solo en incidents.handlers.ts (syncIncidentFromQEEstado) para
// evitar triplicar la lógica de "buscar en el store cross-domain + escribir + audit trail" al
// agregar la sincronización de No Conformidad. Escribe el estado directo (sin pasar por las
// transiciones manuales válidas de cada dominio): el mapeo ya garantiza una transición válida de
// negocio, incluyendo la reapertura (CERRADO/CERRADA -> EN_INVESTIGACION), que esas transiciones
// manuales no permiten porque modelan únicamente el avance manual del origen, no el reflejo de
// un QE que se reabre.
//
// Mapeo de estado QE -> estado del origen resultante: EN_VERIFICACION/VERIFICADO no avanzan el
// origen más allá de CERRADO/CERRADA -su parte del ciclo ya terminó-, y REABIERTO (persistido
// como EN_INVESTIGACION) hace que el origen vuelva a EN_INVESTIGACION.
// Espejo de IncidenteQeSync.MapearEstado del backend (incidentes-qe-estado-alertas D6).
const QE_ESTADO_TO_INCIDENTE_ESTADO: Record<QEStatus, IncidentStatus> = {
  ABIERTO: 'ABIERTO',
  EN_INVESTIGACION: 'EN_INVESTIGACION',
  ANALISIS_COMPLETADO: 'ANALISIS_COMPLETADO',
  EN_EJECUCION: 'EN_EJECUCION',
  PENDIENTE_CIERRE: 'PENDIENTE_CIERRE',
  CERRADO: 'CERRADO',
  EN_VERIFICACION: 'CERRADO',
  VERIFICADO: 'CERRADO',
  REABIERTO: 'EN_INVESTIGACION',
}

const QE_ESTADO_TO_NC_ESTADO: Record<QEStatus, NCStatus> = {
  ABIERTO: 'ABIERTA',
  EN_INVESTIGACION: 'EN_INVESTIGACION',
  ANALISIS_COMPLETADO: 'ANALISIS_COMPLETADO',
  EN_EJECUCION: 'EN_EJECUCION',
  PENDIENTE_CIERRE: 'PENDIENTE_CIERRE',
  CERRADO: 'CERRADA',
  EN_VERIFICACION: 'CERRADA',
  VERIFICADO: 'CERRADA',
  REABIERTO: 'EN_INVESTIGACION',
}

// RN-NC-003 (y su equivalente para Incidente, ver TERMINAL_INCIDENT en IncidentACSection.tsx):
// ANULADA/ANULADO es un estado terminal fuera del ciclo de vida normal QE -> origen (se alcanza
// por una acción explícita de anulación, no por una transición del QE). Una vez ahí, la
// sincronización automática nunca debe sobreescribirlo, sin importar cómo transicione el QE
// vinculado después. CERRADO/CERRADA, en cambio, sí puede revertirse por una reapertura del QE
// (ver mapeo REABIERTO -> EN_INVESTIGACION arriba) — no es terminal para este propósito.
function resolveNuevoEstado<TEstado extends string>(
  mapa: Record<QEStatus, TEstado>,
  estadoQE: QEStatus,
  estadoActual: TEstado,
  estadoAnulado: TEstado,
): TEstado | null {
  if (estadoActual === estadoAnulado) return null
  const nuevoEstado = mapa[estadoQE]
  if (nuevoEstado === estadoActual) return null
  return nuevoEstado
}

function makeSyncAuditEntry<TEntidadTipo extends string>(
  entidadTipo: TEntidadTipo,
  entidadId: string,
  estadoAnterior: string,
  estadoNuevo: string,
  qeNumero: string,
  actor: { id: string; nombre: string },
) {
  return {
    id: `aud-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo,
    entidadId,
    accion: 'ESTADO_CAMBIADO',
    estadoAnterior,
    estadoNuevo,
    campoModificado: 'sincronizacionQE',
    valorNuevo: `Sincronizado automáticamente desde QE ${qeNumero}`,
    realizadoPorId: actor.id,
    realizadoPorNombre: actor.nombre,
    timestamp: new Date().toISOString(),
    generadoPorIA: false,
  }
}

export function mapQEEstadoToIncidentEstado(estado: QEStatus): IncidentStatus {
  return QE_ESTADO_TO_INCIDENTE_ESTADO[estado]
}

// incidentes-qe-estado-alertas (D1) — mismo contrato que IncidenteQeSync en el backend: actor
// "Sistema", accion ESTADO_SINCRONIZADO_QE y valorNuevo = número del QE. Solo toca un incidente
// de la misma empresa que sigue apuntando a este QE.
function makeIncidentSyncAuditEntry(
  incidenteId: string,
  estadoAnterior: string,
  estadoNuevo: string,
  valorNuevo: string,
): IncidentAuditTrailEntry {
  return {
    id: `aud-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo: 'Incidente',
    entidadId: incidenteId,
    accion: 'ESTADO_SINCRONIZADO_QE',
    estadoAnterior,
    estadoNuevo,
    valorNuevo,
    realizadoPorId: 'system',
    realizadoPorNombre: 'Sistema',
    timestamp: new Date().toISOString(),
    generadoPorIA: true,
  }
}

function findLinkedIncidentIdx(qe: QualityEvent): number {
  return getIncidentsStore().findIndex(
    (i) => i.id === qe.incidenteId && i.empresaId === qe.empresaId && i.qeId === qe.id && !i.deletedAt,
  )
}

function syncIncidenteFromQEEstado(qe: QualityEvent): void {
  const store = getIncidentsStore()
  const idx = findLinkedIncidentIdx(qe)
  if (idx === -1) return

  const inc = store[idx]
  const nuevoEstado = resolveNuevoEstado(QE_ESTADO_TO_INCIDENTE_ESTADO, qe.estado, inc.estado, 'ANULADO')
  if (nuevoEstado === null) return

  store[idx] = {
    ...inc,
    estado: nuevoEstado,
    actualizadoEn: new Date().toISOString(),
    auditTrail: [...inc.auditTrail, makeIncidentSyncAuditEntry(inc.id, inc.estado, nuevoEstado, qe.numero)],
  }
}

// Vinculación atómica (D3/D5): asigna qeId solo si el incidente sigue libre. soloSiAbierto lo
// usa la reactivación del QE. Devuelve false si no pudo vincular.
export function linkIncidentToQE(
  qe: QualityEvent,
  actor: { id: string; nombre: string },
  { soloSiAbierto }: { soloSiAbierto: boolean },
): boolean {
  const store = getIncidentsStore()
  const idx = store.findIndex((i) => i.id === qe.incidenteId && i.empresaId === qe.empresaId)
  if (idx === -1) return false
  const inc = store[idx]
  if (inc.qeId) return false
  if (soloSiAbierto && (inc.deletedAt || inc.estado !== 'ABIERTO')) return false

  const now = new Date().toISOString()
  const auditEntry: IncidentAuditTrailEntry = {
    id: `aud-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo: 'Incidente',
    entidadId: inc.id,
    accion: 'QE_VINCULADO',
    valorNuevo: qe.numero,
    realizadoPorId: actor.id,
    realizadoPorNombre: actor.nombre,
    timestamp: now,
    generadoPorIA: false,
  }
  store[idx] = { ...inc, qeId: qe.id, actualizadoEn: now, auditTrail: [...inc.auditTrail, auditEntry] }
  return true
}

// Al eliminar el QE el incidente queda libre y en ABIERTO; se registra aunque el estado no
// cambie, porque cambia el vínculo (D5).
export function unlinkIncidentFromQE(qe: QualityEvent): void {
  const store = getIncidentsStore()
  const idx = findLinkedIncidentIdx(qe)
  if (idx === -1) return

  const inc = store[idx]
  store[idx] = {
    ...inc,
    qeId: undefined,
    estado: 'ABIERTO',
    actualizadoEn: new Date().toISOString(),
    auditTrail: [
      ...inc.auditTrail,
      makeIncidentSyncAuditEntry(inc.id, inc.estado, 'ABIERTO', `QE ${qe.numero} eliminado`),
    ],
  }
}

function syncNonconformidadFromQEEstado(
  ncId: string,
  estadoQE: QEStatus,
  qeNumero: string,
  actor: { id: string; nombre: string },
): void {
  const store = getNonconformitiesStore()
  const idx = store.findIndex((n) => n.id === ncId)
  if (idx === -1) return

  const nc = store[idx]
  const nuevoEstado = resolveNuevoEstado(QE_ESTADO_TO_NC_ESTADO, estadoQE, nc.estado, 'ANULADA')
  if (nuevoEstado === null) return

  const auditEntry: NCAuditTrailEntry = makeSyncAuditEntry(
    'NoConformidad',
    nc.id,
    nc.estado,
    nuevoEstado,
    qeNumero,
    actor,
  )

  store[idx] = {
    ...nc,
    estado: nuevoEstado,
    actualizadoEn: new Date().toISOString(),
    auditTrail: [...nc.auditTrail, auditEntry],
  }
}

// Punto de entrada único llamado desde commitQE(): resuelve si el QE tiene un origen
// sincronizable (Incidente o NC) según qe.origen y aplica el mapeo correspondiente.
// O3_HALLAZGO_AUDITORIA / O4_REPORTE_EXTERNO no tienen entidad origen que sincronizar.
export function syncOrigenFromQEEstado(qe: QualityEvent, actor: { id: string; nombre: string }): void {
  if (qe.origen === 'O1_INCIDENTE_CAMPO' && qe.incidenteId) {
    syncIncidenteFromQEEstado(qe)
    return
  }
  if (qe.origen === 'O2_NC_DETECTADA' && qe.ncId) {
    syncNonconformidadFromQEEstado(qe.ncId, qe.estado, qe.numero, actor)
  }
}
