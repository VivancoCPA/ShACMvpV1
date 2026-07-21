import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMarkNotificationRead } from '../hooks/useMarkNotificationRead'
import { getRelativeTimeParts } from '../utils/relativeTime'
import type { Notificacion } from '../../../types/notification.types'

interface NotificationListProps {
  notifications: Notificacion[]
  emptyMessage?: string
}

export function NotificationList({ notifications, emptyMessage }: NotificationListProps) {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()

  if (notifications.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted dark:text-on-dark-soft">
        {emptyMessage ?? t('empty')}
      </p>
    )
  }

  const handleClick = (notificacion: Notificacion) => {
    if (!notificacion.leida) markRead.mutate(notificacion.id)
    navigate(notificacion.link)
  }

  return (
    <ul className="divide-y divide-hairline dark:divide-hairline/20">
      {notifications.map((notificacion) => {
        const { unit, count } = getRelativeTimeParts(notificacion.createdAt)
        return (
          <li key={notificacion.id}>
            <button
              type="button"
              onClick={() => handleClick(notificacion)}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft ${
                notificacion.leida
                  ? 'text-muted dark:text-on-dark-soft'
                  : 'bg-coral/5 text-ink dark:bg-coral/10 dark:text-on-dark'
              }`}
            >
              <p className={`text-sm ${notificacion.leida ? '' : 'font-medium'}`}>{notificacion.mensaje}</p>
              <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                {t(`relativeTime.${unit}`, { count })}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
