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
  canViewArchivoOriginal: false,
  canReplaceArchivoOriginal: false,
  canViewArchivoDistribucion: false,
}

function getBasePermissions(
  estado: DocStatus,
  rol: DocRole,
  isAssignedAuthor: boolean,
): DocumentPermissions {
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

export function getDocumentPermissions(
  estado: DocStatus,
  rol: DocRole,
  context: { isAssignedAuthor?: boolean; archivoOriginalBloqueado?: boolean } = {},
): DocumentPermissions {
  const { isAssignedAuthor = false, archivoOriginalBloqueado = false } = context

  const base = getBasePermissions(estado, rol, isAssignedAuthor)

  // RN-DOC-013/016: archivo original visible only in BORRADOR/EN_REVISION, to any docRole
  // with a stake in the document (AUTOR, REVISOR, APROBADOR, JEFE_CALIDAD) — OPERARIO never
  // sees it. Note docRole reflects the user's relationship to THIS document, not their global
  // UserRole: a SUPERVISOR assigned as REVISOR of a document is docRole 'REVISOR' here.
  const canViewArchivoOriginal =
    rol !== 'OPERARIO' && (estado === 'BORRADOR' || estado === 'EN_REVISION')

  // RN-DOC-018: only Autor/Jefe de Calidad may replace the editable source (narrower than
  // view access above), and only while not frozen (RN-DOC-015).
  const canReplaceArchivoOriginal =
    (rol === 'AUTOR' || rol === 'JEFE_CALIDAD') &&
    (estado === 'BORRADOR' || estado === 'EN_REVISION') &&
    !archivoOriginalBloqueado

  // Distribution PDF visible to anyone who can read a PUBLICADO or EN_REVISION_PERIODICA document
  const canViewArchivoDistribucion =
    base.canRead && (estado === 'PUBLICADO' || estado === 'EN_REVISION_PERIODICA')

  return { ...base, canViewArchivoOriginal, canReplaceArchivoOriginal, canViewArchivoDistribucion }
}
