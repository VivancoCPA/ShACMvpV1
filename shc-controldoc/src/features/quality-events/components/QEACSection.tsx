import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, X, CheckCircle, Play, AlertTriangle, CalendarClock, ThumbsUp, ThumbsDown, ShieldCheck, Paperclip } from 'lucide-react'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { useUserNames } from '../../users/hooks/useUserNames'
import { useAuthStore } from '../../../stores/authStore'
import { getCandidatosResponsableAC } from '../../../api/endpoints/users.api'
import { AC_TIPOS, isAccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'
import { candidatosResponsableACQueryKey, useCandidatosResponsableAC } from '../hooks/useCandidatosResponsableAC'
import { useCreateQEAccion } from '../hooks/useCreateQEAccion'
import { useEjecutarQEAccion, useIniciarQEAccion, useVerificarQEAccion } from '../hooks/useAccionCorrectivaFlujo'
import { useSolicitarAjustePlazoAC } from '../hooks/useSolicitarAjustePlazoAC'
import { useRevisarAjustePlazoAC } from '../hooks/useRevisarAjustePlazoAC'
import { useDescartarSolicitudAC } from '../hooks/useDescartarSolicitudAC'
import type { DescartarSolicitudACInput } from '../schemas/descartarSolicitudAC.schema'
import { createQEAccionSchema, type CreateQEACInput } from '../schemas/createQEAccion.schema'
import type { EjecutarQEACInput } from '../schemas/ejecutarQEAccion.schema'
import type { VerificarQEACInput } from '../schemas/verificarQEAccion.schema'
import { EjecutarQEACModal } from './EjecutarQEACModal'
import { VerificarQEACModal } from './VerificarQEACModal'
import { DescartarSolicitudACModal } from './DescartarSolicitudACModal'
import { EvidenciaACItem } from './EvidenciaACItem'
import { solicitarAjustePlazoACSchema, type SolicitarAjustePlazoACInput } from '../schemas/solicitarAjustePlazoAC.schema'
import { rechazarAjustePlazoACSchema, type RechazarAjustePlazoACInput } from '../schemas/rechazarAjustePlazoAC.schema'
import { PLAZO_MINIMO_DIAS_HABILES } from '../constants/plazoAjuste.constants'
import { AC_CREATE_VISIBLE_STATES } from '../constants/accionCorrectivaQE.constants'
import { calcularRequiereAprobacionGerencia } from '../constants/plazoAjuste.utils'
import { contarDiasHabiles } from '../../../utils/businessDays'
import type { AccionCorrectivaQE, QEStatus, QESeverity, SolicitudAjustePlazoAC } from '../types/qualityEvent.types'

const AC_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-muted-soft/20 text-muted',
  EN_EJECUCION: 'bg-amber/20 text-amber',
  COMPLETADA: 'bg-teal/20 text-teal',
  CERRADA: 'bg-success/20 text-success',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  BAJA: 'bg-teal/10 text-teal',
  MEDIA: 'bg-amber/10 text-amber',
  ALTA: 'bg-error/10 text-error',
  CRITICA: 'bg-error/20 text-error font-semibold',
}

function getPendienteSolicitud(ac: AccionCorrectivaQE): SolicitudAjustePlazoAC | undefined {
  return ac.solicitudesAjustePlazo.find((s) => s.estado === 'PENDIENTE')
}

// ─── AgregarQEACModal ─────────────────────────────────────────────────────────

