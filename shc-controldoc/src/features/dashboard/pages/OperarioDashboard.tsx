import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { MisQEsWidget } from '../components/MisQEsWidget'
import { MisACsWidget } from '../components/MisACsWidget'

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

export function OperarioDashboard() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { data, isLoading } = useDashboardSummary()

  const actions = (
    <button
      type="button"
      onClick={() => navigate('/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO')}
      className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      {t('operario.crearReporte')}
    </button>
  )

  return (
    <PageWrapper title={t('operario.title')} actions={actions}>
      <div className="mb-8">
        <AccionesRequeridasWidget />
      </div>
      {isLoading || !data || data.rol !== 'OPERARIO' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          <MisQEsWidget misQEReportados={data.data.misQEReportados} />
          <MisACsWidget accionesCorrectivasAsignadas={data.data.accionesCorrectivasAsignadas} />
        </div>
      )}
    </PageWrapper>
  )
}
