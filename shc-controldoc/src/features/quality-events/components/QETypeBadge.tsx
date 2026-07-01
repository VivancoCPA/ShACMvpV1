import { QE_TYPE_LABELS } from '../../../constants/shared.constants'
import type { QEType } from '../types/qualityEvent.types'

const TYPE_CLASSES: Record<QEType, string> = {
  CALIDAD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SST: 'bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber',
  ADUANERO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  OPERACIONAL: 'bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft',
}

interface QETypeBadgeProps {
  type: QEType
  className?: string
}

export function QETypeBadge({ type, className }: QETypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${TYPE_CLASSES[type]}${className ? ` ${className}` : ''}`}
    >
      {QE_TYPE_LABELS[type]}
    </span>
  )
}
