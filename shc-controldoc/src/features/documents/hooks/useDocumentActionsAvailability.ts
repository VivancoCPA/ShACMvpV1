import { useAuthStore } from '../../../stores/authStore'
import { useDocumentsByCode } from './useDocuments'
import { canAccessDocument, canManagePeriodicReview, getDocumentPermissions, resolveDocRoleForUser } from '../permissions'
import type { Documento, DocStatus } from '../../../types/documents.types'

const IN_PROCESS_STATUSES = new Set<DocStatus>(['BORRADOR', 'EN_REVISION', 'EN_APROBACION'])

export interface DocumentActionsAvailability {
  /** `true` si el documento está eliminado (soft-delete) — en ese caso TODAS las demás banderas
   *  son `false`: un documento eliminado nunca ofrece ninguna acción normal (ver/descargar/
   *  gestión), solo el banner + botón de restauración (`canRestore`). Replica el `return`
   *  anticipado que ya existía inline en `DocumentActionPanel` antes de esta extracción. */
  isDeleted: boolean
  /** Solo relevante cuando `isDeleted` es `true`. */
  canRestore: boolean
  canVerDocumento: boolean
  canDescargarCopia: boolean
  faltaAsignacion: boolean
  canSendToReview: boolean
  canSendToReviewBloqueadoPorAsignacion: boolean
  canDelete: boolean
  canApproveReview: boolean
  canRejectReview: boolean
  canCancelReview: boolean
  canSign: boolean
  canRejectAprobacion: boolean
  canStartPeriodic: boolean
  canCreateVersion: boolean
  canStartNewVersion: boolean
  otraVersionEnProceso: Documento | undefined
  hasAnyAction: boolean
}

const EMPTY_AVAILABILITY_FLAGS = {
  canVerDocumento: false,
  canDescargarCopia: false,
  faltaAsignacion: false,
  canSendToReview: false,
  canSendToReviewBloqueadoPorAsignacion: false,
  canDelete: false,
  canApproveReview: false,
  canRejectReview: false,
  canCancelReview: false,
  canSign: false,
  canRejectAprobacion: false,
  canStartPeriodic: false,
  canCreateVersion: false,
  canStartNewVersion: false,
  otraVersionEnProceso: undefined,
  hasAnyAction: false,
} as const

/**
 * Disponibilidad de acciones del detalle de documento — extraído 1:1 (detalle-documento-dos-
 * columnas, D6) de lo que antes era un cálculo inline dentro de `DocumentActionPanel`. Ninguna
 * condición cambia aquí: es la misma lógica, ahora compartida por el encabezado (acciones de
 * gestión) y la barra lateral (acciones de lectura) en vez de que cada uno la recalculara por
 * su cuenta. Devuelve banderas "vacías" (todo `false`/`undefined`) si no hay sesión — el caller
 * decide qué hacer con eso (`DocumentActionPanel` no renderiza nada sin `user`).
 */
