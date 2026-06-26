import { useTranslation } from 'react-i18next'

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

  const formatted = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fechaCierre))

  if (CLOSED_STATES.has(estado)) {
    return <span className="text-xs text-muted dark:text-on-dark-soft">{formatted}</span>
  }

  const daysRemaining = Math.floor(
    (new Date(fechaCierre).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

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
