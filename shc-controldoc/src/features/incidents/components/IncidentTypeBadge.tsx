import { AlertTriangle, AlertCircle, AlertOctagon, ShieldAlert } from 'lucide-react'
import { INCIDENT_TYPE_LABELS } from '../../../constants/shared.constants'
import type { IncidentType } from '../types/incident.types'

const TYPE_CONFIG: Record<IncidentType, { icon: React.ElementType; color: string }> = {
  ACCIDENTE: { icon: AlertTriangle, color: 'bg-error/15 text-error dark:bg-error/15 dark:text-error' },
  INCIDENTE: { icon: AlertCircle, color: 'bg-coral/15 text-coral dark:bg-coral/15 dark:text-coral' },
  CUASI_ACCIDENTE: { icon: AlertOctagon, color: 'bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber' },
  CONDICION_INSEGURA: { icon: ShieldAlert, color: 'bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning' },
}

interface Props {
  type: IncidentType
  className?: string
}

export function IncidentTypeBadge({ type, className = '' }: Props) {
  const { icon: Icon, color } = TYPE_CONFIG[type]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {INCIDENT_TYPE_LABELS[type]}
    </span>
  )
}
