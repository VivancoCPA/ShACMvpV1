import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { empresaFormSchema, type EmpresaFormInput } from '../schemas/empresaForm.schema'
import { useCreateEmpresa, useUpdateEmpresa } from '../hooks/useEmpresas'
import { LogoUploadField } from './LogoUploadField'
import type { Empresa } from '../types/empresa.types'

interface EmpresaFormProps {
  mode: 'create' | 'edit'
  empresa?: Empresa
  onCancel: () => void
  onSuccess: () => void
}

export function EmpresaForm({ mode, empresa, onCancel, onSuccess }: EmpresaFormProps) {
  const { t } = useTranslation('empresas')
  const isEdit = mode === 'edit'

  const createMutation = useCreateEmpresa()
  const updateMutation = useUpdateEmpresa()

  const [rucServerError, setRucServerError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  const defaultValues: EmpresaFormInput =
    isEdit && empresa
      ? {
          razonSocial: empresa.razonSocial,
          ruc: empresa.ruc,
          estado: empresa.estado,
          logoBase64: empresa.logoUrl || undefined,
        }
      : { razonSocial: '', ruc: '', estado: 'ACTIVA', logoBase64: undefined }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaFormInput>({
    resolver: zodResolver(empresaFormSchema),
    defaultValues,
  })

  const onSubmit = async (data: EmpresaFormInput) => {
    setRucServerError(null)
    try {
      if (isEdit && empresa) {
        await updateMutation.mutateAsync({ id: empresa.id, data })
      } else {
        await createMutation.mutateAsync(data)
      }
      onSuccess()
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        const message = (error.response.data as { message?: string } | null)?.message
        setRucServerError(message ?? t('form.errors.rucDuplicado'))
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
      <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated space-y-4">
        <div>
          <label htmlFor="razonSocial" className={labelClass}>
            {t('form.fields.razonSocial')} <span className="text-error">*</span>
          </label>
          <input
            id="razonSocial"
            className={inputClass}
            placeholder={t('form.placeholders.razonSocial')}
            {...register('razonSocial')}
          />
          {errors.razonSocial && <p className={errorClass}>{t(errors.razonSocial.message ?? '')}</p>}
        </div>

        <div>
          <label htmlFor="ruc" className={labelClass}>
            {t('form.fields.ruc')} <span className="text-error">*</span>
          </label>
          <input id="ruc" className={inputClass} placeholder={t('form.placeholders.ruc')} {...register('ruc')} />
          {errors.ruc && <p className={errorClass}>{t(errors.ruc.message ?? '')}</p>}
          {rucServerError && <p className={errorClass}>{rucServerError}</p>}
        </div>

        <div>
          <label htmlFor="estado" className={labelClass}>
            {t('form.fields.estado')}
          </label>
          <select id="estado" className={inputClass} {...register('estado')}>
            <option value="ACTIVA">{t('estado.ACTIVA')}</option>
            <option value="INACTIVA">{t('estado.INACTIVA')}</option>
          </select>
        </div>

        <Controller
          name="logoBase64"
          control={control}
          render={({ field }) => (
            <LogoUploadField
              value={field.value}
              onChange={field.onChange}
              error={logoError}
              onError={setLogoError}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
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
