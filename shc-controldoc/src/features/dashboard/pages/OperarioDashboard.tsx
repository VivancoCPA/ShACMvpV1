import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'
import { MisQEsWidget } from '../components/MisQEsWidget'
import { MisACsWidget } from '../components/MisACsWidget'
import { useNotifications } from '../../notifications/hooks/useNotifications'
import { NotificationList } from '../../notifications/components/NotificationList'

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
  const { data: notifications = [] } = useNotifications()

  const notificacionesOrdenadas = [...notifications].sort((a, b) => {
    if (a.leida !== b.leida) return a.leida ? 1 : -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

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

      <section className="mt-8 rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <h2 className="border-b border-hairline px-6 py-4 text-base font-medium text-ink dark:border-hairline/20 dark:text-on-dark">
          {t('operario.notificacionesPendientes.title')}
        </h2>
        <NotificationList
          notifications={notificacionesOrdenadas}
          emptyMessage={t('operario.notificacionesPendientes.empty')}
        />
      </section>
    </PageWrapper>
  )
}
