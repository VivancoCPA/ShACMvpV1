import { useTranslation } from 'react-i18next'
import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiId, KpiResult } from '../types/kpi.types'
import { KpiRingCard } from './layout/KpiRingCard'
import { ultimosValores, type TendenciasKpi } from '../utils/kpiRing.utils'

const KPI_IDS_EJECUTIVOS: KpiId[] = ['KPI-01', 'KPI-04', 'KPI-05']

interface KpisEjecutivosWidgetProps {
  resumenQE: { abiertos: number; vencidos: number }
  kpis: KpiResult[]
  tendencias?: TendenciasKpi
}

function ConteoCard({ testId, titulo, valor }: { testId: string; titulo: string; valor: number }) {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 flex-col justify-center rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      <p className="text-xs font-medium text-muted dark:text-on-dark-soft">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-ink dark:text-on-dark">{valor}</p>
    </div>
  )
}

// 2 conteos sin meta + 3 anillos (KPI-01/04/05), sin <section> propio: el label lo pone la zona
// "Indicadores" de DashboardLayout (dashboard-layout-4-zonas design.md D7).
export function KpisEjecutivosWidget({ resumenQE, kpis, tendencias }: KpisEjecutivosWidgetProps) {
  const { t } = useTranslation('dashboard')
  const kpisEjecutivos = KPI_IDS_EJECUTIVOS.map((id) => kpis.find((k) => k.kpiId === id)).filter(
    (k): k is KpiResult => !!k,
  )

  return (
    <>
      <ConteoCard testId="kpi-card-qes-abiertos" titulo={t('altaDireccion.kpisEjecutivos.qesAbiertos')} valor={resumenQE.abiertos} />
      <ConteoCard testId="kpi-card-qes-vencidos" titulo={t('altaDireccion.kpisEjecutivos.qesVencidos')} valor={resumenQE.vencidos} />
      {kpisEjecutivos.map((kpiResult) => (
        <KpiRingCard
          key={kpiResult.kpiId}
          kpi={kpiResult}
          definicion={KPI_DEFINITIONS[kpiResult.kpiId]}
          tendencia={ultimosValores(tendencias, kpiResult.kpiId)}
        />
      ))}
    </>
  )
}
