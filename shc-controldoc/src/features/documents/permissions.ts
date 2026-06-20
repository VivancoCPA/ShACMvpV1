import type { DocStatus, DocRole, DocumentPermissions, DocConfidencialidad } from '../../types/documents.types'

const CONFIDENCIAL_ROLES = new Set([
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
])

export function canAccessDocument(
  confidencialidad: DocConfidencialidad,
  userRole: string,
  rolesAutorizados: string[],
): boolean {
  if (confidencialidad === 'PUBLICO' || confidencialidad === 'INTERNO') return true
  if (confidencialidad === 'CONFIDENCIAL') return CONFIDENCIAL_ROLES.has(userRole)
  // RESTRINGIDO
  return rolesAutorizados.includes(userRole)
}

const DENY_ALL: DocumentPermissions = {
  canRead: false,
  canEdit: false,
  canDelete: false,
  canComment: false,
  canApprove: false,
  canReject: false,
  canSign: false,
  canStartReview: false,
  canCancelReview: false,
}

export function getDocumentPermissions(
  estado: DocStatus,
  rol: DocRole,
  context: { isAssignedAuthor?: boolean } = {},
): DocumentPermissions {
  const { isAssignedAuthor = false } = context

  switch (estado) {
    case 'BORRADOR':
      switch (rol) {
        case 'AUTOR':
          return { ...DENY_ALL, canRead: true, canEdit: true, canDelete: true }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canDelete: true }
        case 'OPERARIO':
          return { ...DENY_ALL }
      }

    case 'EN_REVISION':
      switch (rol) {
        case 'AUTOR':
          return { ...DENY_ALL, canRead: true }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true, canComment: true, canApprove: true, canReject: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canDelete: true }
        case 'OPERARIO':
          return { ...DENY_ALL }
      }

    case 'EN_APROBACION':
      switch (rol) {
        case 'AUTOR':
          return { ...DENY_ALL, canRead: true }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true, canSign: true, canReject: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true }
        case 'OPERARIO':
          return { ...DENY_ALL }
      }

    case 'PUBLICADO':
      switch (rol) {
        case 'AUTOR':
          return { ...DENY_ALL }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true, canStartReview: true }
        case 'OPERARIO':
          return { ...DENY_ALL, canRead: true }
      }

    case 'OBSOLETO':
      // RN-DOC-003: OBSOLETO is read-only. No write actions allowed for any role.
      switch (rol) {
        case 'AUTOR':
          return { ...DENY_ALL }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true }
        case 'OPERARIO':
          return { ...DENY_ALL }
      }

    case 'EN_REVISION_PERIODICA':
      // AUTOR permissions are context-aware: only the assigned author may edit.
      switch (rol) {
        case 'AUTOR':
          return isAssignedAuthor
            ? { ...DENY_ALL, canRead: true, canEdit: true, canComment: true }
            : { ...DENY_ALL, canRead: true }
        case 'REVISOR':
          return { ...DENY_ALL, canRead: true, canComment: true }
        case 'APROBADOR':
          return { ...DENY_ALL, canRead: true }
        case 'JEFE_CALIDAD':
          return { ...DENY_ALL, canRead: true, canEdit: true, canComment: true, canCancelReview: true }
        case 'OPERARIO':
          return { ...DENY_ALL, canRead: true }
      }
  }
}
