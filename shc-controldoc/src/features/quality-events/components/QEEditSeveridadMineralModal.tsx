import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { useEditarSeveridad } from '../hooks/useEditarSeveridad'
import { useEditarMineral } from '../hooks/useEditarMineral'
import { QE_SEVERITY_LABELS, QE_MINERALES } from '../../../constants/shared.constants'
import type { QualityEvent, QESeverity } from '../types/qualityEvent.types'
import type { QEEditAccess } from '../types/qualityEventPermissions.types'

const QE_SEVERITIES = Object.keys(QE_SEVERITY_LABELS) as QESeverity[]

interface QEEditSeveridadMineralModalProps {
  qe: QualityEvent
  access: QEEditAccess
  onClose: () => void
}

interface FormValues {
  severidad: QESeverity
  mineralInvolucrado: string
}

export function QEEditSeveridadMineralModal({ qe, access, onClose }: QEEditSeveridadMineralModalProps) {
  const { t } = useTranslation('qualityEvents')
  const { mutate: mutateSeveridad, isPending: isPendingSeveridad } = useEditarSeveridad()
  const { mutate: mutateMineral, isPending: isPendingMineral } = useEditarMineral()

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      severidad: qe.severidad,
      mineralInvolucrado: qe.mineralInvolucrado ?? '',
    },
  })

  const severidadValue = watch('severidad')
  const mineralValue = watch('mineralInvolucrado')

  const severidadChanged = access.severidad && severidadValue !== qe.severidad
  const mineralChanged = access.mineral && mineralValue !== (qe.mineralInvolucrado ?? '')
  const hasChanges = severidadChanged || mineralChanged
  const isPending = isPendingSeveridad || isPendingMineral

  const showCriticaBanner = access.severidad && severidadValue === 'CRITICA' && severidadValue !== qe.severidad

  const onSubmit = (data: FormValues) => {
    const onError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg || t('editSeveridadMineralModal.toasts.error'))
    }

    const finish = () => {
      toast.success(t('editSeveridadMineralModal.toasts.success'))
      onClose()
    }

    const applyMineralIfNeeded = () => {
      if (mineralChanged) {
        mutateMineral(
          { id: qe.id, data: { mineralInvolucrado: data.mineralInvolucrado } },
          { onSuccess: finish, onError },
        )
      } else {
        finish()
      }
    }

    if (severidadChanged) {
      mutateSeveridad(
        { id: qe.id, data: { severidad: data.severidad } },
        { onSuccess: applyMineralIfNeeded, onError },
      )
    } else {
      applyMineralIfNeeded()
    }
  }

  const selectClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('editSeveridadMineralModal.actions.close')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-4 font-medium text-ink dark:text-on-dark">
          {t('editSeveridadMineralModal.title')}
        </h2>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
          {access.severidad && (
            <div>
              <label className={labelClass} htmlFor="edit-severidad">
                {t('editSeveridadMineralModal.fields.severidad')}
              </label>
              <select id="edit-severidad" className={selectClass} {...register('severidad')}>
                {QE_SEVERITIES.map((sv) => (
                  <option key={sv} value={sv}>{QE_SEVERITY_LABELS[sv]}</option>
                ))}
              </select>
            </div>
          )}

          {showCriticaBanner && (
            <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm">{t('editSeveridadMineralModal.criticaBanner')}</p>
            </div>
          )}

          {access.mineral && (
            <div>
              <label className={labelClass} htmlFor="edit-mineralInvolucrado">
                {t('editSeveridadMineralModal.fields.mineralInvolucrado')}
              </label>
              <select id="edit-mineralInvolucrado" className={selectClass} {...register('mineralInvolucrado')}>
                <option value="">{t('form.placeholders.select')}</option>
                {QE_MINERALES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
            >
              {t('editSeveridadMineralModal.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {isPending
                ? t('editSeveridadMineralModal.actions.submitting')
                : t('editSeveridadMineralModal.actions.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
