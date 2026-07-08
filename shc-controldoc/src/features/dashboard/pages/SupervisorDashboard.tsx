import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { PanelPendientesAreaWidget } from '../components/PanelPendientesAreaWidget'
import { QEPorTipoWidget } from '../components/QEPorTipoWidget'
import { ACsVencidasWidget } from '../components/ACsVencidasWidget'
import { IncidentesRecientesWidget } from '../components/IncidentesRecientesWidget'

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft"
        />
      ))}
    </div>
  )
}

export function SupervisorDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  return (
    <PageWrapper title={t('supervisor.title')}>
      {isLoading || !data || data.rol !== 'SUPERVISOR' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          <PanelPendientesAreaWidget
            qesEnVerificacionArea={data.data.qesEnVerificacionArea}
            accionesCorrectivasPendientesArea={data.data.accionesCorrectivasPendientesArea}
          />
          <QEPorTipoWidget qeAbiertosPorTipo={data.data.qeAbiertosPorTipo} />
          <ACsVencidasWidget accionesCorrectivasVencidas={data.data.accionesCorrectivasVencidas} />
          <IncidentesRecientesWidget incidentesRecientes={data.data.incidentesRecientes} />
        </div>
      )}
    </PageWrapper>
  )
}