export function useDocumentActionsAvailability(documento: Documento): DocumentActionsAvailability {
  const user = useAuthStore((s) => s.user)

  const isDeleted = !!documento.deletedAt
  const canRestore = !!user && (user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'ALTA_DIRECCION')

  const hasFileAccess = !!user && canAccessDocument(documento.confidencialidad, user.rol, documento.rolesAutorizados ?? [])

  // nueva-version-autor-permisos: docRole resuelto con la misma precedencia que el backend
  // (AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO), no un flag `isJefeCalidad` suelto
  // por rol global — un JCA/JCD que es revisor/aprobador asignado de ESTE documento resuelve a
  // REVISOR/APROBADOR, igual que DocumentPermissionResolver.ResolveDocRole (design.md D4/D5).
  const isJefeCalidad = user?.rol === 'JEFE_CALIDAD_SYST' || user?.rol === 'JEFE_CONTROL_DOCUMENTARIO'
  const isAutor = !!user && documento.autorId === user.id
  const isRevisor = !!user && documento.revisorId === user.id
  const isAprobador = !!user && documento.aprobadorId === user.id
  const docRole = resolveDocRoleForUser(documento, user)
  const perms = getDocumentPermissions(documento.estado, docRole, { isAssignedAuthor: docRole === 'AUTOR' })

  // visor-documentos (design.md D2) + autor-lectura-publicado (2026-10-08): "Ver documento" usa
  // canRead de la matriz (AUTOR ya tiene canRead=true en PUBLICADO/OBSOLETO, igual que
  // REVISOR/APROBADOR), con el mismo OR de la excepción CA-34 que aplica en el backend para
  // OBSOLETO (JEFE_CONTROL_DOCUMENTARIO/ALTA_DIRECCION ven el visor aunque su docRole resuelto
  // sea OPERARIO, sin canRead en ese estado) — sin esto, ese caso quedaría bloqueado del visor
  // pese a tener acceso histórico reconocido. No requiere !!documento.archivoUrl (a diferencia de
  // "Ver archivo"/"Exportar PDF"): el backend decide qué mostrar según estado.
  const canVerDocumento =
    hasFileAccess &&
    (perms.canRead || (documento.estado === 'OBSOLETO' && (user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION')))
  // proteccion-documental (design.md D1) — "Descargar copia (PDF)" (antes "Exportar PDF
  // controlado") ya no depende de `documento.archivoUrl` (ese campo nunca existió en el backend
  // real); depende del mismo `canRead` que "Ver documento" y del estado vigente. OBSOLETO queda
  // sin ninguna acción de descarga (RN-DOC-003) — solo "Ver documento".
  const canDescargarCopia =
    (documento.estado === 'PUBLICADO' || documento.estado === 'EN_REVISION_PERIODICA') && hasFileAccess && perms.canRead
  const faltaAsignacion = documento.estado === 'BORRADOR' && (!documento.revisorId || !documento.aprobadorId)
  const puedeEditarEnBorrador = documento.estado === 'BORRADOR' && perms.canEdit
  const canSendToReview = puedeEditarEnBorrador && !faltaAsignacion
  const canSendToReviewBloqueadoPorAsignacion = puedeEditarEnBorrador && faltaAsignacion
  const canDelete = documento.estado === 'BORRADOR' && perms.canDelete
  // RN: aprobar/rechazar están reservados al revisorId/aprobadorId específico
  // asignado al documento — JEFE_CALIDAD tiene editar/comentar en EN_REVISION,
  // pero no firma ni aprueba/rechaza por otro (ver permissions.ts).
  const canApproveReview = documento.estado === 'EN_REVISION' && isRevisor
  const canRejectReview = documento.estado === 'EN_REVISION' && isRevisor
  const canCancelReview = documento.estado === 'EN_REVISION' && perms.canEdit
  const canSign = documento.estado === 'EN_APROBACION' && isAprobador
  const canRejectAprobacion = documento.estado === 'EN_APROBACION' && isAprobador
  // revision-periodica-permiso-por-rol (D1): por rol GLOBAL, no por docRole/perms.canStartReview
  // — un JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO conserva el permiso aunque sea autor,
  // revisor o aprobador asignado de ESTE documento.
  const canStartPeriodic = documento.estado === 'PUBLICADO' && !!user && canManagePeriodicReview(user.rol)
  // canCreateVersion/canStartNewVersion NO usan el docRole/matriz de arriba: la regla real del
  // backend (NuevaVersionDocumentoEndpoint) es "autor del origen o rol global JCA/JCD", punto —
  // independiente de si ese JCA/JCD es también revisor/aprobador de ESTE documento (design.md D2).
  const canCreateVersion = documento.estado === 'PUBLICADO' && (isAutor || isJefeCalidad)
  const canStartNewVersion = documento.estado === 'EN_REVISION_PERIODICA' && (isAutor || isJefeCalidad)

  const { data: versionesData } = useDocumentsByCode(
    documento.codigo,
    !documento.deletedAt && (canCreateVersion || canStartNewVersion),
  )
  const otraVersionEnProceso = (versionesData?.items ?? []).find(
    (d) => d.id !== documento.id && !d.deletedAt && IN_PROCESS_STATUSES.has(d.estado),
  )

  const hasAnyAction =
    canVerDocumento || canDescargarCopia ||
    canSendToReview || canSendToReviewBloqueadoPorAsignacion || canDelete || canApproveReview || canRejectReview ||
    canCancelReview || canSign || canRejectAprobacion || canStartPeriodic ||
    canCreateVersion || canStartNewVersion

  // Un documento eliminado nunca ofrece ninguna acción normal — solo el banner + restaurar,
  // que vive fuera de esta lista de banderas (ver `isDeleted`/`canRestore` arriba). Esto replica
  // el `return` anticipado que existía inline en DocumentActionPanel antes de esta extracción.
  if (isDeleted) {
    return { isDeleted, canRestore, ...EMPTY_AVAILABILITY_FLAGS }
  }

  return {
    isDeleted,
    canRestore,
    canVerDocumento,
    canDescargarCopia,
    faltaAsignacion,
    canSendToReview,
    canSendToReviewBloqueadoPorAsignacion,
    canDelete,
    canApproveReview,
    canRejectReview,
    canCancelReview,
    canSign,
    canRejectAprobacion,
    canStartPeriodic,
    canCreateVersion,
    canStartNewVersion,
    otraVersionEnProceso,
    hasAnyAction,
  }
}
