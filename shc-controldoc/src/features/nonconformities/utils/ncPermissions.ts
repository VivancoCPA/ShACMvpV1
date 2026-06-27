import type { NoConformidad, NCPermissions, NCStatus } from '../types/nonconformity.types'
import type { UserRole } from '../../../types/auth.types'

const DENY_ALL: NCPermissions = {
  canRead: false,
  canEdit: false,
  canDelete: false,
  canRestore: false,
  canComment: false,
  canIniciarInvestigacion: false,
  canRegistrarCorreccion: false,
  canSolicitarCierre: false,
  canCerrar: false,
  canReabrir: false,
  canAnular: false,
  canAsignarAC: false,
  canCerrarAC: false,
  canVerAuditTrail: false,
}

const isTerminal = (estado: NCStatus) => estado === 'CERRADA' || estado === 'ANULADA'

function getOperarioPermissions(_estado: NCStatus): NCPermissions {
  return { ...DENY_ALL, canRead: true }
}

function getSupervisorPermissions(estado: NCStatus): NCPermissions {
  const base: NCPermissions = { ...DENY_ALL, canRead: true, canComment: true, canVerAuditTrail: true }
  const canAsignarAC = !isTerminal(estado)
  switch (estado) {
    case 'ABIERTA':
      return { ...base, canEdit: true, canIniciarInvestigacion: true, canAsignarAC }
    case 'EN_INVESTIGACION':
      return { ...base, canEdit: true, canRegistrarCorreccion: true, canAsignarAC }
    case 'ANALISIS_COMPLETADO':
      return { ...base, canEdit: true, canAsignarAC }
    case 'EN_EJECUCION':
      return { ...base, canEdit: true, canSolicitarCierre: true, canAsignarAC }
    case 'PENDIENTE_CIERRE':
      return { ...base }
    case 'CERRADA':
      return { ...base }
    case 'ANULADA':
      return { ...base }
  }
}

function getJefeCalidadPermissions(estado: NCStatus): NCPermissions {
  const base: NCPermissions = {
    ...DENY_ALL,
    canRead: true,
    canDelete: true,
    canRestore: true,
    canComment: true,
    canCerrarAC: true,
    canVerAuditTrail: true,
  }
  const canAnular = !isTerminal(estado)
  const canAsignarAC = !isTerminal(estado)
  switch (estado) {
    case 'ABIERTA':
      return { ...base, canEdit: true, canIniciarInvestigacion: true, canAnular, canAsignarAC }
    case 'EN_INVESTIGACION':
      return { ...base, canEdit: true, canAnular, canAsignarAC }
    case 'ANALISIS_COMPLETADO':
      return { ...base, canEdit: true, canAnular, canAsignarAC }
    case 'EN_EJECUCION':
      return { ...base, canEdit: true, canAnular, canAsignarAC }
    case 'PENDIENTE_CIERRE':
      return { ...base, canCerrar: true, canAnular, canAsignarAC }
    case 'CERRADA':
      return { ...base }
    case 'ANULADA':
      return { ...base }
  }
}

function getAltaDireccionPermissions(estado: NCStatus): NCPermissions {
  const base: NCPermissions = { ...DENY_ALL, canRead: true, canComment: true, canVerAuditTrail: true }
  const canAnular = !isTerminal(estado)
  switch (estado) {
    case 'PENDIENTE_CIERRE':
      return { ...base, canCerrar: true, canAnular }
    default:
      return { ...base, canAnular }
  }
}

export function getNCPermissions(nc: NoConformidad, userRole: UserRole): NCPermissions {
  switch (userRole) {
    case 'OPERARIO':
      return getOperarioPermissions(nc.estado)
    case 'SUPERVISOR':
      return getSupervisorPermissions(nc.estado)
    case 'JEFE_CALIDAD_SYST':
      return getJefeCalidadPermissions(nc.estado)
    case 'AUDITOR_INTERNO':
      return { ...DENY_ALL, canRead: true, canComment: true, canVerAuditTrail: true }
    case 'ALTA_DIRECCION':
      return getAltaDireccionPermissions(nc.estado)
    case 'JEFE_CONTROL_DOCUMENTARIO':
      return { ...DENY_ALL, canRead: true, canVerAuditTrail: true }
  }
}
