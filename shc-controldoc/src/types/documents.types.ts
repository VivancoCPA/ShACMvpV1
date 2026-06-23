import type { UserRole } from './auth.types'

export type DocStatus =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'EN_APROBACION'
  | 'PUBLICADO'
  | 'OBSOLETO'
  | 'EN_REVISION_PERIODICA'

export type DocType = 'POL' | 'PRC' | 'INS' | 'REG' | 'INF' | 'MAT' | 'PLAN'

export type DocConfidencialidad = 'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO'

export type DocRole = 'AUTOR' | 'REVISOR' | 'APROBADOR' | 'JEFE_CALIDAD' | 'OPERARIO'

export interface DocumentPermissions {
  canRead: boolean
  canEdit: boolean
  canDelete: boolean
  canComment: boolean
  canApprove: boolean
  canReject: boolean
  canSign: boolean
  canStartReview: boolean
  canCancelReview: boolean
}

export interface VersionEntry {
  version: string
  fechaPublicacion: string
  autorId: string
  descripcionCambios: string
  hashArchivo?: string
}

export interface AuditTrailEntry {
  id: string
  entidadTipo: 'Documento'
  entidadId: string
  accion: string
  estadoAnterior?: string
  estadoNuevo?: string
  campoModificado?: string
  valorAnterior?: string
  valorNuevo?: string
  realizadoPorId: string
  realizadoPorNombre: string
  timestamp: string
  ipOrigen?: string
  generadoPorIA: boolean
}

export interface Documento {
  id: string
  codigo: string
  titulo: string
  tipo: DocType
  version: string
  estado: DocStatus
  area: string
  confidencialidad: DocConfidencialidad
  rolesAutorizados?: UserRole[]
  autorId: string
  revisorId?: string
  aprobadorId?: string
  fechaEmision?: string
  fechaVigencia?: string
  fechaRevisionProxima?: string
  fechaObsolescencia?: string
  motivoVersion?: string
  descripcion?: string
  archivoUrl?: string
  tipoArchivo?: string
  hashArchivo?: string
  versionAnteriorId?: string
  deletedAt?: string
  qeVinculados: string[]
  historialVersiones: VersionEntry[]
  auditTrail: AuditTrailEntry[]
  creadoEn: string
  actualizadoEn: string
}

export interface DocFilters {
  estado?: DocStatus
  tipo?: DocType
  area?: string
  autorId?: string
  search?: string
  codigo?: string
  page?: number
  pageSize?: number
  includeDeleted?: boolean
  pendientes?: boolean
}
