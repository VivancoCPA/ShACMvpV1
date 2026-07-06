import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { AlertTriangle } from 'lucide-react'
import { localFormSchema, type LocalFormInput } from '../schemas/localForm.schema'
import { useCrearLocal, useActualizarLocal } from '../hooks/useLocales'
import { PlanoUploadField } from './PlanoUploadField'
import type { LocalConZonas } from '../api/locales.api'

interface LocalFormProps {
  mode: 'create' | 'edit'
  local?: LocalConZonas
  onCancel?: () => void
}

export function LocalForm({ mode, local, onCancel }: LocalFormProps) {
  const { t } = useTranslation('locations')
  const navigate = useNavigate()
  const isEdit = mode === 'edit'

  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCrearLocal()
  const updateMutation = useActualizarLocal()

  const defaultValues =
    isEdit && local
      ? { nombre: local.nombre, direccion: local.direccion ?? '' }
      : { nombre: '', direccion: '' }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LocalFormInput>({
    resolver: zodResolver(localFormSchema),
    defaultValues,
  })

  const existingUrl = isEdit && local?.planoPngUrl ? local.planoPngUrl : undefined

  const onSubmit = async (data: LocalFormInput) => {
    setServerError(null)
    try {
      if (isEdit && local) {
        const payload: Partial<LocalFormInput> = {
          nombre: data.nombre,
          direccion: data.direccion,
        }
        if (data.planoUrl instanceof File) payload.planoUrl = data.planoUrl
        await updateMutation.mutateAsync({ id: local.id, data: payload })
      } else {
        await createMutation.mutateAsync(data)
      }
      navigate('/admin/locales')
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 400) {
        const message = (error.response.data as { message?: string } | null)?.message
        setServerError(message ?? t('form.errors.limiteLocalesActivos'))
      }
    }
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'
  const errorClass = 'mt-1 text-xs text-error'

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-6">
      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-4 py-3 dark:border-error/20 dark:bg-error/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
          <p className="text-sm text-error">{serverError}</p>
        </div>
      )}

      <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="mb-4">
          <label htmlFor="nombre" className={labelClass}>
            {t('form.fields.nombre')} <span className="text-error">*</span>
          </label>
          <input
            id="nombre"
            className={inputClass}
            placeholder={t('form.placeholders.nombre')}
            {...register('nombre')}
          />
          {errors.nombre && <p className={errorClass}>{errors.nombre.message}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="direccion" className={labelClass}>
            {t('form.fields.direccion')} <span className="text-error">*</span>
          </label>
          <input
            id="direccion"
            className={inputClass}
            placeholder={t('form.placeholders.direccion')}
            {...register('direccion')}
          />
          {errors.direccion && <p className={errorClass}>{errors.direccion.message}</p>}
        </div>

        <div>
          <p className={labelClass}>{t('form.fields.plano')}</p>
          <Controller
            name="planoUrl"
            control={control}
            render={({ field: { value, onChange } }) => (
              <PlanoUploadField
                value={value ?? null}
                onChange={onChange}
                existingUrl={existingUrl}
              />
            )}
          />
          {errors.planoUrl && (
            <p className={errorClass}>{errors.planoUrl.message as string}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel ?? (() => navigate('/admin/locales'))}
          className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
        >
          {t('form.actions.cancel')}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
        >
          {isPending ? t('form.actions.submitting') : t('form.actions.submit')}
        </button>
      </div>
    </form>
  )
}
