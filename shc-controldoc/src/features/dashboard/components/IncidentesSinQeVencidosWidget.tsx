import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { IncidentTypeBadge } from '../../incidents/components/IncidentTypeBadge'
import { getIncidentQEPlazoInfo } from '../../incidents/utils/incidentQEAlert'
import type { IncidenteResumen } from '../types/dashboardSummary.types'

interface IncidentesSinQeVencidosWidgetProps {
  incidentesSinQeVencidos: IncidenteResumen[]
  incidentesSinQeVencidosTotal: number
  now?: Date
}

// RN-INC-006 (incidentes-qe-estado-alertas D8): incidentes activos sin QE que superaron su
// plazo para vincularlo. El backend ya entrega como máximo 10, del más vencido al menos; el
// total sin límite va en el encabezado.
export function IncidentesSinQeVencidosWidget({
  incidentesSinQeVencidos,
  incidentesSinQeVencidosTotal,
  now,
}: IncidentesSinQeVencidosWidgetProps) {
  const { t } = useTranslation(['dashboard', 'incidents'])

  // Misma presentación que el tooltip de IncidentSinQEBadge: < 48 h → "X h"; desde 48 h → "X d Y h".
  const formatDuracion = (horas: number) =>
    horas < 48
      ? t('incidents:list.sinQEBadge.duracion.horas', { h: horas })
      : t('incidents:list.sinQEBadge.duracion.diasHoras', { d: Math.floor(horas / 24), h: horas % 24 })

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-body-strong dark:text-on-dark">
        {t('dashboard:incidentesSinQeVencidos.title')}
        {incidentesSinQeVencidosTotal > 0 && (
          <span className="rounded-pill bg-error/15 px-2 py-0.5 text-xs font-medium text-error dark:bg-error/15 dark:text-error">
            {incidentesSinQeVencidosTotal}
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        {incidentesSinQeVencidos.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('dashboard:incidentesSinQeVencidos.empty')}
          </p>
        ) : (
          <ul className="space-y-2 p-3">
            {incidentesSinQeVencidos.map((inc) => {
              const { horasRestantes } = getIncidentQEPlazoInfo(inc, now)
              return (
                <li key={inc.id}>
                  <Link
                    to={`/incidents/${inc.id}`}
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-elevated dark:hover:bg-surface-dark-soft"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{inc.numero}</p>
                      <IncidentTypeBadge type={inc.tipo} />
                    </div>
                    <span className="shrink-0 text-xs font-medium text-error dark:text-error">
                      {t('dashboard:incidentesSinQeVencidos.vencidoHace', {
                        duracion: formatDuracion(Math.abs(Math.min(horasRestantes, 0))),
                      })}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
