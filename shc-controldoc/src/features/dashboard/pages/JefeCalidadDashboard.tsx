import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { KpiGridWidget } from '../components/KpiGridWidget'
import { QEPorEstadoWidget } from '../components/QEPorEstadoWidget'
import { ACsPorVencerWidget } from '../components/ACsPorVencerWidget'
import { TendenciaMensualWidget } from '../components/TendenciaMensualWidget'

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function JefeCalidadDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  return (
    <PageWrapper title={t('jefeCalidad.title')}>
      {isLoading || !data || data.rol !== 'JEFE_CALIDAD' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          <KpiGridWidget kpis={data.data.kpis} />
          <QEPorEstadoWidget qePorEstado={data.data.qePorEstado} />
          <ACsPorVencerWidget accionesCorrectivasPorVencer={data.data.accionesCorrectivasPorVencer} />
          <TendenciaMensualWidget
            tendenciaMensualVolumen={data.data.tendenciaMensualVolumen}
            tendenciaMensualKpis={data.data.tendenciaMensualKpis}
          />
        </div>
      )}
    </PageWrapper>
  )
}
