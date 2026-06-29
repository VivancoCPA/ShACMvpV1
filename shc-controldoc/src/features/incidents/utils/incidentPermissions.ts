import type { Incidente, IncidentStatus } from '../types/incident.types'
import type { IncidentPermissions } from '../types/incidentPermissions.types'
import type { UserRole } from '../../../types/auth.types'

const DENY_ALL: IncidentPermissions = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canChangeStatus: false,
  canAddAC: false,
  canDelete: false,
  canRestore: false,
  canAnular: false,
}

const ANULABLE_STATES: IncidentStatus[] = ['ABIERTO', 'EN_INVESTIGACION']
const ACTIVE_STATES: IncidentStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
]

export function getIncidentPermissions(
  incidente: Incidente | null,
  userRole: UserRole,
): IncidentPermissions {
  const canCreate =
    userRole === 'OPERARIO' || userRole === 'SUPERVISOR' || userRole === 'JEFE_CALIDAD_SYST'

  if (incidente === null) {
    return { ...DENY_ALL, canView: userRole !== 'JEFE_CONTROL_DOCUMENTARIO', canCreate }
  }

  const { estado, deletedAt } = incidente
  const isDeleted = deletedAt !== undefined
  const isActive = ACTIVE_STATES.includes(estado)

  switch (userRole) {
    case 'OPERARIO':
      return { ...DENY_ALL, canView: true, canCreate: true }

    case 'SUPERVISOR': {
      const canEdit =
        !isDeleted && (estado === 'ABIERTO' || estado === 'EN_INVESTIGACION')
      const canAddAC = !isDeleted && isActive && estado !== 'CERRADO' && estado !== 'ANULADO'
      const canChangeStatus = !isDeleted && isActive
      return {
        ...DENY_ALL,
        canView: true,
        canCreate: true,
        canEdit,
        canChangeStatus,
        canAddAC,
      }
    }

    case 'JEFE_CALIDAD_SYST': {
      const canEdit = !isDeleted
      const canAddAC = !isDeleted && isActive
      const canDelete = !isDeleted && estado === 'ABIERTO'
      const canRestore = isDeleted
      const canAnular = ANULABLE_STATES.includes(estado)
      const canChangeStatus = !isDeleted && isActive
      return {
        ...DENY_ALL,
        canView: true,
        canCreate: true,
        canEdit,
        canChangeStatus,
        canAddAC,
        canDelete,
        canRestore,
        canAnular,
      }
    }

    case 'AUDITOR_INTERNO':
      return { ...DENY_ALL, canView: true }

    case 'ALTA_DIRECCION':
      return { ...DENY_ALL, canView: true }

    case 'JEFE_CONTROL_DOCUMENTARIO':
      return { ...DENY_ALL }
  }
}
