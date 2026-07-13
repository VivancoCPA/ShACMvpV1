export type DashboardExportSectionKind = 'kpis' | 'tabla' | 'grafico-tendencia'

export interface DashboardExportSection {
  id: string
  titulo: string
  kind: DashboardExportSectionKind
  headers: string[]
  rows: (string | number)[][]
  empty: boolean
}

export type DashboardExportRol = 'JEFE_CALIDAD_SYST' | 'ALTA_DIRECCION'

export interface DashboardExportMeta {
  rol: DashboardExportRol
  rolLabel: string
  usuario: string
  generadoEn: Date
  /** Rango (en meses) usado para la sección de Heatmap por Local, si el rol la incluye. */
  heatmapRangoMeses?: number
}

export interface HeatmapPorLocalEntry {
  local: string
  conteo: number
}

/** Subconjunto de i18next necesario para localizar el contenido de las secciones de export. */
export interface DashboardExportI18n {
  t(key: string, options?: Record<string, unknown>): string
  language: string
}
