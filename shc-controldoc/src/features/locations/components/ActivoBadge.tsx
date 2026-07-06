import { useTranslation } from 'react-i18next'

interface ActivoBadgeProps {
  activo: boolean
  className?: string
}

export function ActivoBadge({ activo, className = '' }: ActivoBadgeProps) {
  const { t } = useTranslation('locations')
  const colorClass = activo
    ? 'bg-success/20 text-success dark:bg-success/15 dark:text-success'
    : 'bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft'

  return (
    <span
      className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs ${colorClass} ${className}`}
    >
      {t(activo ? 'badges.activo' : 'badges.inactivo')}
    </span>
  )
}
