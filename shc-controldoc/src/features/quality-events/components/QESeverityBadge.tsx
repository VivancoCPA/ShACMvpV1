import { QE_SEVERITY_COLORS, QE_SEVERITY_LABELS } from '../../../constants/shared.constants'
import type { QESeverity } from '../types/qualityEvent.types'

interface QESeverityBadgeProps {
  severity: QESeverity
  className?: string
}

export function QESeverityBadge({ severity, className }: QESeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium ${QE_SEVERITY_COLORS[severity]}${className ? ` ${className}` : ''}`}
    >
      {QE_SEVERITY_LABELS[severity]}
    </span>
  )
}
