import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiResult, KpiUnidad } from '../types/kpi.types'
import type { DashboardExportI18n, DashboardExportMeta, DashboardExportSection } from './dashboardExport.types'

export function formatKpiValor(valor: number, unidad: KpiUnidad): string {
  switch (unidad) {
    case 'PORCENTAJE':
      return `${valor.toFixed(1)}%`
    case 'DIAS':
      return `${valor.toFixed(1)} d`
    case 'TASA':
      return valor.toFixed(2)
    case 'CONTEO':
      return Math.round(valor).toString()
    case 'DISTRIBUCION':
      return Math.round(valor).toString()
  }
}

export function formatKpiMeta(kpiResult: KpiResult): string {
  const definicion = KPI_DEFINITIONS[kpiResult.kpiId]
  return kpiResult.metaTipo === 'REDUCCION_INTERANUAL'
    ? `-${kpiResult.meta}%`
    : formatKpiValor(kpiResult.meta, definicion.unidad)
}

export function formatFecha(fecha: string | undefined, i18n: DashboardExportI18n): string {
  if (!fecha) return '—'
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(fecha))
}

export function formatFechaHora(fecha: Date, i18n: DashboardExportI18n): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(fecha)
}

export function sectionPeriodoLabel(
  section: DashboardExportSection,
  meta: DashboardExportMeta,
  i18n: DashboardExportI18n,
): string {
  if (section.id === 'heatmap' && meta.heatmapRangoMeses !== undefined) {
    return i18n.t('dashboard:export.periodo.heatmap', { meses: meta.heatmapRangoMeses })
  }
  return i18n.t('dashboard:export.periodo.snapshot')
}
