import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { KpisEjecutivosWidget } from '../components/KpisEjecutivosWidget'
import { ComparativaMensualWidget } from '../components/ComparativaMensualWidget'
import { QEsCriticosWidget } from '../components/QEsCriticosWidget'
import { ReaperturasWidget } from '../components/ReaperturasWidget'
import { ACsExtensionPlazoWidget } from '../components/ACsExtensionPlazoWidget'
import { HeatmapIncidentesWidget } from '../components/HeatmapIncidentesWidget'

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function AltaDireccionDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  return (
    <PageWrapper title={t('altaDireccion.title')}>
      <div className="mb-8">
        <AccionesRequeridasWidget />
      </div>
      {isLoading || !data || data.rol !== 'ALTA_DIRECCION' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          <KpisEjecutivosWidget
            resumenQE={data.data.resumenPorModulo.qualityEvents}
            kpis={data.data.kpisEstrategicos}
          />
          <ComparativaMensualWidget comparativaMensual={data.data.comparativaMensual} />
          <QEsCriticosWidget alertasCriticas={data.data.alertasCriticas} />
          <ReaperturasWidget reaperturas={data.data.reaperturas} />
          <ACsExtensionPlazoWidget acs={data.data.acsConSolicitudAjustePlazo} />
          <HeatmapIncidentesWidget />
        </div>
      )}
    </PageWrapper>
  )
}
