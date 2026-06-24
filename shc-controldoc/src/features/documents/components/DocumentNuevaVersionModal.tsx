import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { nuevaVersionSchema, type NuevaVersionInput } from '../schemas/nuevaVersion.schema'
import { useCreateNuevaVersion } from '../hooks/useDocumentActions'

interface DocumentNuevaVersionModalProps {
  documentoId: string
  versionActual: string
  onClose: () => void
}

function calcularNuevaVersion(versionActual: string, tipoCambio: 'MENOR' | 'MAYOR'): string {
  const match = versionActual.match(/^v?(\d+)\.(\d+)$/)
  if (!match) return versionActual
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  return tipoCambio === 'MENOR' ? `v${major}.${minor + 1}` : `v${major + 1}.0`
}

export function DocumentNuevaVersionModal({
  documentoId,
  versionActual,
  onClose,
}: DocumentNuevaVersionModalProps) {
  const { t } = useTranslation('documents')
  const createNuevaVersion = useCreateNuevaVersion(documentoId)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NuevaVersionInput>({ resolver: zodResolver(nuevaVersionSchema) })

  const tipoCambio = watch('tipoCambio')
  const versionPreview = tipoCambio ? calcularNuevaVersion(versionActual, tipoCambio) : null

  const onSubmit = async (data: NuevaVersionInput) => {
    try {
      await createNuevaVersion.mutateAsync(data)
      onClose()
    } catch {
      // error handled by onError in useCreateNuevaVersion
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nueva-version-title"
        className="w-full max-w-md rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <h2
          id="nueva-version-title"
          className="mb-5 text-base font-semibold text-ink dark:text-on-dark"
        >
          {t('nuevaVersion.modal.title')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-body-strong dark:text-on-dark">
              {t('nuevaVersion.modal.tipoCambio')} *
            </legend>
            <div className="space-y-2.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  value="MENOR"
                  {...register('tipoCambio')}
                  className="mt-0.5 accent-coral"
                />
                <span className="text-sm text-body dark:text-on-dark">
                  {t('nuevaVersion.modal.menor')}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  value="MAYOR"
                  {...register('tipoCambio')}
                  className="mt-0.5 accent-coral"
                />
                <span className="text-sm text-body dark:text-on-dark">
                  {t('nuevaVersion.modal.mayor')}
                </span>
              </label>
            </div>
            {errors.tipoCambio && (
              <p className="mt-1.5 text-xs text-error">{errors.tipoCambio.message}</p>
            )}
          </fieldset>

          {versionPreview && (
            <p className="rounded-md bg-surface-soft px-3 py-2 text-sm font-medium text-muted dark:bg-surface-dark dark:text-on-dark-soft">
              {t('nuevaVersion.modal.preview', { version: versionPreview })}
            </p>
          )}

          <div>
            <label
              htmlFor="motivo"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('nuevaVersion.modal.motivo')} *
            </label>
            <textarea
              id="motivo"
              rows={4}
              {...register('motivo')}
              placeholder={t('nuevaVersion.modal.motivoPlaceholder')}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft/50"
            />
            {errors.motivo && (
              <p className="mt-1 text-xs text-error">{errors.motivo.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
            >
              {t('detail.cancel')}
            </button>
            <button
              type="submit"
              disabled={createNuevaVersion.isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-50"
            >
              {t('nuevaVersion.modal.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
