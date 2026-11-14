import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useMarkAllNotificationsRead } from '../hooks/useMarkAllNotificationsRead'
import { useNotificationToast } from '../hooks/useNotificationToast'
import { useNotificationsHub } from '../hooks/useNotificationsHub'
import { NotificationList } from './NotificationList'
import { useDismissable, useRouteScopedOpen } from '../../../hooks/useDismissable'

export function NotificationBell() {
  const { t } = useTranslation('notifications')
  const { data: notifications = [] } = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()
  const toastHandle = useNotificationToast()
  useNotificationsHub(toastHandle)
  const { open, toggle, close } = useRouteScopedOpen()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useDismissable(open, close, [panelRef, triggerRef])

  const unreadCount = notifications.filter((n) => !n.leida).length
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={t('bell.ariaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="relative rounded-md p-1.5 text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-coral px-1 text-[10px] font-medium leading-none text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-hairline bg-canvas shadow-lg dark:border-hairline/20 dark:bg-surface-dark-elevated"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5 dark:border-hairline/20">
            <span className="text-sm font-medium text-ink dark:text-on-dark">{t('title')}</span>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-coral hover:text-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('markAllRead')}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <NotificationList notifications={sorted} onNavigate={close} />
          </div>
        </div>
      )}
    </div>
  )
}
