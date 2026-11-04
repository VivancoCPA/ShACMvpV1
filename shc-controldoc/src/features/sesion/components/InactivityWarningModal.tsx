import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface InactivityWarningModalProps {
  secondsLeft: number
  isPending: boolean
  onStayConnected: () => void
  onLogout: () => void
}

export function InactivityWarningModal({ secondsLeft, isPending, onStayConnected, onLogout }: InactivityWarningModalProps) {
  const { t } = useTranslation('sesion')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-warning-title"
        aria-describedby="inactivity-warning-message"
        className="w-full max-w-sm rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <h2 id="inactivity-warning-title" className="font-medium text-ink dark:text-on-dark">
          {t('warning.title')}
        </h2>
        <p
          id="inactivity-warning-message"
          aria-live="polite"
          className="mt-2 text-sm text-body dark:text-on-dark-soft"
        >
          {t('warning.message', { seconds: secondsLeft })}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('warning.logout')}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onStayConnected}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
          >
            {isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {t('warning.stayConnected')}
          </button>
        </div>
      </div>
    </div>
  )
}
