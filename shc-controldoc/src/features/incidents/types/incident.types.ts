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
  titulo?: string
  descripcion: string
  responsableId: string
  responsableNombre: string
  plazoFecha: string
  prioridad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  estado: 'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'
  creadoEn: string
  actualizadoEn: string
  descripcionEvidencia?: string
  evidenciaUrl?: string
  fechaCierre?: string
  /** Modelo B: referencia al Quality Event que ahora posee la continuación de esta AC */
  qeId?: string
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

export interface Local {
  id: string
  nombre: string
  codigo: string
  activo: boolean
  creadoEn: string
  actualizadoEn: string
  direccion?: string
  planoPngUrl?: string
}

export interface Zona {
  id: string
  localId: string
  nombre: string
  codigo: string
  activo: boolean
  creadoEn: string
  actualizadoEn: string
  descripcion?: string
}

export interface IncidenteUbicacion {
  x: number
  y: number
}

export interface Incidente {
  id: string
  numero: string
  tipo: IncidentType
  estado: IncidentStatus
  severidad: IncidentSeveridad
  descripcion: string
  /** FK a `Area.id` del catálogo administrado (M6-S08, `area-admin-mocks`). Antes de M6-S08 este
   * campo almacenaba el nombre libre del área (sourced de `AREAS_SHAC`, ahora eliminado); su
   * significado cambió a un identificador de catálogo opaco aunque el nombre del campo no cambió.
   * Resolver el nombre visible vía `useAreas()`/`useArea(id)`, nunca mostrar `areaId` crudo. */
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
  localId?: string
  zonaId?: string
  ubicacion?: IncidenteUbicacion
  localNombre?: string
  zonaNombre?: string
}
