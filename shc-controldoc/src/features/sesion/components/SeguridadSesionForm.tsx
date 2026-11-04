import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useSeguridadSesionEmpresa, useUpdateSeguridadSesionEmpresa } from '../hooks/useSesion'
import {
  buildSeguridadSesionSchema,
  toSeguridadSesionInput,
  type SeguridadSesionFormValues,
} from '../schemas/seguridadSesion.schema'
import type { SeguridadSesionEmpresa } from '../types/sesion.types'
import { LastChangeNote } from './LastChangeNote'

interface SeguridadSesionFormProps {
  empresaId: string
  onSaved?: () => void
}

/** Configuración "Seguridad de sesión" de una empresa — la usan el ADMINISTRADOR_EMPRESA (su
 *  empresa, en /usuarios) y el SUPERADMIN (cualquier empresa, modal en /admin/empresas). */
export function SeguridadSesionForm({ empresaId, onSaved }: SeguridadSesionFormProps) {
  const { t } = useTranslation('sesion')
  const { data, isLoading, isError } = useSeguridadSesionEmpresa(empresaId)

  if (isLoading) return <p className="text-sm text-muted dark:text-on-dark-soft">{t('config.loading')}</p>
  if (isError || !data) return <p className="text-sm text-error dark:text-error">{t('config.loadError')}</p>

  // key: un guardado que cambia los valores remonta el formulario con defaults nuevos, sin
  // useEffect + reset().
  return (
    <SeguridadSesionFormFields
      key={`${data.inactividadMinutos}-${data.sesionMaximaHoras}-${data.actualizadoEn ?? ''}`}
      data={data}
      onSaved={onSaved}
    />
  )
}

function SeguridadSesionFormFields({ data, onSaved }: { data: SeguridadSesionEmpresa; onSaved?: () => void }) {
  const { t } = useTranslation('sesion')
  const parametros = data.parametrosGlobales
  const schema = useMemo(() => buildSeguridadSesionSchema(parametros), [parametros])
  const updateMutation = useUpdateSeguridadSesionEmpresa(data.empresaId)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<SeguridadSesionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      usarDefaultInactividad: data.inactividadMinutos === null,
      inactividadMinutos: data.inactividadMinutos ?? parametros.inactividadDefaultMinutos,
      usarDefaultSesionMaxima: data.sesionMaximaHoras === null,
      sesionMaximaHoras: data.sesionMaximaHoras ?? parametros.sesionMaximaDefaultHoras,
    },
  })

  const usarDefaultInactividad = useWatch({ control, name: 'usarDefaultInactividad' })
  const usarDefaultSesionMaxima = useWatch({ control, name: 'usarDefaultSesionMaxima' })

  const onSubmit = (values: SeguridadSesionFormValues) => {
    updateMutation.mutate(toSeguridadSesionInput(values), { onSuccess: () => onSaved?.() })
  }

  const inputClass =
    'h-10 w-32 rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 read-only:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <label htmlFor="ses-inactividad" className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark">
          {t('config.inactividadLabel')}
        </label>
        <input
          id="ses-inactividad"
          type="number"
          inputMode="numeric"
          min={parametros.inactividadMinMinutos}
          max={parametros.inactividadMaxMinutos}
          readOnly={usarDefaultInactividad}
          aria-describedby="ses-inactividad-help"
          {...register('inactividadMinutos', { valueAsNumber: true })}
          className={inputClass}
        />
        <p id="ses-inactividad-help" className="mt-1 text-xs text-muted dark:text-on-dark-soft">
          {t('config.inactividadHelp', {
            min: parametros.inactividadMinMinutos,
            max: parametros.inactividadMaxMinutos,
            global: parametros.inactividadDefaultMinutos,
          })}
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-body dark:text-on-dark-soft">
          <input type="checkbox" {...register('usarDefaultInactividad')} className="accent-coral" />
          {t('config.useDefault')}
        </label>
        {errors.inactividadMinutos?.message && (
          <p role="alert" className="mt-1 text-xs text-error dark:text-error">
            {t(errors.inactividadMinutos.message)}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="ses-sesion-maxima" className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark">
          {t('config.sesionMaximaLabel')}
        </label>
        <input
          id="ses-sesion-maxima"
          type="number"
          inputMode="numeric"
          min={parametros.sesionMaximaMinHoras}
          max={parametros.sesionMaximaMaxHoras}
          readOnly={usarDefaultSesionMaxima}
          aria-describedby="ses-sesion-maxima-help"
          {...register('sesionMaximaHoras', { valueAsNumber: true })}
          className={inputClass}
        />
        <p id="ses-sesion-maxima-help" className="mt-1 text-xs text-muted dark:text-on-dark-soft">
          {t('config.sesionMaximaHelp', {
            min: parametros.sesionMaximaMinHoras,
            max: parametros.sesionMaximaMaxHoras,
            global: parametros.sesionMaximaDefaultHoras,
          })}
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-body dark:text-on-dark-soft">
          <input type="checkbox" {...register('usarDefaultSesionMaxima')} className="accent-coral" />
          {t('config.useDefault')}
        </label>
        {errors.sesionMaximaHoras?.message && (
          <p role="alert" className="mt-1 text-xs text-error dark:text-error">
            {t(errors.sesionMaximaHoras.message)}
          </p>
        )}
      </div>

      <p className="text-xs text-muted dark:text-on-dark-soft">
        {t('config.effective', { inactividad: data.efectiva.inactividadMinutos, horas: data.efectiva.sesionMaximaHoras })}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 dark:border-hairline/20">
        <LastChangeNote
          nombre={data.actualizadoPorNombre}
          fecha={data.actualizadoEn}
          emptyText={t('config.neverChanged')}
        />
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