// Exportado para "Crear AC" desde una acción sugerida por el asistente IA (qe-asistente-ia):
// llega con la descripción precargada y una ayuda (tipo/rol/plazo sugeridos) encima del form.
export function AgregarQEACModal({
  onConfirm,
  onClose,
  isPending,
  defaultValues,
  ayuda,
}: {
  onConfirm: (data: CreateQEACInput) => Promise<void>
  onClose: () => void
  isPending: boolean
  defaultValues?: Partial<CreateQEACInput>
  ayuda?: ReactNode
}) {
  const { t } = useTranslation('qualityEvents')
  const queryClient = useQueryClient()
  const [avisoResponsable, setAvisoResponsable] = useState<string | null>(null)
  const esAdminEmpresa = useAuthStore((s) => s.user?.rol === 'ADMINISTRADOR_EMPRESA')

  // `prioridad` usa `z.preprocess()` en el schema (normaliza '' a undefined
  // antes de validar el enum), lo que hace que TFieldValues (input) difiera
  // de TTransformedValues (output) — se pasan ambos generics explícitos para
  // que coincidan con lo que infiere `zodResolver()` realmente ("Two
  // different types with this name exist").
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createQEAccionSchema>, unknown, CreateQEACInput>({
    resolver: zodResolver(createQEAccionSchema),
    defaultValues,
  })

  // ac-tipo-responsables: el responsable se elige entre los candidatos del tipo de acción.
  const tipoValue = watch('tipo')
  const tipo = isAccionCorrectivaTipo(tipoValue) ? tipoValue : undefined
  const { data: candidatos = [], isLoading: cargandoCandidatos } = useCandidatosResponsableAC(tipo)

  // Al cambiar el tipo (en el handler, no en un efecto): si el responsable elegido no está entre los
  // candidatos del tipo nuevo, se limpia y se avisa inline.
  const onTipoChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const nuevoTipo = e.target.value
    setAvisoResponsable(null)
    const responsableId = getValues('responsableId')
    if (!isAccionCorrectivaTipo(nuevoTipo) || !responsableId) return

    const nombreAnterior = candidatos.find((c) => c.id === responsableId)?.nombreCompleto
    const nuevosCandidatos = await queryClient.fetchQuery({
      queryKey: candidatosResponsableACQueryKey(nuevoTipo),
      queryFn: () => getCandidatosResponsableAC(nuevoTipo),
      staleTime: 60_000,
    })
    // El usuario pudo volver a cambiar el tipo mientras se cargaba la lista.
    if (getValues('tipo') !== nuevoTipo || getValues('responsableId') !== responsableId) return
    if (nuevosCandidatos.some((c) => c.id === responsableId)) return

    setValue('responsableId', '', { shouldValidate: false })
    setAvisoResponsable(
      t('detail.acSection.responsableNoValido', {
        nombre: nombreAnterior ?? t('common:userNames.noDisponible'),
        tipo: t(`common:acTipo.${nuevoTipo}`),
      }),
    )
  }

  // El backend valida el responsable con la política del tipo y responde un error de campo
  // `responsableId: ...` (FieldValidationException) — se muestra en el propio campo.
  const onSubmit = async (data: CreateQEACInput) => {
    try {
      await onConfirm(data)
    } catch (error) {
      const serverErrors = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      const campoResponsable = serverErrors?.find((e) => e.startsWith('responsableId:'))
      if (campoResponsable) {
        setError('responsableId', { message: campoResponsable.slice('responsableId:'.length).trim() })
      }
    }
  }

  const responsablePlaceholder = !tipo
    ? t('detail.acSection.placeholders.elegirTipoPrimero')
    : t('detail.acSection.placeholders.responsable')

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas shadow-xl dark:bg-surface-dark-elevated">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-hairline/20">
          <h2 className="font-medium text-ink dark:text-on-dark">
            {t('detail.acSection.agregarModal.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail.acSection.actions.cancel')}
            className="text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <div className="space-y-4 px-6 py-5">
            {ayuda}
            <div>
              <label htmlFor="qeac-titulo" className={labelClass}>
                {t('detail.acSection.fields.titulo')}
              </label>
              <input
                id="qeac-titulo"
                type="text"
                maxLength={200}
                className={inputClass}
                placeholder={t('detail.acSection.placeholders.titulo')}
                {...register('titulo')}
              />
              {errors.titulo && <p className="mt-1 text-xs text-error">{errors.titulo.message}</p>}
            </div>

            <div>
              <label htmlFor="qeac-descripcion" className={labelClass}>
                {t('detail.acSection.fields.descripcion')} <span className="text-error">*</span>
              </label>
              <textarea
                id="qeac-descripcion"
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                placeholder={t('detail.acSection.placeholders.descripcion')}
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="mt-1 text-xs text-error">{errors.descripcion.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="qeac-tipo" className={labelClass}>
                  {t('detail.acSection.fields.tipo')} <span className="text-error">*</span>
                </label>
                <select
                  id="qeac-tipo"
                  className={inputClass}
                  {...register('tipo', { onChange: (e: ChangeEvent<HTMLSelectElement>) => void onTipoChange(e) })}
                >
                  <option value="">{t('detail.acSection.placeholders.tipo')}</option>
                  {AC_TIPOS.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(`common:acTipo.${tp}`)}
                    </option>
                  ))}
                </select>
                {errors.tipo && (
                  <p className="mt-1 text-xs text-error">{t('detail.acSection.errors.tipoRequerido')}</p>
                )}
              </div>

              <div>
                <label htmlFor="qeac-responsable" className={labelClass}>
                  {t('detail.acSection.fields.responsable')} <span className="text-error">*</span>
                </label>
                <select
                  id="qeac-responsable"
                  className={`${inputClass} disabled:opacity-60`}
                  disabled={!tipo}
                  {...register('responsableId', { onChange: () => setAvisoResponsable(null) })}
                >
                  <option value="">{responsablePlaceholder}</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombreCompleto} · {t(`auth:roles.${c.rol}`)}
                    </option>
                  ))}
                </select>
                {avisoResponsable && (
                  <p role="status" className="mt-1 text-xs text-warning dark:text-warning">
                    {avisoResponsable}
                  </p>
                )}
                {tipo && !cargandoCandidatos && candidatos.length === 0 && (
                  <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
                    {t('detail.acSection.sinCandidatos')}{' '}
                    {/* ac-responsables-configurable-empresa: la tabla tipo → roles es configurable por empresa. */}
                    {esAdminEmpresa
                      ? t('detail.acSection.sinCandidatosAdmin')
                      : t('detail.acSection.sinCandidatosConsulta')}
                  </p>
                )}
                {errors.responsableId && (
                  <p className="mt-1 text-xs text-error">{errors.responsableId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="qeac-prioridad" className={labelClass}>
                  {t('detail.acSection.fields.prioridad')}
                </label>
                <select id="qeac-prioridad" className={inputClass} {...register('prioridad')}>
                  <option value="">{t('detail.acSection.placeholders.prioridad')}</option>
                  {(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`detail.acSection.prioridad.${p}`)}
                    </option>
                  ))}
                </select>
                {errors.prioridad && (
                  <p className="mt-1 text-xs text-error">{errors.prioridad.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="qeac-plazo" className={labelClass}>
                  {t('detail.acSection.fields.plazoFecha')} <span className="text-error">*</span>
                </label>
                <input id="qeac-plazo" type="date" className={inputClass} {...register('plazoFecha')} />
                {errors.plazoFecha && (
                  <p className="mt-1 text-xs text-error">{errors.plazoFecha.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-hairline px-6 py-4 dark:border-hairline/20">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('detail.acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {t('detail.acSection.actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── SolicitarAjustePlazoModal ────────────────────────────────────────────────

function SolicitarAjustePlazoModal({
  ac,
  qeSeveridad,
  onConfirm,
  onClose,
  isPending,
}: {
  ac: AccionCorrectivaQE
  qeSeveridad: QESeverity
  onConfirm: (data: SolicitarAjustePlazoACInput) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t } = useTranslation('qualityEvents')

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SolicitarAjustePlazoACInput>({ resolver: zodResolver(solicitarAjustePlazoACSchema) })

  const fechaSolicitada = watch('fechaSolicitada')
  const fechaValida = !!fechaSolicitada && !Number.isNaN(new Date(fechaSolicitada).getTime())

  const incrementoDiasHabiles = fechaValida
    ? contarDiasHabiles(new Date(ac.plazoFecha), new Date(fechaSolicitada))
    : 0
  const totalPlazoDiasHabiles = fechaValida
    ? contarDiasHabiles(new Date(ac.creadoEn), new Date(fechaSolicitada))
    : 0
  const requiereAprobacionGerencia = calcularRequiereAprobacionGerencia(qeSeveridad, incrementoDiasHabiles)
  const bajoElMinimo = fechaValida && totalPlazoDiasHabiles < PLAZO_MINIMO_DIAS_HABILES[qeSeveridad]

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  const onSubmit = (data: SolicitarAjustePlazoACInput) => {
    if (bajoElMinimo) {
      setError('fechaSolicitada', { message: t('detail.acSection.ajustePlazo.modal.errors.minimo') })
      return
    }
    clearErrors('fechaSolicitada')
    onConfirm(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.ajustePlazo.modal.title')}
        </h2>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="qeac-ajuste-fecha" className={labelClass}>
              {t('detail.acSection.ajustePlazo.modal.fields.fechaSolicitada')} <span className="text-error">*</span>
            </label>
            <input id="qeac-ajuste-fecha" type="date" className={inputClass} {...register('fechaSolicitada')} />
            {errors.fechaSolicitada && (
              <p className="mt-1 text-xs text-error">{errors.fechaSolicitada.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="qeac-ajuste-justificacion" className={labelClass}>
              {t('detail.acSection.ajustePlazo.modal.fields.justificacion')} <span className="text-error">*</span>
            </label>
            <textarea
              id="qeac-ajuste-justificacion"
              rows={4}
              maxLength={2000}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              placeholder={t('detail.acSection.ajustePlazo.modal.placeholders.justificacion')}
              {...register('justificacion')}
            />
            {errors.justificacion && (
              <p className="mt-1 text-xs text-error">{errors.justificacion.message}</p>
            )}
          </div>

          {fechaValida && (
            <span
              className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${
                requiereAprobacionGerencia ? 'bg-error/10 text-error' : 'bg-teal/10 text-teal'
              }`}
            >
              {requiereAprobacionGerencia
                ? t('detail.acSection.ajustePlazo.modal.badgeGerencia')
                : t('detail.acSection.ajustePlazo.modal.badgeJefeCalidad')}
            </span>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('detail.acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {t('detail.acSection.ajustePlazo.modal.actions.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── RechazarAjustePlazoModal ─────────────────────────────────────────────────

function RechazarAjustePlazoModal({
  onConfirm,
  onClose,
  isPending,
}: {
  onConfirm: (data: RechazarAjustePlazoACInput) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t } = useTranslation('qualityEvents')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RechazarAjustePlazoACInput>({ resolver: zodResolver(rechazarAjustePlazoACSchema) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.ajustePlazo.rechazarModal.title')}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
          {t('detail.acSection.ajustePlazo.rechazarModal.body')}
        </p>

        <form onSubmit={(e) => void handleSubmit(onConfirm)(e)} className="space-y-4">
          <div>
            <label
              htmlFor="qeac-ajuste-comentarioRevision"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('detail.acSection.ajustePlazo.rechazarModal.fields.comentarioRevision')} <span className="text-error">*</span>
            </label>
            <textarea
              id="qeac-ajuste-comentarioRevision"
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              {...register('comentarioRevision')}
            />
            {errors.comentarioRevision && (
              <p className="mt-1 text-xs text-error">{errors.comentarioRevision.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('detail.acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {t('detail.acSection.ajustePlazo.rechazarModal.actions.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AjustePlazoPanel ─────────────────────────────────────────────────────────

function AjustePlazoPanel({
  solicitud,
  canDecide,
  onAprobar,
  onRechazar,
  isPending,
}: {
  solicitud: SolicitudAjustePlazoAC
  canDecide: boolean
  onAprobar: () => void
  onRechazar: () => void
  isPending: boolean
}) {
  const { t, i18n } = useTranslation('qualityEvents')
  // GET /api/users/nombres (sin restricción de rol) — nunca se muestra el id; si no se resuelve,
  // getName devuelve "Usuario no disponible" (ac-tipo-responsables).
  const { getName } = useUserNames([solicitud.solicitadoPorId])
  const solicitanteNombre = getName(solicitud.solicitadoPorId)
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <div className="mt-2 rounded-md border border-hairline bg-canvas p-3 dark:border-hairline/20 dark:bg-surface-dark">
      <p className="text-xs font-medium text-body dark:text-on-dark">
        {t('detail.acSection.ajustePlazo.panel.title')}
      </p>
      <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
        {t('detail.acSection.ajustePlazo.panel.solicitadoPor', { nombre: solicitanteNombre })}
      </p>
      <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
        {t('detail.acSection.ajustePlazo.panel.fechaSolicitada', {
          fecha: dateFormatter.format(new Date(solicitud.fechaSolicitada)),
        })}
      </p>
      <p className="mt-1 text-xs text-body dark:text-on-dark-soft">{solicitud.justificacion}</p>
      <span
        className={`mt-2 inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${
          solicitud.requiereAprobacionGerencia ? 'bg-error/10 text-error' : 'bg-teal/10 text-teal'
        }`}
      >
        {solicitud.requiereAprobacionGerencia
          ? t('detail.acSection.ajustePlazo.modal.badgeGerencia')
          : t('detail.acSection.ajustePlazo.modal.badgeJefeCalidad')}
      </span>

      {canDecide && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAprobar}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-success/40 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-60"
          >
            <ThumbsUp size={11} />
            {t('detail.acSection.ajustePlazo.panel.actions.aprobar')}
          </button>
          <button
            type="button"
            onClick={onRechazar}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-error/40 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-60"
          >
            <ThumbsDown size={11} />
            {t('detail.acSection.ajustePlazo.panel.actions.rechazar')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── QEACSection ──────────────────────────────────────────────────────────────

interface QEACSectionProps {
  qeId: string
  qeEstado: QEStatus
  qeSeveridad: QESeverity
  accionesCorrectivas: AccionCorrectivaQE[]
  solicitudesAC: number
  readOnly?: boolean
}

export function QEACSection({
  qeId,
  qeEstado,
  qeSeveridad,
  accionesCorrectivas,
  solicitudesAC,
  readOnly = false,
}: QEACSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)

  const [showAddModal, setShowAddModal] = useState(false)
  const [ejecutandoAcId, setEjecutandoAcId] = useState<string | null>(null)
  const [verificandoAcId, setVerificandoAcId] = useState<string | null>(null)
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState<string | null>(null)
  const [solicitandoAjusteAcId, setSolicitandoAjusteAcId] = useState<string | null>(null)
  const [rechazandoSolicitud, setRechazandoSolicitud] = useState<{ acId: string; solicitudId: string } | null>(null)
  const [descartandoSolicitud, setDescartandoSolicitud] = useState(false)

  // The verify-AC endpoint returns only the AC, not the parent QE — the auto-transition to
  // PENDIENTE_CIERRE (RN-QE-003) is observed via the qeEstado prop changing after the query
  // invalidation refetches the QE detail, not from the mutation's own response.
  const previousEstadoRef = useRef(qeEstado)
  useEffect(() => {
    if (previousEstadoRef.current === 'EN_EJECUCION' && qeEstado === 'PENDIENTE_CIERRE') {
      toast.info(t('detail.acSection.autoTransitionToast'))
    }
    previousEstadoRef.current = qeEstado
  }, [qeEstado, t])

  const createAC = useCreateQEAccion(qeId)
  const iniciarAC = useIniciarQEAccion(qeId)
  const ejecutarAC = useEjecutarQEAccion(qeId)
  const verificarAC = useVerificarQEAccion(qeId)
  const solicitarAjustePlazo = useSolicitarAjustePlazoAC(qeId)
  const revisarAjustePlazo = useRevisarAjustePlazoAC(qeId)
  const descartarSolicitud = useDescartarSolicitudAC(qeId)

  const canAsignarAC =
    !readOnly && user?.rol === 'JEFE_CALIDAD_SYST' && AC_CREATE_VISIBLE_STATES.includes(qeEstado)
  const showSolicitudesACBanner = user?.rol === 'JEFE_CALIDAD_SYST' && solicitudesAC > 0
  const cerradas = accionesCorrectivas.filter((ac) => ac.estado === 'CERRADA').length

  const esJca = user?.rol === 'JEFE_CALIDAD_SYST'
  const solicitandoAjusteAc = accionesCorrectivas.find((ac) => ac.id === solicitandoAjusteAcId)
  const ejecutandoAc = accionesCorrectivas.find((ac) => ac.id === ejecutandoAcId)
  const verificandoAc = accionesCorrectivas.find((ac) => ac.id === verificandoAcId)
  const formatoFecha = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  const onDescartarConfirm = (data: DescartarSolicitudACInput) => {
    descartarSolicitud.mutate(data.motivo, { onSuccess: () => setDescartandoSolicitud(false) })
  }

  const onAddAC = async (data: CreateQEACInput) => {
    await createAC.mutateAsync(data)
    setShowAddModal(false)
  }

  const onIniciar = (acId: string) => {
    iniciarAC.mutate(acId)
  }

  const onEjecutarConfirm = (data: EjecutarQEACInput) => {
    if (!ejecutandoAcId) return
    ejecutarAC.mutate({ acId: ejecutandoAcId, data }, { onSuccess: () => setEjecutandoAcId(null) })
  }

  const onVerificar = (data: VerificarQEACInput) => {
    if (!verificandoAcId) return
    verificarAC.mutate({ acId: verificandoAcId, data }, { onSuccess: () => setVerificandoAcId(null) })
  }

  const onSolicitarAjusteConfirm = (data: SolicitarAjustePlazoACInput) => {
    if (!solicitandoAjusteAcId) return
    const ac = accionesCorrectivas.find((a) => a.id === solicitandoAjusteAcId)
    if (!ac) return
    const incrementoDiasHabiles = contarDiasHabiles(new Date(ac.plazoFecha), new Date(data.fechaSolicitada))
    const requiereAprobacionGerencia = calcularRequiereAprobacionGerencia(qeSeveridad, incrementoDiasHabiles)
    solicitarAjustePlazo.mutate(
      { acId: solicitandoAjusteAcId, data },
      {
        onSuccess: () => {
          setSolicitandoAjusteAcId(null)
          toast.success(t('detail.acSection.ajustePlazo.toasts.solicitudEnviada'))
          toast.info(
            requiereAprobacionGerencia
              ? t('detail.acSection.ajustePlazo.toasts.aprobadorNotificadoGerencia')
              : t('detail.acSection.ajustePlazo.toasts.aprobadorNotificadoJefeCalidad'),
          )
        },
      },
    )
  }

  const onAprobarSolicitud = (acId: string, solicitudId: string) => {
    revisarAjustePlazo.mutate(
      { acId, solicitudId, data: { accion: 'APROBAR' } },
      {
        onSuccess: () => {
          toast.success(t('detail.acSection.ajustePlazo.toasts.aprobado'))
          toast.info(t('detail.acSection.ajustePlazo.toasts.responsableNotificado'))
        },
      },
    )
  }

  const onRechazarConfirm = (data: RechazarAjustePlazoACInput) => {
    if (!rechazandoSolicitud) return
    revisarAjustePlazo.mutate(
      {
        acId: rechazandoSolicitud.acId,
        solicitudId: rechazandoSolicitud.solicitudId,
        data: { accion: 'RECHAZAR', comentarioRevision: data.comentarioRevision },
      },
      {
        onSuccess: () => {
          setRechazandoSolicitud(null)
          toast.info(t('detail.acSection.ajustePlazo.toasts.rechazado'))
          toast.info(t('detail.acSection.ajustePlazo.toasts.responsableNotificado'))
        },
      },
    )
  }

  return (
    <section
      id="qe-ac-section"
      aria-labelledby="qe-ac-section-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      {showAddModal && (
        <AgregarQEACModal onConfirm={onAddAC} onClose={() => setShowAddModal(false)} isPending={createAC.isPending} />
      )}

      {ejecutandoAc && (
        <EjecutarQEACModal
          qeId={qeId}
          ac={ejecutandoAc}
          onConfirm={onEjecutarConfirm}
          onClose={() => setEjecutandoAcId(null)}
          isPending={ejecutarAC.isPending}
        />
      )}

      {verificandoAc && (
        <VerificarQEACModal
          qeId={qeId}
          ac={verificandoAc}
          onVerificar={onVerificar}
          onClose={() => setVerificandoAcId(null)}
          isPending={verificarAC.isPending}
        />
      )}

      {solicitandoAjusteAc && (
        <SolicitarAjustePlazoModal
          ac={solicitandoAjusteAc}
          qeSeveridad={qeSeveridad}
          onConfirm={onSolicitarAjusteConfirm}
          onClose={() => setSolicitandoAjusteAcId(null)}
          isPending={solicitarAjustePlazo.isPending}
        />
      )}

      {rechazandoSolicitud && (
        <RechazarAjustePlazoModal
          onConfirm={onRechazarConfirm}
          onClose={() => setRechazandoSolicitud(null)}
          isPending={revisarAjustePlazo.isPending}
        />
      )}

      {descartandoSolicitud && (
        <DescartarSolicitudACModal
          onConfirm={onDescartarConfirm}
          onClose={() => setDescartandoSolicitud(false)}
          isPending={descartarSolicitud.isPending}
        />
      )}

      {showSolicitudesACBanner && (
        <div className="mb-4 flex flex-wrap items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning dark:border-warning/30 dark:bg-warning/10 dark:text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">{t('detail.acSection.solicitudesACBanner', { count: solicitudesAC })}</p>
          {/* qe-quitar-boton-crear-ac-duplicado: la AC se crea con "Nueva AC" del encabezado (descuenta la solicitud en el servidor); aquí solo se descarta. */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setDescartandoSolicitud(true)}
              className="shrink-0 rounded-md border border-warning/40 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10 dark:border-warning/40 dark:text-warning dark:hover:bg-warning/10"
            >
              {t('detail.acSection.descartarSolicitud')}
            </button>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 id="qe-ac-section-title" className="text-base font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.title')}
          <span className="ml-2 text-sm font-normal text-muted dark:text-on-dark-soft">
            {t('detail.acSection.progreso', { cerradas, total: accionesCorrectivas.length })}
          </span>
        </h2>

        {canAsignarAC && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-white hover:bg-coral-dark"
          >
            <Plus size={14} />
            {t('detail.acSection.actions.add')}
          </button>
        )}
      </div>

      {accionesCorrectivas.length === 0 ? (
        <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('detail.acSection.empty')}</p>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-hairline/20">
          {accionesCorrectivas.map((ac) => {
            const pendienteSolicitud = getPendienteSolicitud(ac)
            // ac-ejecucion-verificacion-evidencias: el responsable inicia y ejecuta; el JCA verifica.
            // Un JCA que además es el responsable ve ambas acciones según el estado.
            const esResponsable = user?.id === ac.responsableId
            const evidencias = ac.evidencias ?? []
            const canSolicitarAjuste =
              !readOnly &&
              esResponsable &&
              (ac.estado === 'PENDIENTE' || ac.estado === 'EN_EJECUCION') &&
              !pendienteSolicitud
            const canDecideSolicitud =
              !!pendienteSolicitud &&
              !readOnly &&
              ((pendienteSolicitud.requiereAprobacionGerencia === false && user?.rol === 'JEFE_CALIDAD_SYST') ||
                (pendienteSolicitud.requiereAprobacionGerencia === true && user?.rol === 'ALTA_DIRECCION'))

            return (
              <li key={ac.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {ac.titulo && (
                      <p className="text-sm font-medium text-body dark:text-on-dark">{ac.titulo}</p>
                    )}
                    <p className="text-sm text-body dark:text-on-dark-soft">
                      {ac.descripcion}
                      {ac.tipo && (
                        <span className="ml-2 inline-flex rounded-xs border border-hairline px-1.5 py-0.5 align-middle text-[11px] font-medium text-muted dark:border-hairline/20 dark:text-on-dark-soft">
                          {t(`common:acTipo.${ac.tipo}`)}
                        </span>
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs font-medium ${AC_STATUS_COLORS[ac.estado] ?? 'bg-muted-soft/20 text-muted'}`}
                      >
                        {t(`detail.acSection.acStatus.${ac.estado}`)}
                      </span>
                      {ac.prioridad && (
                        <span
                          className={`rounded-pill px-2 py-0.5 text-xs ${PRIORIDAD_COLORS[ac.prioridad] ?? ''}`}
                        >
                          {t(`detail.acSection.prioridad.${ac.prioridad}`)}
                        </span>
                      )}
                      <span className="text-xs text-muted dark:text-on-dark-soft">{ac.responsableNombre}</span>
                      <DeadlineBadge fechaCierre={ac.plazoFecha} estado={ac.estado} />
                    </div>
                    {ac.estado === 'EN_EJECUCION' && ac.motivoDevolucion && (
                      <p
                        role="status"
                        className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 text-xs text-amber dark:border-amber/40 dark:bg-amber/10 dark:text-amber"
                      >
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {t('detail.acSection.devuelta', { motivo: ac.motivoDevolucion })}
                      </p>
                    )}
                    {(ac.estado === 'COMPLETADA' || ac.estado === 'CERRADA') && ac.descripcionEvidencia && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-success dark:text-success">
                        <CheckCircle size={12} />
                        {ac.descripcionEvidencia}
                      </p>
                    )}
                    {ac.estado === 'CERRADA' && ac.verificadaPorNombre && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted dark:text-on-dark-soft">
                        <ShieldCheck size={12} aria-hidden="true" />
                        {t('detail.acSection.verificadaPor', {
                          nombre: ac.verificadaPorNombre,
                          fecha: ac.verificadaEn ? formatoFecha.format(new Date(ac.verificadaEn)) : '—',
                        })}
                      </p>
                    )}
                    {ac.estado === 'CERRADA' && evidencias.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEvidenciasAbiertas(evidenciasAbiertas === ac.id ? null : ac.id)}
                        aria-expanded={evidenciasAbiertas === ac.id}
                        className="mt-1 flex items-center gap-1 text-xs text-coral hover:underline dark:text-coral"
                      >
                        <Paperclip size={12} aria-hidden="true" />
                        {t('detail.acSection.evidencias.ver', { count: evidencias.length })}
                      </button>
                    )}
                    {evidenciasAbiertas === ac.id && (
                      <ul className="mt-2 space-y-2">
                        {evidencias.map((ev) => (
                          <EvidenciaACItem key={ev.id} qeId={qeId} acId={ac.id} evidencia={ev} />
                        ))}
                      </ul>
                    )}
                    {ac.evidenciaUrl && (
                      <a
                        href={ac.evidenciaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-coral hover:underline dark:text-coral"
                      >
                        <Paperclip size={12} aria-hidden="true" />
                        {t('detail.acSection.evidencias.historica')}
                      </a>
                    )}

                    {pendienteSolicitud && (
                      <AjustePlazoPanel
                        solicitud={pendienteSolicitud}
                        canDecide={canDecideSolicitud}
                        onAprobar={() => onAprobarSolicitud(ac.id, pendienteSolicitud.id)}
                        onRechazar={() => setRechazandoSolicitud({ acId: ac.id, solicitudId: pendienteSolicitud.id })}
                        isPending={revisarAjustePlazo.isPending}
                      />
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {!readOnly && esResponsable && ac.estado === 'PENDIENTE' && (
                      <button
                        type="button"
                        onClick={() => onIniciar(ac.id)}
                        disabled={iniciarAC.isPending}
                        className="flex items-center gap-1 rounded-md border border-teal/40 px-2.5 py-1 text-xs font-medium text-teal hover:bg-teal/10 disabled:opacity-60"
                      >
                        <Play size={11} />
                        {t('detail.acSection.actions.iniciar')}
                      </button>
                    )}
                    {!readOnly && esResponsable && ac.estado === 'EN_EJECUCION' && (
                      <button
                        type="button"
                        onClick={() => setEjecutandoAcId(ac.id)}
                        className="flex items-center gap-1 rounded-md border border-success/40 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 dark:border-success/40 dark:text-success"
                      >
                        <CheckCircle size={11} />
                        {t('detail.acSection.actions.marcarEjecutada')}
                      </button>
                    )}
                    {!readOnly && esJca && ac.estado === 'COMPLETADA' && (
                      <button
                        type="button"
                        onClick={() => setVerificandoAcId(ac.id)}
                        className="flex items-center gap-1 rounded-md bg-coral px-2.5 py-1 text-xs font-medium text-white hover:bg-coral-dark dark:bg-coral dark:hover:bg-coral-dark"
                      >
                        <ShieldCheck size={11} />
                        {t('detail.acSection.actions.verificar')}
                      </button>
                    )}
                    {canSolicitarAjuste && (
                      <button
                        type="button"
                        onClick={() => setSolicitandoAjusteAcId(ac.id)}
                        className="flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-soft dark:border-hairline/20 dark:text-on-dark-soft dark:hover:bg-surface-dark-soft"
                      >
                        <CalendarClock size={11} />
                        {t('detail.acSection.ajustePlazo.actions.solicitar')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
