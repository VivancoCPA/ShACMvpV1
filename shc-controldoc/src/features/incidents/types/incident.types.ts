export type IncidentType =
  | 'ACCIDENTE'
  | 'INCIDENTE'
  | 'CUASI_ACCIDENTE'
  | 'CONDICION_INSEGURA'

export type IncidentStatus =
  | 'ABIERTO'
  | 'EN_INVESTIGACION'
  | 'ANALISIS_COMPLETADO'
  | 'EN_EJECUCION'
  | 'PENDIENTE_CIERRE'
  | 'CERRADO'
  | 'ANULADO'

export type IncidentSeveridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'

export type IncidentTurno = 'DIA' | 'TARDE' | 'NOCHE' | 'TODOS'

export const CondicionEntornoValues = [
  'ILUMINACION',
  'PISO',
  'SENALIZACION',
  'EPP',
  'CLIMA',
  'OTRO',
] as const

export type CondicionEntorno = (typeof CondicionEntornoValues)[number]

export interface AuditTrailEntry {
  id: string
  entidadTipo: 'Incidente'
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

export interface AccionCorrectivaIncidente {
  id: string
  incidenteId: string
  descripcion: string
  responsableId: string
  fechaLimite: string
  estado: 'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'
  creadoEn: string
  actualizadoEn: string
  evidencia?: string
}

export interface IncidentEvidencia {
  id: string
  url: string
  nombre: string
  tipo: 'imagen' | 'pdf'
  tamanioKb: number
  creadoEn: string
  creadoPor: string
}

export interface Incidente {
  id: string
  numero: string
  tipo: IncidentType
  estado: IncidentStatus
  severidad: IncidentSeveridad
  descripcion: string
  areaId: string
  turno: IncidentTurno
  fechaEvento: string
  fechaReporte: string
  reportadoPorId: string
  huboLesionados: boolean
  auditTrail: AuditTrailEntry[]
  creadoEn: string
  actualizadoEn: string
  numPersonasAfectadas?: number
  personalInvolucrado?: string[]
  testigos?: string[]
  equiposInvolucrados?: string[]
  condicionesEntorno?: CondicionEntorno[]
  atencionMedicaRequerida?: boolean
  atencionMedicaDescripcion?: string
  notificacionAmbientalRequerida?: boolean
  informeMedicoAdjunto?: string
  evidencias?: IncidentEvidencia[]
  qeId?: string
  accionesCorrectivas?: AccionCorrectivaIncidente[]
  deletedAt?: string
}
