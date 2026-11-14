import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiId, KpiResult } from '../types/kpi.types'
import { KpiRingCard } from './layout/KpiRingCard'
import { KPI_IDS_JEFE_CALIDAD, ultimosValores, type TendenciasKpi } from '../utils/kpiRing.utils'

interface KpiGridWidgetProps {
  kpis: KpiResult[]
  kpiIds?: KpiId[]
  tendencias?: TendenciasKpi
}

// Sin <section> ni título propio: la zona "Indicadores" de DashboardLayout ya pone el label y la
// grilla. Renderiza una KpiRingCard por cada id de `kpiIds` presente en `kpis`, en ese orden.
export function KpiGridWidget({ kpis, kpiIds = KPI_IDS_JEFE_CALIDAD, tendencias }: KpiGridWidgetProps) {
  return (
    <>
      {kpiIds.map((kpiId) => {
        const kpi = kpis.find((k) => k.kpiId === kpiId)
        if (!kpi) return null
        return (
          <KpiRingCard
            key={kpiId}
            kpi={kpi}
            definicion={KPI_DEFINITIONS[kpiId]}
            tendencia={ultimosValores(tendencias, kpiId)}
          />
        )
      })}
    </>
  )
}
