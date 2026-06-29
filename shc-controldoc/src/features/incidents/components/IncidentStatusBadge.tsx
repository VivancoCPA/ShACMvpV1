import { INCIDENT_STATUS_LABELS } from '../../../constants/shared.constants'
import type { IncidentStatus } from '../types/incident.types'

const COLOR_MAP: Record<IncidentStatus, string> = {
  ABIERTO: 'bg-teal/15 text-teal dark:bg-teal/15 dark:text-teal',
  EN_INVESTIGACION: 'bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber',
  ANALISIS_COMPLETADO: 'bg-amber/20 text-amber-700 dark:bg-amber/20 dark:text-amber',
  EN_EJECUCION: 'bg-coral/15 text-coral dark:bg-coral/15 dark:text-coral',
  PENDIENTE_CIERRE: 'bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning',
  CERRADO: 'bg-success/15 text-success dark:bg-success/15 dark:text-success',
  ANULADO: 'bg-muted/15 text-muted dark:bg-muted/15 dark:text-muted',
}

interface Props {
  status: IncidentStatus
  className?: string
}

export function IncidentStatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[status]} ${className}`}
    >
      {INCIDENT_STATUS_LABELS[status]}
    </span>
  )
}
