import type { AccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'

// Listado unificado de AC (QE, NC, incidente) — GET /api/acciones-correctivas (modulo-acciones-correctivas).

export type ACEstadoNormalizado = 'PENDIENTE' | 'EN_EJECUCION' | 'PENDIENTE_VERIFICACION' | 'CERRADA'
export type ACOrigenTipo = 'QE' | 'NC' | 'INCIDENTE'
export type ACListadoOrden = 'plazo' | 'creado' | 'estado'

export const AC_ESTADOS_NORMALIZADOS: readonly ACEstadoNormalizado[] = [
  'PENDIENTE',
  'EN_EJECUCION',
  'PENDIENTE_VERIFICACION',
  'CERRADA',
]
export const AC_ORIGEN_TIPOS: readonly ACOrigenTipo[] = ['QE', 'NC', 'INCIDENTE']

export interface AccionCorrectivaListadoItem {
  id: string
  origenTipo: ACOrigenTipo
  origenId: string
  origenNumero: string
  titulo: string
  descripcion: string
  tipo: AccionCorrectivaTipo
  prioridad: string
  responsableId: string
  responsableNombre: string
  areaId: string
  areaNombre: string | null
  /** Fecha de calendario (medianoche UTC). */
  plazoFecha: string
  estadoNormalizado: ACEstadoNormalizado
  /** Estado de la tabla de origen (incluye COMPLETADA y VENCIDA de NC). */
  estadoOriginal: string
  ejecutadaEn: string | null
  verificadaEn: string | null
  verificadaPorNombre: string | null
  creadoEn: string
  fechaCierre: string | null
  /** Misma regla que KPI-08 (EsAcVencida). */
  vencida: boolean
  /** Con signo: negativo cuando el plazo ya pasó. */
  diasHabilesRestantes: number
}

export interface ACListadoFiltros {
  estado?: ACEstadoNormalizado[]
  vencida?: boolean
  porVencer?: boolean
  tipo?: AccionCorrectivaTipo
  origenTipo?: ACOrigenTipo
  responsableId?: string
  areaId?: string
  plazoDesde?: string
  plazoHasta?: string
  creadaDesde?: string
  creadaHasta?: string
  cerradaDesde?: string
  cerradaHasta?: string
  search?: string
  orden?: ACListadoOrden
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface ACListadoContadores {
  abiertas: number
  enEjecucion: number
  pendientesVerificacion: number
  porVencer: number
  vencidas: number
  cerradasPeriodo: number
}

export interface ACListadoPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ACListadoResponse {
  items: AccionCorrectivaListadoItem[]
  pagination: ACListadoPagination
  contadores: ACListadoContadores
}

export interface ACOrigen {
  origenTipo: ACOrigenTipo
  origenId: string
}
