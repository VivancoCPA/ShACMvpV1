import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { IncidentTypeBadge } from '../../incidents/components/IncidentTypeBadge'
import type { NCSeveridad } from '../../nonconformities/types/nonconformity.types'
import type { IncidenteResumen } from '../types/dashboardSummary.types'

interface IncidentesRecientesWidgetProps {
  incidentesRecientes: IncidenteResumen[]
}

export function IncidentesRecientesWidget({ incidentesRecientes }: IncidentesRecientesWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('supervisor.incidentesRecientes.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {incidentesRecientes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('supervisor.incidentesRecientes.empty')}
          </p>
        ) : (
          <div className="space-y-2 p-3">
            {incidentesRecientes.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => navigate(`/incidents/${inc.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{inc.numero}</p>
                  <IncidentTypeBadge type={inc.tipo} />
                </div>
                <SeverityBadge severity={inc.severidad as NCSeveridad} className="shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
