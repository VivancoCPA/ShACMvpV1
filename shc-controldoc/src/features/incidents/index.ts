export type {
  IncidentType,
  IncidentStatus,
  IncidentSeveridad,
  IncidentTurno,
  CondicionEntorno,
  AuditTrailEntry,
  AccionCorrectivaIncidente,
  IncidentEvidencia,
  Incidente,
  Local,
  Zona,
  IncidenteUbicacion,
} from './types/incident.types'
export { CondicionEntornoValues } from './types/incident.types'

export type { IncidentPermissions } from './types/incidentPermissions.types'

export { getIncidentPermissions } from './utils/incidentPermissions'
export { getAutoSeveridad } from './utils/incidentSeveridad'
export { getPlazoInvestigacion } from './utils/incidentPlazoInvestigacion'

export {
  createIncidentSchema,
  updateIncidentInvestigacionSchema,
} from './schemas/createIncident.schema'
export type {
  CreateIncidentInput,
  UpdateIncidentInvestigacionInput,
} from './schemas/createIncident.schema'

export {
  createIncidentFormSchema,
  updateIncidentFormSchema,
} from './schemas/incidentForm.schema'
export type {
  CreateIncidentFormInput,
  UpdateIncidentFormInput,
} from './schemas/incidentForm.schema'

export { createACIncidenteSchema } from './schemas/createAC.schema'
export type { CreateACIncidenteInput } from './schemas/createAC.schema'

export {
  getIncidents,
  getIncident,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
  restoreIncident,
  createAC,
  updateAC,
} from './api/incidents.api'
export type { IncidentFilters, IncidentListResponse } from './api/incidents.api'

export {
  INCIDENT_QUERY_KEYS,
  useIncidents,
  useIncident,
  useCreateIncident,
  useUpdateIncident,
  useUpdateIncidentStatus,
  useDeleteIncident,
  useRestoreIncident,
  useCreateACIncidente,
  useUpdateACIncidente,
} from './hooks/useIncidents'

export { useIncidentList } from './hooks/useIncidentList'
export { useLocales } from './hooks/useLocales'
export { useZonasByLocal } from './hooks/useZonasByLocal'

export { IncidentStatusBadge } from './components/IncidentStatusBadge'
export { IncidentTypeBadge } from './components/IncidentTypeBadge'
export { EscaladoBanner } from './components/EscaladoBanner'
export { IncidentACSection } from './components/IncidentACSection'
export { IncidentForm } from './components/IncidentForm'
export { IncidentList } from './components/IncidentList'
export { IncidentListPage } from './pages/IncidentListPage'
export { IncidentNewPage } from './pages/IncidentNewPage'
export { IncidentEditPage } from './pages/IncidentEditPage'
export { IncidentDetailPage } from './pages/IncidentDetailPage'
