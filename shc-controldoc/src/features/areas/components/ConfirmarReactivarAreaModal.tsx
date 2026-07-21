import { useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'

interface ConfirmarReactivarAreaModalProps {
  nombre: string
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmarReactivarAreaModal({
  nombre,
  isPending,
  onConfirm,
  onClose,
}: ConfirmarReactivarAreaModalProps) {
  const { t } = useTranslation('areas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('confirmarReactivar.cancelar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <RotateCcw size={20} className="mt-0.5 shrink-0 text-coral" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('confirmarReactivar.titulo')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('confirmarReactivar.mensaje', { nombre })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('confirmarReactivar.cancelar')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('confirmarReactivar.confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
