import type { UserRole } from '../../../types/auth.types'

export type NCStatus =
  | 'ABIERTA'
  | 'EN_INVESTIGACION'
  | 'ANALISIS_COMPLETADO'
  | 'EN_EJECUCION'
  | 'PENDIENTE_CIERRE'
  | 'CERRADA'
  | 'ANULADA'

export type NCOrigen =
  | 'INSPECCION_INTERNA'
  | 'AUDITORIA_INTERNA'
  | 'AUDITORIA_EXTERNA'
  | 'CLIENTE_RECLAMO'
  | 'OPERACION_CAMPO'
  | 'CONTROL_PROCESO'

export type NCTipo = 'PROCESO' | 'PRODUCTO' | 'SERVICIO' | 'SISTEMA' | 'SST'

export type NCSeveridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'

/** Área de negocio afectada — determina el prefijo del número NC-[DOMINIO_ABBR]-YYYY-NNN */
export type NCDominio = 'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL' | 'PROVEEDOR'

export type ACStatus = 'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'VENCIDA'

export interface AccionCorrectiva {
  id: string
  ncId: string
  descripcion: string
  responsableId: string
  plazoFecha: string
  estado: ACStatus
  creadoEn: string
  actualizadoEn: string
  descripcionEvidencia?: string
  evidenciaUrl?: string
  fechaCierre?: string
}

export interface NCNotificacionComercioExterior {
  fecha: string
  referencia: string
  descripcion: string
}

export type CreateACInput = {
  descripcion: string
  responsableId: string
  plazoFecha: string
}

export type UpdateACInput = Partial<
  Pick<AccionCorrectiva, 'descripcion' | 'responsableId' | 'plazoFecha' | 'estado'>
>

export type CerrarACInput = {
  descripcionEvidencia: string
  evidenciaUrl?: string
}

export interface NCPermissions {
  canRead: boolean
  canEdit: boolean
  canDelete: boolean
  canComment: boolean
  canIniciarInvestigacion: boolean
  canRegistrarCorreccion: boolean
  canSolicitarCierre: boolean
  canCerrar: boolean
  canReabrir: boolean
}

export interface NCFilters {
  estado?: NCStatus
  tipo?: NCTipo
  severidad?: NCSeveridad
  dominio?: NCDominio
  origen?: NCOrigen
  areaAfectada?: string
  reportadoPorId?: string
  search?: string
  fechaDesde?: string
  fechaHasta?: string
  page?: number
  pageSize?: number
}

export interface AuditTrailEntry {
  id: string
  entidadTipo: 'NoConformidad'
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

export interface NoConformidad {
  id: string
  /** Formato: NC-[DOMINIO_ABBR]-YYYY-NNN (e.g. NC-CAL-2025-001, NC-SST-2025-002) */
  numero: string
  dominio: NCDominio
  origen: NCOrigen
  tipo: NCTipo
  severidad: NCSeveridad
  estado: NCStatus
  descripcion: string
  areaAfectada: string
  reportadoPorId: string
  fechaDeteccion: string
  fechaReporte: string
  accionesCorrectivas: AccionCorrectiva[]
  documentosVinculados: string[]
  adjuntos: string[]
  auditTrail: AuditTrailEntry[]
  /** Fecha límite esperada de cierre de la NC (ISO 8601) — diferente del fechaCierre de AccionCorrectiva */
  fechaCierre?: string
  creadoEn: string
  actualizadoEn: string
  mineralInvolucrado?: string
  turno?: 'DIA' | 'TARDE' | 'NOCHE'
  responsableInvestigacionId?: string
  accionInmediata?: string
  accionInmediataFecha?: string
  correccion?: string
  correccionEvidenciaUrl?: string
  causaRaiz?: string
  corregidoPorId?: string
  verificadoPorId?: string
  fechaVerificacion?: string
  resultadoVerificacion?: 'EFECTIVO' | 'NO_EFECTIVO'
  qeGeneradoId?: string
  requiereIPER?: boolean
  notificacionComercioExterior?: NCNotificacionComercioExterior
}

export type { UserRole }
