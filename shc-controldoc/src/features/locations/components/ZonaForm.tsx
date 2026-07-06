import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { zonaFormSchema, type ZonaFormInput } from '../schemas/zonaForm.schema'
import { useCrearZona, useActualizarZona } from '../hooks/useLocales'
import type { Zona } from '../../incidents/types/incident.types'

interface ZonaFormProps {
  mode: 'create' | 'edit'
  localId: string
  zona?: Zona
  onSaved: () => void
}

export function ZonaForm({ mode, localId, zona, onSaved }: ZonaFormProps) {
  const { t } = useTranslation('locations')
  const isEdit = mode === 'edit'

  const createMutation = useCrearZona()
  const updateMutation = useActualizarZona()

  const defaultValues =
    isEdit && zona
      ? { nombre: zona.nombre, descripcion: zona.descripcion ?? '' }
      : { nombre: '', descripcion: '' }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ZonaFormInput>({
    resolver: zodResolver(zonaFormSchema),
    defaultValues,
  })

  const onSubmit = async (data: ZonaFormInput) => {
    if (isEdit && zona) {
      await updateMutation.mutateAsync({ zonaId: zona.id, data })
    } else {
      await createMutation.mutateAsync({ localId, data })
    }
    onSaved()
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const textareaClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'
  const errorClass = 'mt-1 text-xs text-error'

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
      <div>
        <label htmlFor="zona-nombre" className={labelClass}>
          {t('form.fields.nombre')} <span className="text-error">*</span>
        </label>
        <input
          id="zona-nombre"
          className={inputClass}
          placeholder={t('form.placeholders.nombre')}
          {...register('nombre')}
        />
        {errors.nombre && <p className={errorClass}>{errors.nombre.message}</p>}
      </div>

      <div>
        <label htmlFor="zona-descripcion" className={labelClass}>
          {t('form.fields.descripcion')}
        </label>
        <textarea
          id="zona-descripcion"
          rows={3}
          className={textareaClass}
          placeholder={t('form.placeholders.descripcion')}
          {...register('descripcion')}
        />
        {errors.descripcion && <p className={errorClass}>{errors.descripcion.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
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
