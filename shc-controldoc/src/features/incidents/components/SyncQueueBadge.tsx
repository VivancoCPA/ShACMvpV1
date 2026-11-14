import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudOff, Loader2 } from 'lucide-react'
import { useOfflineQueueStore } from '../stores/offlineQueueStore'
import { SyncQueuePanel } from './SyncQueuePanel'
import { useDismissable, useRouteScopedOpen } from '../../../hooks/useDismissable'

interface SyncQueueBadgeProps {
  onRetry: (localId: number) => void
}

/**
 * Badge de estado de la cola offline en el header de `MobileShell`, visible
 * desde cualquier vista mobile — no solo el formulario de reporte de
 * incidentes (m7-f2-indicador-offline, spec `offline-queue-indicator`).
 */
export function SyncQueueBadge({ onRetry }: SyncQueueBadgeProps) {
  const { t } = useTranslation('incidents')
  const items = useOfflineQueueStore((s) => s.items)
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount)
  const syncingId = useOfflineQueueStore((s) => s.syncingId)
  const hasErrors = useOfflineQueueStore((s) => s.hasErrors)
  const { open, toggle, close } = useRouteScopedOpen()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useDismissable(open, close, [panelRef, triggerRef])

  if (items.length === 0) return null

  const colorClass = hasErrors
    ? 'bg-error/15 text-error dark:bg-error/20'
    : 'bg-amber/15 text-amber dark:bg-amber/20'

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={t('mobile.offline.badgeAriaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium ${colorClass}`}
      >
        {syncingId !== null ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <CloudOff size={13} aria-hidden="true" />
        )}
        {syncingId !== null ? t('mobile.offline.syncing') : t('mobile.offline.pendingBadge', { count: pendingCount })}
      </button>

      {open && (
        <div ref={panelRef} id={panelId}>
          <SyncQueuePanel items={items} onRetry={onRetry} />
        </div>
      )}
    </div>
  )
}
