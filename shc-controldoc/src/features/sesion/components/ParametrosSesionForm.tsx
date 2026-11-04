import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useParametrosSesion, useUpdateParametrosSesion } from '../hooks/useSesion'
import { parametrosSesionSchema, type ParametrosSesionFormValues } from '../schemas/seguridadSesion.schema'
import { RANGO_ABSOLUTO } from '../utils/politicaSesion'
import type { ParametrosSesion } from '../types/sesion.types'
import { LastChangeNote } from './LastChangeNote'

/** Valor por defecto global y límites de la política de sesión — solo SUPERADMIN. */
export function ParametrosSesionForm() {
  const { t } = useTranslation('sesion')
  const { data, isLoading, isError } = useParametrosSesion()

  if (isLoading) return <p className="text-sm text-muted dark:text-on-dark-soft">{t('config.loading')}</p>
  if (isError || !data) return <p className="text-sm text-error dark:text-error">{t('config.loadError')}</p>

  return <ParametrosSesionFormFields key={data.actualizadoEn ?? 'semilla'} data={data} />
}

type Campo = keyof ParametrosSesionFormValues

function ParametrosSesionFormFields({ data }: { data: ParametrosSesion }) {
  const { t } = useTranslation('sesion')
  const updateMutation = useUpdateParametrosSesion()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ParametrosSesionFormValues>({
    resolver: zodResolver(parametrosSesionSchema),
    defaultValues: {
      inactividadDefaultMinutos: data.inactividadDefaultMinutos,
      inactividadMinMinutos: data.inactividadMinMinutos,
      inactividadMaxMinutos: data.inactividadMaxMinutos,
      sesionMaximaDefaultHoras: data.sesionMaximaDefaultHoras,
      sesionMaximaMinHoras: data.sesionMaximaMinHoras,
      sesionMaximaMaxHoras: data.sesionMaximaMaxHoras,
    },
  })

  const onSubmit = (values: ParametrosSesionFormValues) => updateMutation.mutate(values)

  const field = (campo: Campo, label: string) => (
    <div key={campo}>
      <label htmlFor={`ps-${campo}`} className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark">
        {label}
      </label>
      <input
        id={`ps-${campo}`}
        type="number"
        inputMode="numeric"
        {...register(campo, { valueAsNumber: true })}
        className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
      />
      {errors[campo]?.message && (
        <p role="alert" className="mt-1 text-xs text-error dark:text-error">
          {t(errors[campo]?.message ?? '')}
        </p>
      )}
    </div>
  )

  const sectionClass = 'rounded-lg border border-hairline p-4 dark:border-hairline/20'

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <fieldset className={sectionClass}>
        <legend className="px-1 text-sm font-medium text-ink dark:text-on-dark">{t('global.inactividadSection')}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {field('inactividadDefaultMinutos', t('global.default'))}
          {field('inactividadMinMinutos', t('global.min'))}
          {field('inactividadMaxMinutos', t('global.max'))}
        </div>
        <p className="mt-2 text-xs text-muted dark:text-on-dark-soft">
          {t('global.absoluteHelp', { min: RANGO_ABSOLUTO.inactividadMinMinutos, max: RANGO_ABSOLUTO.inactividadMaxMinutos })}
        </p>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-sm font-medium text-ink dark:text-on-dark">{t('global.sesionMaximaSection')}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {field('sesionMaximaDefaultHoras', t('global.default'))}
          {field('sesionMaximaMinHoras', t('global.min'))}
          {field('sesionMaximaMaxHoras', t('global.max'))}
        </div>
        <p className="mt-2 text-xs text-muted dark:text-on-dark-soft">
          {t('global.absoluteHelp', { min: RANGO_ABSOLUTO.sesionMaximaMinHoras, max: RANGO_ABSOLUTO.sesionMaximaMaxHoras })}
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LastChangeNote nombre={data.actualizadoPorNombre} fecha={data.actualizadoEn} emptyText={t('config.neverChanged')} />
        <button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-coral px-5 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
        >
          {updateMutation.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {updateMutation.isPending ? t('config.saving') : t('config.save')}
        </button>
      </div>
    </form>
  )
}
