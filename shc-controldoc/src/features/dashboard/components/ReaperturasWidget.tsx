import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { QEReaperturaResumen } from '../types/dashboardSummary.types'

interface ReaperturasWidgetProps {
  reaperturas: QEReaperturaResumen[]
}

export function ReaperturasWidget({ reaperturas }: ReaperturasWidgetProps) {
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('altaDireccion.reaperturas.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {reaperturas.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('altaDireccion.reaperturas.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {reaperturas.map((qe) => (
              <button
                key={qe.id}
                type="button"
                onClick={() => navigate(`/quality-events/${qe.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{qe.numero}</p>
                  <p className="truncate text-sm text-muted dark:text-on-dark-soft">
                    {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                      new Date(qe.fechaReapertura),
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-pill bg-error/15 px-2 py-0.5 text-xs font-medium text-error dark:bg-error/20 dark:text-error">
                  {t('altaDireccion.reaperturas.ciclo', { ciclo: qe.ciclo })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
