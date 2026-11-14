import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  descartarSolicitudACSchema,
  type DescartarSolicitudACInput,
} from '../schemas/descartarSolicitudAC.schema'

interface DescartarSolicitudACModalProps {
  onConfirm: (data: DescartarSolicitudACInput) => void
  onClose: () => void
  isPending: boolean
}

// solicitudes-ac-y-ac-del-qe-en-origen: el JCA descarta una solicitud de AC pendiente con motivo.
export function DescartarSolicitudACModal({ onConfirm, onClose, isPending }: DescartarSolicitudACModalProps) {
  const { t } = useTranslation('qualityEvents')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DescartarSolicitudACInput>({
    resolver: zodResolver(descartarSolicitudACSchema),
    defaultValues: { motivo: '' },
  })
  const longitud = useWatch({ control, name: 'motivo' }).trim().length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="descartar-solicitud-ac-title"
        className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 id="descartar-solicitud-ac-title" className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.descartarSolicitud')}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
          {t('detail.acSection.descartarSolicitudBody')}
        </p>

        <form onSubmit={(e) => void handleSubmit(onConfirm)(e)} className="space-y-4">
          <div>
            <label
              htmlFor="descartar-solicitud-motivo"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('detail.acSection.motivoDescarte')} <span className="text-error">*</span>
            </label>
            <textarea
              id="descartar-solicitud-motivo"
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              {...register('motivo')}
            />
            <div className="mt-1 flex justify-between gap-2">
              <p className="text-xs text-error">{errors.motivo?.message}</p>
              <p className="shrink-0 text-xs text-muted dark:text-on-dark-soft">{longitud}/500</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('detail.acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-error dark:text-white"
            >
              {t('detail.acSection.confirmarDescarte')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
