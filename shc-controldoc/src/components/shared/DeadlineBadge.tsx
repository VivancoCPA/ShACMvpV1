import { useTranslation } from 'react-i18next'
import { formatCalendarDate, calendarDaysUntil } from '../../utils/date.utils'

interface DeadlineBadgeProps {
  fechaCierre: string | null
  estado: string
}

const CLOSED_STATES = new Set(['CERRADA', 'ANULADA'])

export function DeadlineBadge({ fechaCierre, estado }: DeadlineBadgeProps) {
  const { i18n } = useTranslation()

  if (!fechaCierre) {
    return <span className="text-xs text-muted dark:text-on-dark-soft">—</span>
  }

  // fechaCierre (plazo de una Acción Correctiva de Incidente/NC/QE) es una fecha de calendario
  // (fix-fechas-utc) — se usa el par de helpers "sin zona" para que este badge, compartido por
  // los 3 dominios, no muestre un día de menos ni cuente un día de más/menos en zonas horarias
  // negativas (p.ej. Perú, UTC-5).
  const formatted = formatCalendarDate(fechaCierre, i18n.language)

  if (CLOSED_STATES.has(estado)) {
    return <span className="text-xs text-muted dark:text-on-dark-soft">{formatted}</span>
  }

  const daysRemaining = calendarDaysUntil(fechaCierre)

  let colorClass: string
  if (daysRemaining > 14) {
    colorClass = 'bg-success/15 text-success dark:bg-success/20'
  } else if (daysRemaining >= 0) {
    colorClass = 'bg-amber/15 text-amber dark:bg-amber/20'
  } else {
    colorClass = 'bg-error/15 text-error dark:bg-error/20'
  }

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {formatted}
    </span>
  )
}
