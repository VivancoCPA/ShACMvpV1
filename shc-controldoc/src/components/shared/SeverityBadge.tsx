import { useTranslation } from 'react-i18next'
import type { NCSeveridad } from '../../features/nonconformities/types/nonconformity.types'

const COLOR_MAP: Record<NCSeveridad, string> = {
  BAJA: 'bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft',
  MEDIA: 'bg-amber/20 text-amber dark:bg-amber/15 dark:text-amber',
  ALTA: 'bg-error/10 text-error dark:bg-error/10 dark:text-error',
  CRITICA: 'bg-error/20 text-error font-semibold dark:bg-error/15 dark:text-error',
}

interface SeverityBadgeProps {
  severity: NCSeveridad
  className?: string
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <span
      className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs ${COLOR_MAP[severity]} ${className}`}
    >
      {t(`severity.${severity}`)}
    </span>
  )
}
