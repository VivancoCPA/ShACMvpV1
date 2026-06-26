import type { NoConformidad, NCPermissions, NCStatus } from '../types/nonconformity.types'
import type { UserRole } from '../../../types/auth.types'

const DENY_ALL: NCPermissions = {
  canRead: false,
  canEdit: false,
  canDelete: false,
  canComment: false,
  canIniciarInvestigacion: false,
  canRegistrarCorreccion: false,
  canSolicitarCierre: false,
  canCerrar: false,
  canReabrir: false,
}

function getOperarioPermissions(_estado: NCStatus): NCPermissions {
  return { ...DENY_ALL, canRead: true }
}

function getSupervisorPermissions(estado: NCStatus): NCPermissions {
  switch (estado) {
    case 'ABIERTA':
      return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canIniciarInvestigacion: true }
    case 'EN_INVESTIGACION':
      return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canRegistrarCorreccion: true }
    case 'ANALISIS_COMPLETADO':
      return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true }
    case 'EN_EJECUCION':
      return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canSolicitarCierre: true }
    case 'PENDIENTE_CIERRE':
      return { ...DENY_ALL, canRead: true, canComment: true }
    case 'CERRADA':
      return { ...DENY_ALL, canRead: true }
    case 'ANULADA':
      return { ...DENY_ALL, canRead: true }
  }
}

function getJefeCalidadPermissions(estado: NCStatus): NCPermissions {
  const base: NCPermissions = { ...DENY_ALL, canRead: true, canComment: true }
  switch (estado) {
    case 'ABIERTA':
      return { ...base, canEdit: true, canIniciarInvestigacion: true }
    case 'EN_INVESTIGACION':
      return { ...base, canEdit: true }
    case 'ANALISIS_COMPLETADO':
      return { ...base, canEdit: true }
    case 'EN_EJECUCION':
      return { ...base, canEdit: true }
    case 'PENDIENTE_CIERRE':
      return { ...base, canCerrar: true }
    case 'CERRADA':
      return { ...base }
    case 'ANULADA':
      return { ...base }
  }
}

function getAltaDireccionPermissions(estado: NCStatus): NCPermissions {
  const base: NCPermissions = { ...DENY_ALL, canRead: true, canComment: true }
  switch (estado) {
    case 'PENDIENTE_CIERRE':
      return { ...base, canCerrar: true }
    default:
      return base
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
      return { ...DENY_ALL, canRead: true, canComment: true }
    case 'ALTA_DIRECCION':
      return getAltaDireccionPermissions(nc.estado)
    case 'JEFE_CONTROL_DOCUMENTARIO':
      return { ...DENY_ALL, canRead: true }
  }
}
