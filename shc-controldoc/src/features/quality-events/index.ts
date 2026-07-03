export type {
  QEOrigin,
  QEType,
  QESeverity,
  QEStatus,
  AnalisisCausaRaizMetodo,
  IshikawaCategoria,
  ReporteExternoRef,
  CincoPorques,
  Ishikawa,
  QEAuditTrailEntry,
  AccionCorrectivaQE,
  QualityEvent,
  QEListParams,
  QEStatusTransitionInput,
  QualityEventUpdateInput,
} from './types/qualityEvent.types'

export type { QEPermissions } from './types/qualityEventPermissions.types'

export { VALID_QE_TRANSITIONS, getValidQETransitions } from './utils/qualityEventTransitions'

export {
  getQualityEventPermissions,
  validateTransitionToEnEjecucion,
  validateTransitionToPendienteCierre,
  validateTransitionToCerrado,
  resolveRolSegundaFirma,
} from './utils/qualityEventPermissions'

export { requiereNotificacionUrgente, estaVencidaVerificacion, contarDiasHabiles } from './utils/qualityEventHelpers'

export {
  cincoPorquesSchema,
  ishikawaSchema,
  qualityEventCreateSchema,
} from './schemas/qualityEventCreate.schema'
export type {
  CincoPorquesInput,
  IshikawaInput,
  QualityEventCreateInput,
} from './schemas/qualityEventCreate.schema'

export { qualityEventCierreFormSchema } from './schemas/qualityEventCierre.schema'
export type { QualityEventCierreFormInput } from './schemas/qualityEventCierre.schema'

export { firmarCierreSchema } from './schemas/firmarCierre.schema'
export type { FirmarCierreInput } from './schemas/firmarCierre.schema'

export { verificacionEficaciaSchema } from './schemas/verificacionEficacia.schema'
export type { VerificacionEficaciaInput } from './schemas/verificacionEficacia.schema'

export { createQEAccionSchema } from './schemas/createQEAccion.schema'
export type { CreateQEACInput } from './schemas/createQEAccion.schema'

export { cerrarQEAccionSchema } from './schemas/cerrarQEAccion.schema'
export type { CerrarQEACInput } from './schemas/cerrarQEAccion.schema'

export {
  getQualityEvents,
  getQualityEvent,
  createQualityEvent,
  updateQualityEvent,
  transitionQEStatus,
  deleteQualityEvent,
  getQEAcciones,
  createQEAccion,
  updateQEAccion,
  cerrarQEAccion,
  getQEAuditTrail,
  solicitarACEnQE,
  cerrarQE,
  firmarCierre,
  forzarVencimientoVerificacion,
  registrarVerificacionEficacia,
} from './api/quality-events.api'
export type { QEListResponse, UpdateQEACStatusInput } from './api/quality-events.api'

export { QE_QUERY_KEYS, useQualityEvents } from './hooks/useQualityEvents'
export { useQualityEvent } from './hooks/useQualityEvent'
export { useCreateQualityEvent } from './hooks/useCreateQualityEvent'
export { useUpdateQualityEvent } from './hooks/useUpdateQualityEvent'
export { useTransitionQEStatus } from './hooks/useTransitionQEStatus'
export { useDeleteQualityEvent } from './hooks/useDeleteQualityEvent'
export { useQEList } from './hooks/useQEList'
export { useQEAcciones } from './hooks/useQEAcciones'
export { useCreateQEAccion } from './hooks/useCreateQEAccion'
export { useUpdateQEAccion } from './hooks/useUpdateQEAccion'
export { useCerrarQEAccion } from './hooks/useCerrarQEAccion'
export { useQEAuditTrail } from './hooks/useQEAuditTrail'
export { useSolicitarACEnQE } from './hooks/useSolicitarACEnQE'
export { useCerrarQE } from './hooks/useCerrarQE'
export { useFirmarCierre } from './hooks/useFirmarCierre'
export { useForzarVencimientoVerificacion } from './hooks/useForzarVencimientoVerificacion'
export { useVerificacionEficacia } from './hooks/useVerificacionEficacia'

export { QualityEventListPage } from './pages/QualityEventListPage'
export { QualityEventDetail } from './pages/QualityEventDetail'
export { QEStatusBadge } from './components/QEStatusBadge'
export { QEOriginBadge } from './components/QEOriginBadge'
export { QETypeBadge } from './components/QETypeBadge'
export { QESeverityBadge } from './components/QESeverityBadge'
export { QEHeaderSection } from './components/QEHeaderSection'
export { QEStatusTransitionPanel } from './components/QEStatusTransitionPanel'
export { QEInvestigationSection } from './components/QEInvestigationSection'
export { QEACSection } from './components/QEACSection'
export { QECierreSection } from './components/QECierreSection'
export { QEVerificacionSection } from './components/QEVerificacionSection'
export { QEAuditTrail } from './components/QEAuditTrail'
