import { useTranslation } from 'react-i18next'
import { CloudOff, Loader2, RotateCw } from 'lucide-react'
import { formatDateTime } from '../../../utils/date.utils'
import type { OfflineIncidentStatus, QueuedIncident } from '../../../lib/offlineQueue'

interface SyncQueuePanelProps {
  items: QueuedIncident[]
  onRetry: (localId: number) => void
}

const STATUS_ICON: Record<OfflineIncidentStatus, typeof CloudOff> = {
  pending: CloudOff,
  syncing: Loader2,
  synced: CloudOff,
  error: CloudOff,
}

/**
 * Panel de detalle de la cola offline, anclado bajo `SyncQueueBadge` — mismo
 * patrón popover que `NotificationBell` (m7-f2-indicador-offline design.md D5).
 * Solo lista entradas `pending`/`syncing`/`error`; `items` ya viene filtrado
 * así desde `offlineQueueStore` (`listVisible()`).
 */
export function SyncQueuePanel({ items, onRetry }: SyncQueuePanelProps) {
  const { t, i18n } = useTranslation('incidents')

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-hairline bg-canvas shadow-lg dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <div className="border-b border-hairline px-4 py-2.5 dark:border-hairline/20">
        <span className="text-sm font-medium text-ink dark:text-on-dark">
          {t('mobile.offline.panel.title')}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted dark:text-on-dark-soft">
          {t('mobile.offline.panel.empty')}
        </p>
      ) : (
        <ul className="max-h-96 overflow-y-auto">
          {items.map((item) => {
            const Icon = STATUS_ICON[item.status]
            return (
              <li
                key={item.localId}
                className="flex items-start gap-2.5 border-b border-hairline px-4 py-3 last:border-b-0 dark:border-hairline/20"
              >
                <Icon
                  size={16}
                  className={`mt-0.5 shrink-0 ${item.status === 'syncing' ? 'animate-spin text-muted dark:text-on-dark-soft' : item.status === 'error' ? 'text-error' : 'text-muted dark:text-on-dark-soft'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink dark:text-on-dark">
                    {formatDateTime(item.createdAt, i18n.language)}
                  </p>
                  <p
                    className={`text-xs ${item.status === 'error' ? 'text-error' : 'text-muted dark:text-on-dark-soft'}`}
                  >
                    {t(`mobile.offline.panel.status.${item.status}`)}
                    {item.status === 'error' && item.errorMessage ? ` — ${item.errorMessage}` : ''}
                  </p>
                </div>
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => onRetry(item.localId)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink hover:border-coral hover:text-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
                  >
                    <RotateCw size={12} aria-hidden="true" />
                    {t('mobile.offline.retry')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
