import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, X } from 'lucide-react'
import { anularNCSchema, type AnularNCInput } from '../schemas/anularNC.schema'

interface AnularNCModalProps {
  isPending: boolean
  onConfirm: (justificacion: string) => void
  onClose: () => void
}

export function AnularNCModal({ isPending, onConfirm, onClose }: AnularNCModalProps) {
  const { t } = useTranslation('nonconformities')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AnularNCInput>({ resolver: zodResolver(anularNCSchema) })

  const onSubmit = (data: AnularNCInput) => {
    onConfirm(data.justificacion)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('anular.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('anular.title')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('anular.body')}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <label
              htmlFor="justificacion"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('anular.fields.justificacion')} <span className="text-error">*</span>
            </label>
            <textarea
              id="justificacion"
              rows={4}
              maxLength={2000}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-error focus:border-error dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              placeholder={t('anular.placeholders.justificacion')}
              {...register('justificacion')}
            />
            {errors.justificacion && (
              <p className="mt-1 text-xs text-error">{errors.justificacion.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
            >
              {t('anular.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-60"
            >
              {t('anular.actions.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
