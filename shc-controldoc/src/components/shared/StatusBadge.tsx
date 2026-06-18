import { useTranslation } from 'react-i18next'
import type { DocStatus } from '../../types/documents.types'
import type { QEStatus } from '../../types/qualityEvents.types'

interface StatusBadgeProps {
  status: DocStatus | QEStatus
}

const DOC_STATUS_CLASSES: Partial<Record<DocStatus, string>> = {
  BORRADOR:
    'bg-muted/20 text-muted dark:bg-muted/10 dark:text-on-dark-soft',
  EN_REVISION:
    'bg-amber/20 text-amber dark:bg-amber/15 dark:text-amber',
  EN_APROBACION:
    'bg-coral/20 text-coral dark:bg-coral/15 dark:text-coral',
  PUBLICADO:
    'bg-success/20 text-success dark:bg-success/15 dark:text-success',
  OBSOLETO:
    'bg-error/20 text-error line-through dark:bg-error/15 dark:text-error',
  EN_REVISION_PERIODICA:
    'bg-teal/20 text-teal dark:bg-teal/15 dark:text-teal',
}

const DEFAULT_CLASSES = 'bg-muted/20 text-muted dark:bg-muted/10 dark:text-on-dark-soft'

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation('common')

  const colorClasses =
    (DOC_STATUS_CLASSES as Record<string, string | undefined>)[status] ?? DEFAULT_CLASSES

  return (
    <span
      className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}
    >
      {t(`statuses.${status}`, { defaultValue: status })}
    </span>
  )
}
