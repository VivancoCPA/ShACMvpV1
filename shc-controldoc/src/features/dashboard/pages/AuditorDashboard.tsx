import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { HallazgosPorAreaWidget } from '../components/HallazgosPorAreaWidget'
import { HallazgosPorEstadoWidget } from '../components/HallazgosPorEstadoWidget'
import { EvidenciasHallazgosWidget } from '../components/EvidenciasHallazgosWidget'
import { TasaCierrePorAreaWidget } from '../components/TasaCierrePorAreaWidget'

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function AuditorDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  return (
    <PageWrapper title={t('auditor.title')}>
      <div className="mb-8">
        <AccionesRequeridasWidget />
      </div>
      {isLoading || !data || data.rol !== 'AUDITOR' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          <HallazgosPorAreaWidget hallazgosPorArea={data.data.hallazgosPorArea} />
          <HallazgosPorEstadoWidget hallazgosPorEstado={data.data.hallazgosPorEstado} />
          <EvidenciasHallazgosWidget evidenciasHallazgos={data.data.evidenciasHallazgos} />
          <TasaCierrePorAreaWidget tasaCierreEnPlazoPorArea={data.data.tasaCierreEnPlazoPorArea} />
        </div>
      )}
    </PageWrapper>
  )
}
