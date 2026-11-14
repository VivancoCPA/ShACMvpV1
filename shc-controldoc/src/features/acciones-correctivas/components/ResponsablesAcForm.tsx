import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { AC_TIPOS } from '../../../constants/accionCorrectivaTipo.constants'
import { ConfirmModal } from '../../empresas/components/ConfirmModal'
import { LastChangeNote } from '../../sesion/components/LastChangeNote'
import { useActualizarResponsablesAc, useResponsablesAc, useRestablecerResponsablesAc } from '../hooks/useResponsablesAc'
import {
  responsablesAcSchema,
  toResponsablesAcFormValues,
  toResponsablesAcInput,
  type ResponsablesAcFormValues,
} from '../schemas/responsablesAc.schema'
import type { ConfiguracionResponsablesAc } from '../types/responsablesAc.types'

interface ResponsablesAcFormProps {
  empresaId: string
}

/** Matriz "tipo de AC × rol operativo" de una empresa (ac-responsables-configurable-empresa) — la
 *  usan el ADMINISTRADOR_EMPRESA (su empresa, en /usuarios) y el SUPERADMIN (cualquier empresa,
 *  modal en /admin/empresas). */
export function ResponsablesAcForm({ empresaId }: ResponsablesAcFormProps) {
  const { t } = useTranslation('users')
  const { data, isLoading, isError } = useResponsablesAc(empresaId)

  if (isLoading) return <p className="text-sm text-muted dark:text-on-dark-soft">{t('responsablesAc.cargando')}</p>
  if (isError || !data) return <p className="text-sm text-error dark:text-error">{t('responsablesAc.errorCarga')}</p>

  // key: un guardado o restablecer remonta el formulario con defaults nuevos, sin useEffect + reset().
  return (
    <ResponsablesAcFormFields
      key={`${data.actualizadoEn ?? ''}-${data.tipos.map((tipo) => `${tipo.tipo}:${tipo.roles.join(',')}`).join('|')}`}
      data={data}
    />
  )
}

function ResponsablesAcFormFields({ data }: { data: ConfiguracionResponsablesAc }) {
  const { t } = useTranslation('users')
  const { t: tCommon } = useTranslation('common')
  const { t: tAuth } = useTranslation('auth')
  const actualizar = useActualizarResponsablesAc(data.empresaId)
  const restablecer = useRestablecerResponsablesAc(data.empresaId)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<ResponsablesAcFormValues>({
    resolver: zodResolver(responsablesAcSchema),
    mode: 'onChange',
    defaultValues: toResponsablesAcFormValues(data),
  })

  const esDefault = new Map(data.tipos.map((tipo) => [tipo.tipo, tipo.esDefault]))
  const todoDefault = data.tipos.every((tipo) => tipo.esDefault)
  const pending = actualizar.isPending || restablecer.isPending

  const onSubmit = (values: ResponsablesAcFormValues) => actualizar.mutate(toResponsablesAcInput(values))

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline dark:border-hairline/20">
              <th scope="col" className="py-2 pr-3 text-left font-medium text-body-strong dark:text-on-dark">
                {t('responsablesAc.tipoColumna')}
              </th>
              {data.rolesDisponibles.map((rol) => (
                <th
                  key={rol}
                  scope="col"
                  className="px-2 py-2 text-center text-xs font-medium text-body dark:text-on-dark-soft"
                >
                  {tAuth(`roles.${rol}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AC_TIPOS.map((tipo) => {
              const error = errors[tipo]?.message
              return (
                <Controller
                  key={tipo}
                  control={control}
                  name={tipo}
                  render={({ field }) => (
                    <tr
                      aria-invalid={error ? true : undefined}
                      className={`border-b border-hairline dark:border-hairline/20 ${
                        error ? 'bg-error/10 dark:bg-error/20' : ''
                      }`}
                    >
                      <th scope="row" className="py-2 pr-3 text-left align-top font-medium text-ink dark:text-on-dark">
                        <span className="flex flex-wrap items-center gap-2">
                          {tCommon(`acTipo.${tipo}`)}
                          {esDefault.get(tipo) && (
                            <span className="rounded-pill bg-surface-cream px-2 py-0.5 text-xs font-normal text-muted dark:bg-surface-dark-soft dark:text-on-dark-soft">
                              {t('responsablesAc.porDefecto')}
                            </span>
                          )}
                        </span>
                        {error && (
                          <span role="alert" className="mt-1 block text-xs font-normal text-error dark:text-error">
                            {t(error)}
                          </span>
                        )}
                      </th>
                      {data.rolesDisponibles.map((rol) => {
                        const checked = field.value.includes(rol)
                        return (
                          <td key={rol} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={pending}
                              aria-label={`${tCommon(`acTipo.${tipo}`)} — ${tAuth(`roles.${rol}`)}`}
                              onChange={() =>
                                field.onChange(
                                  checked
                                    ? field.value.filter((r) => r !== rol)
                                    : data.rolesDisponibles.filter((r) => r === rol || field.value.includes(r)),
                                )
                              }
                              onBlur={field.onBlur}
                              className="h-4 w-4 accent-coral"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted dark:text-on-dark-soft">{t('responsablesAc.notaAplicacion')}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 dark:border-hairline/20">
        <LastChangeNote
          nombre={data.actualizadoPorNombre}
          fecha={data.actualizadoEn}
          emptyText={t('responsablesAc.sinCambios')}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmarRestablecer(true)}
            disabled={todoDefault || pending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('responsablesAc.restablecer')}
          </button>
          <button
            type="submit"
            disabled={!isDirty || !isValid || pending}
            className="inline-flex items-center gap-2 rounded-md bg-coral px-5 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
          >
            {actualizar.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {actualizar.isPending ? t('responsablesAc.guardando') : t('responsablesAc.guardar')}
          </button>
        </div>
      </div>

      {confirmarRestablecer && (
        <ConfirmModal
          titulo={t('responsablesAc.restablecer')}
          mensaje={t('responsablesAc.confirmarRestablecer')}
          cancelarLabel={t('responsablesAc.cancelar')}
          confirmarLabel={t('responsablesAc.confirmar')}
          isPending={restablecer.isPending}
          danger={false}
          onConfirm={() => restablecer.mutate(undefined, { onSettled: () => setConfirmarRestablecer(false) })}
          onClose={() => setConfirmarRestablecer(false)}
        />
      )}
    </form>
  )
}
