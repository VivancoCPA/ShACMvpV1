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
} from './utils/qualityEventPermissions'

export { requiereNotificacionUrgente, estaVencidaVerificacion } from './utils/qualityEventHelpers'

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

export { qualityEventCierreSchema } from './schemas/qualityEventCierre.schema'
export type { QualityEventCierreInput } from './schemas/qualityEventCierre.schema'

export {
  getQualityEvents,
  getQualityEvent,
  createQualityEvent,
  updateQualityEvent,
  transitionQEStatus,
} from './api/quality-events.api'
export type { QEListResponse } from './api/quality-events.api'

export { QE_QUERY_KEYS, useQualityEvents } from './hooks/useQualityEvents'
export { useQualityEvent } from './hooks/useQualityEvent'
export { useCreateQualityEvent } from './hooks/useCreateQualityEvent'
export { useUpdateQualityEvent } from './hooks/useUpdateQualityEvent'
export { useTransitionQEStatus } from './hooks/useTransitionQEStatus'
export { useQEList } from './hooks/useQEList'

export { QualityEventListPage } from './pages/QualityEventListPage'
export { QEStatusBadge } from './components/QEStatusBadge'
export { QEOriginBadge } from './components/QEOriginBadge'
export { QETypeBadge } from './components/QETypeBadge'
export { QESeverityBadge } from './components/QESeverityBadge'
