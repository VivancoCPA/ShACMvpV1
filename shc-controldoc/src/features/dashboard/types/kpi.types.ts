export type KpiId =
  | 'KPI-01'
  | 'KPI-02'
  | 'KPI-03'
  | 'KPI-04'
  | 'KPI-05'
  | 'KPI-06'
  | 'KPI-07'
  | 'KPI-08'
  | 'KPI-09'

export type KpiUnidad = 'PORCENTAJE' | 'DIAS' | 'TASA' | 'CONTEO' | 'DISTRIBUCION'

export type KpiFrecuencia = 'MENSUAL' | 'TRIMESTRAL' | 'TIEMPO_REAL'

export type KpiMetaTipo = 'ABSOLUTO' | 'REDUCCION_INTERANUAL'

// Sentido de mejora de la meta (espejo de DashboardKpiConstants.Definiciones del backend, que no
// lo envía por la API) — dashboard-layout-4-zonas design.md D4. null = informativo (KPI-09).
export type KpiDireccion = 'MAYOR_MEJOR' | 'MENOR_MEJOR'

// Período del filtro de indicadores (?periodo= de la URL), no el string de la API.
export type KpiPeriodoTipo = 'mes' | 'trimestre' | 'anio'

export interface KpiDefinition {
  id: KpiId
  nombre: string
  descripcion: string
  formula: string
  unidad: KpiUnidad
  metaTipo: KpiMetaTipo
  meta: number
  direccion: KpiDireccion | null
  frecuencia: KpiFrecuencia
  fuente: string
}

export interface KpiResult {
  kpiId: KpiId
  valor: number
  meta: number
  metaTipo: KpiMetaTipo
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' | 'INFORMATIVO'
  periodo: string
  calculadoEn: string
  valorPeriodoAnterior?: number | null
  distribucion?: { area: string; valor: number }[]
  // Solo KPI-04: a algún mes del período le faltan horas trabajadas cargadas.
  datosIncompletos?: boolean
}
