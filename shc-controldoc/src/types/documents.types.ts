import type { QEType, QESeverity, QEStatus } from '../features/quality-events/types/qualityEvent.types'
import type { NCTipo, NCSeveridad, NCStatus } from '../features/nonconformities/types/nonconformity.types'
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

// Roles elegibles como lector autorizado de un documento RESTRINGIDO/CONFIDENCIAL.
// Excluye deliberadamente ADMINISTRADOR_SISTEMA, ADMINISTRADOR_EMPRESA y
// SUPERADMIN — ningún rol de sistema o multi-empresa tiene acceso a M1
// Control Documentario (ver CLAUDE.md).
export type DocumentAuthorizedRole =
  | 'OPERARIO'
  | 'SUPERVISOR'
  | 'JEFE_CALIDAD_SYST'
  | 'JEFE_CONTROL_DOCUMENTARIO'
  | 'AUDITOR_INTERNO'
  | 'ALTA_DIRECCION'

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
  canViewArchivoOriginal: boolean
  canReplaceArchivoOriginal: boolean
  canViewArchivoDistribucion: boolean
}

export interface QeVinculadoResumen {
  id: string
  numero: string
  tipo: QEType
  severidad: QESeverity
  estado: QEStatus
}

export interface NcVinculadoResumen {
  id: string
  numero: string
  tipo: NCTipo
  severidad: NCSeveridad
  estado: NCStatus
}

// entidadTipo/entidadId/ipOrigen son opcionales (no eliminados): DocumentoAuditTrail.cs no tiene
// columnas equivalentes y el backend real nunca los envía — fix-detalle-documento-historial-audit.
export interface AuditTrailEntry {
  id: string
  entidadTipo?: 'Documento' | 'NoConformidad'
  entidadId?: string
  accion: string
  estadoAnterior?: string
  estadoNuevo?: string
  campoModificado?: string
  valorAnterior?: string
  valorNuevo?: string
  motivo?: string
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
  areaId: string
  empresaId: string
  confidencialidad: DocConfidencialidad
  rolesAutorizados?: DocumentAuthorizedRole[]
  autorId: string
  // string | null (no solo string | undefined): el backend real serializa un Guid? vacío como
  // JSON null explícito — nueva-version-autor-permisos (herencia condicionada en nueva versión
  // deja estos campos en null cuando el heredado ya no es válido para el nuevo autor).
  revisorId?: string | null
  aprobadorId?: string | null
  // string | null (no solo string | undefined): el backend real serializa un DateTime? vacío
  // como JSON null explícito, nunca como clave ausente (fix-fechas-utc).
  fechaEmision?: string | null
  fechaVigencia?: string | null
  fechaRevisionProxima?: string | null
  fechaObsolescencia?: string
  motivoVersion?: string
  descripcion?: string
  archivoUrl?: string
  tipoArchivo?: string
  hashArchivo?: string
  archivoOriginalUrl: string | null
  archivoOriginalNombre: string | null
  archivoOriginalBloqueado: boolean
  archivoDistribucionUrl: string | null
  versionAnteriorId?: string
  deletedAt?: string
  qeVinculados: QeVinculadoResumen[]
  ncVinculados: NcVinculadoResumen[]
  auditTrail: AuditTrailEntry[]
  creadoEn: string
  actualizadoEn: string
}

export interface DocFilters {
  estado?: DocStatus
  tipo?: DocType
  areaId?: string
  autorId?: string
  search?: string
  codigo?: string
  page?: number
  pageSize?: number
  includeDeleted?: boolean
  pendientes?: boolean
}

// Candidato a Revisor/Aprobador (GET /api/documents/candidatos-asignacion). Solo lo necesario
// para poblar un <select> — el backend no expone email ni avatar.
export type TipoAsignacion = 'REVISOR' | 'APROBADOR'

export interface CandidatoAsignacion {
  id: string
  nombreCompleto: string
  rol: UserRole
}
