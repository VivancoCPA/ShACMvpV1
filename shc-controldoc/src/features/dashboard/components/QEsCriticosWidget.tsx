import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { QEStatusBadge } from '../../quality-events/components/QEStatusBadge'
import type { QEResumen } from '../types/dashboardSummary.types'

interface QEsCriticosWidgetProps {
  alertasCriticas: QEResumen[]
}

export function QEsCriticosWidget({ alertasCriticas }: QEsCriticosWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('altaDireccion.qesCriticos.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {alertasCriticas.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('altaDireccion.qesCriticos.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {alertasCriticas.map((qe) => (
              <button
                key={qe.id}
                type="button"
                onClick={() => navigate(`/quality-events/${qe.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{qe.numero}</p>
                  <p className="truncate text-sm text-muted dark:text-on-dark-soft">{qe.areaAfectada}</p>
                </div>
                <QEStatusBadge status={qe.estado} className="shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
