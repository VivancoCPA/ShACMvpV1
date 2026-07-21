import { useId } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { DOC_REVISION_ALERT_DAYS } from '../../../config/businessRules.config'

interface RevisionSemaforoProps {
  fechaRevisionProxima: string | undefined
}

export function RevisionSemaforo({ fechaRevisionProxima }: RevisionSemaforoProps) {
  const { t } = useTranslation('documents')
  const tooltipId = useId()

  if (fechaRevisionProxima === undefined) {
    return <span className="text-muted dark:text-on-dark-soft">—</span>
  }

  const diasRestantes = differenceInCalendarDays(parseISO(fechaRevisionProxima), new Date())

  if (diasRestantes > DOC_REVISION_ALERT_DAYS) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success dark:bg-success" />
      </span>
    )
  }

  if (diasRestantes >= 8) {
    return (
      <span className="group relative inline-flex items-center gap-1.5" aria-describedby={tooltipId}>
        <span className="h-2 w-2 rounded-full bg-warning dark:bg-warning" />
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-dark px-2 py-1 text-xs text-on-dark opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-surface-dark-elevated"
        >
          {t('semaforo.diasRestantes', { dias: diasRestantes })}
        </span>
      </span>
    )
  }

  if (diasRestantes >= 1) {
    return (
      <span className="group relative inline-flex items-center gap-1.5" aria-describedby={tooltipId}>
        <span className="h-2 w-2 rounded-full bg-error dark:bg-error" />
        <span className="rounded-[9999px] bg-error/20 px-1.5 py-0.5 text-xs font-medium text-error dark:bg-error/15 dark:text-error">
          {t('semaforo.proximo')}
        </span>
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-dark px-2 py-1 text-xs text-on-dark opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-surface-dark-elevated"
        >
          {t('semaforo.diasRestantes', { dias: diasRestantes })}
        </span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 animate-pulse rounded-full bg-error dark:bg-error" />
      <span className="rounded-[9999px] bg-error/20 px-1.5 py-0.5 text-xs font-medium text-error dark:bg-error/15 dark:text-error">
        {t('semaforo.vencido')}
      </span>
    </span>
  )
}
