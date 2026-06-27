import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createNCSchema, type CreateNCInput } from '../schemas/createNC.schema'
import { createNonconformity, type CreateNCResponse } from '../api/nonconformities.api'
import { NC_DOMINIO_LABELS } from '../constants/nonconformity.constants'
import { QUERY_KEYS } from '../hooks/useNonconformities'
import { useUsers } from '../hooks/useUsers'
import { AREAS_SHAC } from '../../../constants/shared.constants'
import type { NoConformidad } from '../types/nonconformity.types'

const NC_DOMINIO_KEYS = Object.keys(NC_DOMINIO_LABELS) as (keyof typeof NC_DOMINIO_LABELS)[]

interface DuplicateModalProps {
  ncsSimilares: NoConformidad[]
  onForzar: () => void
  onClose: () => void
}

function DuplicateModal({ ncsSimilares, onForzar, onClose }: DuplicateModalProps) {
  const { t } = useTranslation('nonconformities')
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          aria-label={t('form.actions.cancel')}
        >
          <X size={20} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">
              {t('form.duplicate.title')}
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('form.duplicate.body', { count: ncsSimilares.length })}
            </p>
          </div>
        </div>

        <div className="mb-5 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline dark:divide-hairline/20 dark:border-hairline/20">
          {ncsSimilares.slice(0, 3).map((nc) => (
            <div key={nc.id} className="px-4 py-2.5">
              <span className="font-mono text-xs font-medium text-coral">{nc.numero}</span>
              <p className="mt-0.5 text-sm text-body dark:text-on-dark-soft line-clamp-2">
                {nc.descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onForzar}
            className="rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {t('form.duplicate.actions.guardar')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/nonconformities/${ncsSimilares[0].id}`)}
            className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('form.duplicate.actions.vincular')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface NCFormProps {
  onCancel?: () => void
}

export function NCForm({ onCancel }: NCFormProps) {
  const { t } = useTranslation('nonconformities')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: users = [] } = useUsers()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<CreateNCInput>({
    resolver: zodResolver(createNCSchema),
    defaultValues: {
      requiereIPER: false,
      documentosVinculados: [],
    },
  })

  const dominioValue = watch('dominio')
  const isSST = dominioValue === 'SST'
  const isAduana = dominioValue === 'ADUANERO'

  // Force requiereIPER when SST
  useEffect(() => {
    if (isSST) setValue('requiereIPER', true)
  }, [isSST, setValue])

  const { mutateAsync, data: duplicateData, reset: resetMutation } = useMutation({
    mutationFn: (data: CreateNCInput) => createNonconformity(data),
  })

  const hasDuplicate =
    duplicateData != null &&
    (duplicateData as CreateNCResponse & { warning?: string }).warning === 'POSIBLE_DUPLICADO'

  const ncsSimilares =
    hasDuplicate && duplicateData
      ? ((duplicateData as CreateNCResponse & { ncsSimilares?: NoConformidad[] }).ncsSimilares ?? [])
      : []

  const submitForm = async (data: CreateNCInput) => {
    try {
      const result = await mutateAsync(data)
      if ((result as CreateNCResponse & { warning?: string }).warning === 'POSIBLE_DUPLICADO') {
        // duplicate modal will show — don't navigate
        return
      }
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.created'))
      navigate(`/nonconformities/${result.id}`)
    } catch {
      toast.error(t('toasts.createError'))
    }
  }

  const handleForzar = async () => {
    resetMutation()
    const data = { ...getValues(), forzar: true }
    try {
      const result = await mutateAsync(data)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.created'))
      navigate(`/nonconformities/${result.id}`)
    } catch {
      toast.error(t('toasts.createError'))
    }
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const selectClass = inputClass
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'
  const errorClass = 'mt-1 text-xs text-error'

  return (
    <>
      {hasDuplicate && ncsSimilares.length > 0 && (
        <DuplicateModal
          ncsSimilares={ncsSimilares}
          onForzar={() => void handleForzar()}
          onClose={() => resetMutation()}
        />
      )}

      <form
        onSubmit={(e) => void handleSubmit(submitForm)(e)}
        noValidate
        className="space-y-6"
      >
        {/* Row 1: Dominio + Tipo + Severidad */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="dominio">
              {t('form.fields.dominio')} <span className="text-error">*</span>
            </label>
            <select id="dominio" className={selectClass} {...register('dominio')}>
              <option value="">{t('form.placeholders.select')}</option>
              {NC_DOMINIO_KEYS.map((d) => (
                <option key={d} value={d}>
                  {NC_DOMINIO_LABELS[d]}
                </option>
              ))}
            </select>
            {errors.dominio && <p className={errorClass}>{errors.dominio.message}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="tipo">
              {t('form.fields.tipo')} <span className="text-error">*</span>
            </label>
            <select id="tipo" className={selectClass} {...register('tipo')}>
              <option value="">{t('form.placeholders.select')}</option>
              <option value="PROCESO">{t('tipo.PROCESO')}</option>
              <option value="PRODUCTO">{t('tipo.PRODUCTO')}</option>
              <option value="SERVICIO">{t('tipo.SERVICIO')}</option>
              <option value="SISTEMA">{t('tipo.SISTEMA')}</option>
              <option value="SST">{t('tipo.SST')}</option>
            </select>
            {errors.tipo && <p className={errorClass}>{errors.tipo.message}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="severidad">
              {t('form.fields.severidad')} <span className="text-error">*</span>
            </label>
            <select id="severidad" className={selectClass} {...register('severidad')}>
              <option value="">{t('form.placeholders.select')}</option>
              <option value="BAJA">{t('severidad.BAJA')}</option>
              <option value="MEDIA">{t('severidad.MEDIA')}</option>
              <option value="ALTA">{t('severidad.ALTA')}</option>
              <option value="CRITICA">{t('severidad.CRITICA')}</option>
            </select>
            {errors.severidad && <p className={errorClass}>{errors.severidad.message}</p>}
          </div>
        </div>

        {/* SST Warning */}
        {isSST && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
            <div>
              <p className="text-sm font-medium text-amber">{t('form.warnings.iperTitle')}</p>
              <p className="mt-0.5 text-xs text-amber/80">{t('form.warnings.iperBody')}</p>
            </div>
          </div>
        )}

        {/* Aduana Warning */}
        {isAduana && (
          <div className="flex items-start gap-2.5 rounded-lg border border-teal/30 bg-teal/10 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-teal" />
            <div>
              <p className="text-sm font-medium text-teal">{t('form.warnings.aduanaTitle')}</p>
              <p className="mt-0.5 text-xs text-teal/80">{t('form.warnings.aduanaBody')}</p>
            </div>
          </div>
        )}

        {/* Título */}
        <div>
          <label className={labelClass} htmlFor="titulo">
            {t('form.fields.titulo')} <span className="text-error">*</span>
          </label>
          <input
            id="titulo"
            type="text"
            maxLength={300}
            className={inputClass}
            placeholder={t('form.placeholders.titulo')}
            {...register('titulo')}
          />
          {errors.titulo && <p className={errorClass}>{errors.titulo.message}</p>}
        </div>

        {/* Origen + Área */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="origen">
              {t('form.fields.origen')} <span className="text-error">*</span>
            </label>
            <select id="origen" className={selectClass} {...register('origen')}>
              <option value="">{t('form.placeholders.select')}</option>
              <option value="INSPECCION_INTERNA">{t('origen.INSPECCION_INTERNA')}</option>
              <option value="AUDITORIA_INTERNA">{t('origen.AUDITORIA_INTERNA')}</option>
              <option value="AUDITORIA_EXTERNA">{t('origen.AUDITORIA_EXTERNA')}</option>
              <option value="CLIENTE_RECLAMO">{t('origen.CLIENTE_RECLAMO')}</option>
              <option value="OPERACION_CAMPO">{t('origen.OPERACION_CAMPO')}</option>
              <option value="CONTROL_PROCESO">{t('origen.CONTROL_PROCESO')}</option>
            </select>
            {errors.origen && <p className={errorClass}>{errors.origen.message}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="areaAfectada">
              {t('form.fields.areaAfectada')} <span className="text-error">*</span>
            </label>
            <select id="areaAfectada" className={selectClass} {...register('areaAfectada')}>
              <option value="">{t('form.placeholders.areaAfectada')}</option>
              {AREAS_SHAC.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            {errors.areaAfectada && <p className={errorClass}>{errors.areaAfectada.message}</p>}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className={labelClass} htmlFor="descripcion">
            {t('form.fields.descripcion')} <span className="text-error">*</span>
          </label>
          <textarea
            id="descripcion"
            rows={4}
            maxLength={2000}
            className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
            placeholder={t('form.placeholders.descripcion')}
            {...register('descripcion')}
          />
          {errors.descripcion && <p className={errorClass}>{errors.descripcion.message}</p>}
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="fechaDeteccion">
              {t('form.fields.fechaDeteccion')} <span className="text-error">*</span>
            </label>
            <input
              id="fechaDeteccion"
              type="date"
              className={inputClass}
              {...register('fechaDeteccion')}
            />
            {errors.fechaDeteccion && (
              <p className={errorClass}>{errors.fechaDeteccion.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="fechaCierre">
              {t('form.fields.fechaCierre')} <span className="text-error">*</span>
            </label>
            <input
              id="fechaCierre"
              type="date"
              className={inputClass}
              {...register('fechaCierre')}
            />
            {errors.fechaCierre && <p className={errorClass}>{errors.fechaCierre.message}</p>}
          </div>
        </div>

        {/* Proceso + Detectado por */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="procesoInvolucrado">
              {t('form.fields.procesoInvolucrado')}
            </label>
            <input
              id="procesoInvolucrado"
              type="text"
              maxLength={300}
              className={inputClass}
              placeholder={t('form.placeholders.procesoInvolucrado')}
              {...register('procesoInvolucrado')}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="detectadoPorId">
              {t('form.fields.detectadoPor')}
            </label>
            <select id="detectadoPorId" className={selectClass} {...register('detectadoPorId')}>
              <option value="">{t('form.placeholders.select')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.rol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Turno + Mineral */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="turno">
              {t('form.fields.turno')}
            </label>
            <select id="turno" className={selectClass} {...register('turno')}>
              <option value="">{t('form.placeholders.select')}</option>
              <option value="TODOS">{t('form.turno.TODOS')}</option>
              <option value="DIA">{t('form.turno.DIA')}</option>
              <option value="TARDE">{t('form.turno.TARDE')}</option>
              <option value="NOCHE">{t('form.turno.NOCHE')}</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="mineralInvolucrado">
              {t('form.fields.mineralInvolucrado')}
            </label>
            <input
              id="mineralInvolucrado"
              type="text"
              maxLength={100}
              className={inputClass}
              placeholder={t('form.placeholders.mineralInvolucrado')}
              {...register('mineralInvolucrado')}
            />
          </div>
        </div>

        {/* Acción Inmediata */}
        <div>
          <label className={labelClass} htmlFor="accionInmediata">
            {t('form.fields.accionInmediata')}
          </label>
          <textarea
            id="accionInmediata"
            rows={3}
            maxLength={1000}
            className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
            placeholder={t('form.placeholders.accionInmediata')}
            {...register('accionInmediata')}
          />
        </div>

        {/* Requiere IPER */}
        <div className="flex items-start gap-3">
          <input
            id="requiereIPER"
            type="checkbox"
            disabled={isSST}
            className="mt-0.5 h-4 w-4 rounded border-hairline text-coral focus:ring-coral dark:border-hairline/20 disabled:cursor-not-allowed disabled:opacity-70"
            {...register('requiereIPER')}
          />
          <label htmlFor="requiereIPER" className="text-sm text-body dark:text-on-dark-soft">
            {t('form.fields.requiereIPER')}
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4 dark:border-hairline/20">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('form.actions.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
          >
            {isSubmitting ? t('form.actions.submitting') : t('form.actions.submit')}
          </button>
        </div>
      </form>
    </>
  )
}
