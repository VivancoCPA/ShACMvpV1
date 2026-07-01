import { QE_STATUS_LABELS } from '../../../constants/shared.constants'
import type { QEStatus } from '../types/qualityEvent.types'

const STATUS_CLASSES: Record<QEStatus, string> = {
  ABIERTO: 'bg-amber/15 text-amber dark:bg-amber/20 dark:text-amber',
  EN_INVESTIGACION: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ANALISIS_COMPLETADO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  EN_EJECUCION: 'bg-teal/15 text-teal dark:bg-teal/20 dark:text-teal',
  PENDIENTE_CIERRE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  CERRADO: 'bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft',
  EN_VERIFICACION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  VERIFICADO: 'bg-success/15 text-success dark:bg-success/20 dark:text-success',
  REABIERTO: 'bg-error/15 text-error dark:bg-error/20 dark:text-error',
}

interface QEStatusBadgeProps {
  status: QEStatus
  className?: string
}

export function QEStatusBadge({ status, className }: QEStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}${className ? ` ${className}` : ''}`}
    >
      {QE_STATUS_LABELS[status]}
    </span>
  )
}
