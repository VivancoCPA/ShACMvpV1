import type { AccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'
import type { DocStatus } from '../../../types/documents.types'

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

/** Archivo de evidencia de la ejecución de una AC (ac-ejecucion-verificacion-evidencias). */
export interface EvidenciaACQE {
  id: string
  nombreArchivo: string
  contentType: string
  tamanioBytes: number
  subidoEn: string
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
  /** PRD §2.2 — obligatorio al crear, no editable (ac-tipo-responsables). */
  tipo: AccionCorrectivaTipo
  /** COMPLETADA = ejecutada por el responsable, pendiente de verificación del JCA. */
  estado: 'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'
  creadoEn: string
  actualizadoEn: string
  descripcionEvidencia?: string
  /** Solo histórico (AC cerradas antes de las evidencias de archivo). */
  evidenciaUrl?: string | null
  fechaCierre?: string
  ejecutadaEn?: string | null
  ejecutadaPorNombre?: string | null
  verificadaEn?: string | null
  verificadaPorNombre?: string | null
  motivoDevolucion?: string | null
  evidencias?: EvidenciaACQE[]
  solicitudesAjustePlazo: SolicitudAjustePlazoAC[]
}

export interface DocumentoVinculadoResumen {
  id: string
  codigo: string
  titulo: string
  estado: DocStatus
}

export interface SupervisorAreaQE {
  id: string
  nombreCompleto: string
  avatarUrl?: string | null
}

// qe-siguiente-paso-responsable — calculado por QESiguientePasoResolver (backend), solo en el detalle.
export type QESiguientePasoCodigo =
  | 'ASIGNAR_RESPONSABLE'
  | 'INICIAR_INVESTIGACION'
  | 'COMPLETAR_ANALISIS'
  | 'APROBAR_CAUSA_RAIZ'
  | 'INICIAR_EJECUCION'
  | 'EJECUTAR_ACS'
  | 'REGISTRAR_RESULTADO_CIERRE'
  | 'FIRMA_JCA'
  | 'FIRMA_SUPERVISOR'
  // qe-reapertura-reinicia-cierre D3: las dos firmas en PENDIENTE_CIERRE (datos arrastrados).
  | 'CIERRE_INCONSISTENTE'
  | 'ESPERA_VERIFICACION'
  | 'VERIFICAR_EFICACIA'
  | 'FINALIZADO'

export interface ResponsablePasoQE {
  id: string
  nombreCompleto: string
  rol?: string | null
  avatarUrl?: string | null
}

export interface QESiguientePaso {
  paso: QESiguientePasoCodigo
  responsables: ResponsablePasoQE[]
  estadoDesde: string
  plazoFecha?: string | null
  plazoRegla?: string | null
  progreso?: number | null
  total?: number | null
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
  areaId: string
  empresaId: string
  turno: 'DIA' | 'TARDE' | 'NOCHE'
  fechaHoraEvento: string
  fechaHoraReporte: string
  reportadoPorId: string
  documentosVinculados: DocumentoVinculadoResumen[]
  requiereEvaluacionRiesgos: boolean
  solicitudesAC: number
  accionesCorrectivas: AccionCorrectivaQE[]
  auditTrail: QEAuditTrailEntry[]
  creadoEn: string
  actualizadoEn: string
  mineralInvolucrado?: string
  ncId?: string
  incidenteId?: string
  // Responsable de la investigación (backend: QualityEvent.ResponsableInvestigacionId). Antes de
  // fs-vinculacion-documento-qe solo existía como valor de referencia dentro de entradas de audit
  // trail (`campoModificado: 'responsableInvestigacionId'`), nunca como campo vivo del tipo — se
  // agrega aquí porque puedeVincularDocumentos (qualityEventPermissions.ts) lo necesita real.
  responsableInvestigacionId?: string
  // Nombre resuelto por el backend con LEFT JOIN (qe-precarga-incidente-responsable D6) — un
  // SUPERVISOR no puede listar usuarios, así que el frontend no lo resuelve por su cuenta.
  responsableInvestigacionNombre?: string
  responsableInvestigacionAvatarUrl?: string
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
  // qe-cierre-firma-supervisor-area: nombres de los firmantes (LEFT JOIN en el detalle) y quién puede
  // dar la segunda firma — supervisoresArea solo viene en PENDIENTE_CIERRE.
  cerradoPorNombre?: string
  cierreFirmaSupervisorNombre?: string
  supervisoresArea?: SupervisorAreaQE[] | null
  // Siguiente paso pendiente (qe-siguiente-paso-responsable) — solo en el detalle.
  siguientePaso?: QESiguientePaso | null
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
  search?: string
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

// causaRaizAprobadaPorId/causaRaizFirmadaEn fuera: solo los escribe POST /:id/aprobar-causa-raiz
// con PIN verificado en el servidor (qe-analisis-causa-raiz-fix).
export type QualityEventUpdateInput = Partial<Pick<QualityEvent,
  | 'descripcion'
  | 'areaId'
  | 'turno'
  | 'mineralInvolucrado'
  | 'descripcionAmpliada'
  | 'metodoAnalisis'
  | 'cincoPorques'
  | 'ishikawa'
  | 'causaRaizDefinitiva'
  | 'resultadoCierre'
  | 'plazoVerificacionDias'
  | 'fechaVerificacionProgramada'
>> & {
  /** qe-asistente-ia: qué valores enviados vienen de una sugerencia del asistente IA (audit trail). */
  origenIA?: OrigenIA
}

// ─── Asistente IA (qe-asistente-ia, PRD §1.7) ─────────────────────────────────

/** 'IA' = valor tal cual lo sugirió la IA; 'IA_EDITADO' = el usuario lo modificó después de usarlo. */
export type OrigenIAValor = 'IA' | 'IA_EDITADO'

export interface OrigenIA {
  causaRaiz?: OrigenIAValor
  cincoPorques?: OrigenIAValor
  ishikawa?: OrigenIAValor
}

/**
 * GET /api/config/funcionalidades — asistenteIA es false si el servidor no tiene clave configurada
 * (salvo en modo simulado, que no la necesita). asistenteIASimulado es true solo con
 * Anthropic:Proveedor = "Simulado": la sugerencia es fija, no real.
 */
export interface Funcionalidades {
  asistenteIA: boolean
  asistenteIASimulado: boolean
}

export type TipoAccionSugeridaIA = 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA'

export interface AccionSugeridaIA {
  descripcion: string
  tipo: TipoAccionSugeridaIA
  rolResponsableSugerido: string
  plazoDiasHabiles: number
}

/**
 * POST /api/quality-events/:id/asistente-ia — nunca se guarda sola en el QE. Solo trae la lista
 * del método pedido (qe-asistente-ia-ishikawa); la otra llega como null.
 */
export interface SugerenciaCausaRaizIA {
  causaRaizProbable: string
  cincoPorques?: CincoPorques[] | null
  ishikawa?: Ishikawa[] | null
  accionesSugeridas: AccionSugeridaIA[]
  modelo: string
  generadoEn: string
}

// GET /api/quality-events/candidatos-responsable — SUPERVISOR y JEFE_CALIDAD_SYST activos de la
// empresa (qe-precarga-incidente-responsable).
export interface CandidatoResponsableQE {
  id: string
  nombreCompleto: string
  rol: 'SUPERVISOR' | 'JEFE_CALIDAD_SYST'
  avatarUrl?: string | null
}
