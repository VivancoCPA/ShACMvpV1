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

export interface KpiDefinition {
  id: KpiId
  nombre: string
  descripcion: string
  formula: string
  unidad: KpiUnidad
  metaTipo: KpiMetaTipo
  meta: number
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
  valorPeriodoAnterior?: number
  distribucion?: { area: string; valor: number }[]
}
