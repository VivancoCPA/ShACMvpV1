import { useTranslation } from 'react-i18next'
import type { NCStatus } from '../../features/nonconformities/types/nonconformity.types'

const COLOR_MAP: Record<NCStatus, string> = {
  ABIERTA: 'bg-teal/20 text-teal dark:bg-teal/15 dark:text-teal',
  EN_INVESTIGACION: 'bg-amber/20 text-amber dark:bg-amber/15 dark:text-amber',
  ANALISIS_COMPLETADO: 'bg-amber/30 text-amber dark:bg-amber/20 dark:text-amber',
  EN_EJECUCION: 'bg-coral/20 text-coral dark:bg-coral/15 dark:text-coral',
  PENDIENTE_CIERRE: 'bg-warning/20 text-warning dark:bg-warning/15 dark:text-warning',
  CERRADA: 'bg-success/20 text-success dark:bg-success/15 dark:text-success',
  ANULADA: 'bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft',
}

interface NCStatusBadgeProps {
  status: NCStatus
  className?: string
}

export function NCStatusBadge({ status, className = '' }: NCStatusBadgeProps) {
  const { t } = useTranslation('nonconformities')

  return (
    <span
      className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs ${COLOR_MAP[status]} ${className}`}
    >
      <span className={status === 'ANULADA' ? 'line-through' : ''}>
        {t(`status.${status}`)}
      </span>
    </span>
  )
}
