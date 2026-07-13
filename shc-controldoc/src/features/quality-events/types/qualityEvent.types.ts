export type QEOrigin =
  | 'O1_INCIDENTE_CAMPO'
  | 'O2_NC_DETECTADA'
  | 'O3_HALLAZGO_AUDITORIA'
  | 'O4_REPORTE_EXTERNO'

export type QEType = 'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'

export type QESeverity = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'

export type QEStatus =
  | 'ABIERTO'
  | 'EN_INVESTIGACION'
  | 'ANALISIS_COMPLETADO'
  | 'EN_EJECUCION'
  | 'PENDIENTE_CIERRE'
  | 'CERRADO'
  | 'EN_VERIFICACION'
  | 'VERIFICADO'
  | 'REABIERTO'

export type AnalisisCausaRaizMetodo = '5_PORQUES' | 'ISHIKAWA'

export type IshikawaCategoria =
  | 'METODO'
  | 'MAQUINA'
  | 'MATERIAL'
  | 'MANO_DE_OBRA'
  | 'MEDICION'
  | 'MEDIO_AMBIENTE'

export interface ReporteExternoRef {
  nombreCliente: string
  fechaRecepcion: string
}

export type NormaISO = 'ISO_9001_2015' | 'ISO_45001_2018' | 'OTRA'

export interface NormativaVinculada {
  norma: NormaISO
  clausula: string
  normaOtraDetalle?: string
}

export interface CincoPorques {
  pregunta: string
  respuesta: string
}

export interface Ishikawa {
  categoria: IshikawaCategoria
  causa: string
}

export interface QEAuditTrailEntry {
  id: string
  entidadTipo: 'QualityEvent'
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

export interface SolicitudAjustePlazoAC {
  id: string
  fechaSolicitada: string
  justificacion: string
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  solicitadoPorId: string
  solicitadoEn: string
  requiereAprobacionGerencia: boolean
  revisadoPorId?: string
  revisadoEn?: string
  comentarioRevision?: string
}

export interface AccionCorrectivaQE {
  id: string
  qeId: string
  titulo?: string
  descripcion: string
  responsableId: string
  responsableNombre: string
  plazoFecha: string
  prioridad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  estado: 'PENDIENTE' | 'EN_EJECUCION' | 'CERRADA'
  creadoEn: string
  actualizadoEn: string
  descripcionEvidencia?: string
  evidenciaUrl?: string
  fechaCierre?: string
  solicitudesAjustePlazo: SolicitudAjustePlazoAC[]
}

export interface QualityEvent {
  id: string
  numero: string
  origen: QEOrigin
  tipo: QEType
  severidad: QESeverity
  estado: QEStatus
  ciclo: number
  descripcion: string
  areaAfectada: string
  turno: 'DIA' | 'TARDE' | 'NOCHE'
  fechaHoraEvento: string
  fechaHoraReporte: string
  reportadoPorId: string
  documentosVinculados: string[]
  requiereEvaluacionRiesgos: boolean
  solicitudesAC: number
  accionesCorrectivas: AccionCorrectivaQE[]
  auditTrail: QEAuditTrailEntry[]
  creadoEn: string
  actualizadoEn: string
  mineralInvolucrado?: string
  ncId?: string
  incidenteId?: string
  hallazgoCodigo?: string
  normativaVinculada?: NormativaVinculada
  reporteExternoRef?: ReporteExternoRef
  descripcionAmpliada?: string
  metodoAnalisis?: AnalisisCausaRaizMetodo
  cincoPorques?: CincoPorques[]
  ishikawa?: Ishikawa[]
  causaRaizDefinitiva?: string
  causaRaizAprobadaPorId?: string
  causaRaizFirmadaEn?: string
  evaluacionRiesgosRef?: string
  resultadoCierre?: string
  cerradoPorId?: string
  cierreFirmaSupervisorId?: string
  cierreFirmaSupervisorRol?: 'SUPERVISOR' | 'ALTA_DIRECCION'
  fechaCierre?: string
  plazoVerificacionDias?: number
  fechaVerificacionProgramada?: string
  fechaVerificacionRealizada?: string
  verificadoPorId?: string
  resultadoVerificacion?: 'EFECTIVO' | 'NO_EFECTIVO'
  evidenciaVerificacion?: string
  auditorAsignadoId?: string
  deletedAt?: string
}

// fechaDesde / fechaHasta filter on fechaHoraEvento (event occurrence date), not fechaVerificacionProgramada
export interface QEListParams {
  estado?: QEStatus
  tipo?: QEType
  severidad?: QESeverity
  origen?: QEOrigin
  fechaDesde?: string
  fechaHasta?: string
  ciclo?: number
  soloReincidencias?: boolean
  incluirEliminados?: boolean
  page: number
  pageSize: number
}

export interface QEStatusTransitionInput {
  nuevoEstado: QEStatus
  comentario?: string
  firmaPin?: string
}

export type QualityEventUpdateInput = Partial<Pick<QualityEvent,
  | 'descripcion'
  | 'areaAfectada'
  | 'turno'
  | 'mineralInvolucrado'
  | 'descripcionAmpliada'
  | 'metodoAnalisis'
  | 'cincoPorques'
  | 'ishikawa'
  | 'causaRaizDefinitiva'
  | 'causaRaizAprobadaPorId'
  | 'causaRaizFirmadaEn'
  | 'resultadoCierre'
  | 'plazoVerificacionDias'
  | 'fechaVerificacionProgramada'
>>
