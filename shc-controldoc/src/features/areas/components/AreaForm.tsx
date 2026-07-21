import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { areaFormSchema, type AreaFormInput } from '../schemas/areaForm.schema'
import { useCrearArea, useActualizarArea } from '../hooks/useAreas'
import type { Area } from '../types/area.types'

interface AreaFormProps {
  mode: 'create' | 'edit'
  area?: Area
  onCancel?: () => void
  onSuccess?: () => void
}

export function AreaForm({ mode, area, onCancel, onSuccess }: AreaFormProps) {
  const { t } = useTranslation('areas')
  const navigate = useNavigate()
  const isEdit = mode === 'edit'

  const createMutation = useCrearArea()
  const updateMutation = useActualizarArea()

  const [nombreServerError, setNombreServerError] = useState<string | null>(null)

  const defaultValues =
    isEdit && area
      ? { nombre: area.nombre, descripcion: area.descripcion ?? '' }
      : { nombre: '', descripcion: '' }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AreaFormInput>({
    resolver: zodResolver(areaFormSchema),
    defaultValues,
  })

  const onSubmit = async (data: AreaFormInput) => {
    setNombreServerError(null)
    try {
      if (isEdit && area) {
        await updateMutation.mutateAsync({ id: area.id, data })
      } else {
        await createMutation.mutateAsync(data)
      }
      onSuccess ? onSuccess() : navigate('/admin/areas')
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        const message = (error.response.data as { message?: string } | null)?.message
        setNombreServerError(message ?? t('form.errors.nombreDuplicado'))
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
          {nombreServerError && <p className={errorClass}>{nombreServerError}</p>}
        </div>

        <div>
          <label htmlFor="descripcion" className={labelClass}>
            {t('form.fields.descripcion')}
          </label>
          <input
            id="descripcion"
            className={inputClass}
            placeholder={t('form.placeholders.descripcion')}
            {...register('descripcion')}
          />
          {errors.descripcion && <p className={errorClass}>{errors.descripcion.message}</p>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel ?? (() => navigate('/admin/areas'))}
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
