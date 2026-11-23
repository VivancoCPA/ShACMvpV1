import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { z } from 'zod'
import type { AxiosError } from 'axios'
import { useAuthStore } from '../../../stores/authStore'
import { useArea } from '../../areas/hooks/useAreas'
import { useCerrarQE } from '../hooks/useCerrarQE'
import { useFirmarCierre } from '../hooks/useFirmarCierre'
import { useRechazarCierreQE } from '../hooks/useRechazarCierreQE'
import { qualityEventCierreFormSchema, type QualityEventCierreFormInput } from '../schemas/qualityEventCierre.schema'
import { rechazarCierreSchema, type RechazarCierreInput } from '../schemas/rechazarCierre.schema'
import { resolveRolSegundaFirma } from '../utils/qualityEventPermissions'
import type { QualityEvent, QEStatus, QEAuditTrailEntry } from '../types/qualityEvent.types'

type CierreFormFields = z.input<typeof qualityEventCierreFormSchema>

const VISIBLE_STATES: QEStatus[] = ['PENDIENTE_CIERRE', 'CERRADO', 'EN_VERIFICACION', 'VERIFICADO']
const PLAZO_OPTIONS = [30, 60, 90] as const

interface QECierreSectionProps {
  qe: QualityEvent
}

function PinModal({
  titleKey,
  onConfirm,
  onClose,
  isPending,
  tienePinFirma,
  pinResetMidSession,
}: {
  titleKey: string
  onConfirm: (pin: string) => void
  onClose: () => void
  isPending: boolean
  tienePinFirma: boolean | undefined
  /** El backend respondió errorCode: 'PIN_NO_CONFIGURADO' aunque tienePinFirma fuera true al
   *  abrir el modal (el PIN se reseteó entre medio) — ver design.md D6. */
  pinResetMidSession: boolean
}) {
  const { t } = useTranslation('qualityEvents')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const noPinConfigured = tienePinFirma === false || pinResetMidSession

  const handleSubmit = () => {
    if (!/^\d{4}$/.test(pin)) {
      setError(true)
      return
    }
    setError(false)
    onConfirm(pin)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-sm rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.cierre.pinModal.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">{t(titleKey)}</h2>

        {noPinConfigured ? (
          <div className="mb-4 rounded-md border border-hairline bg-surface-card px-3.5 py-2.5 text-sm text-body dark:border-hairline/20 dark:bg-surface-dark-elevated dark:text-on-dark">
            <p className="mb-1.5">{t('detail.cierre.pinModal.noPinConfigured')}</p>
            <Link to="/perfil#pin-firma" className="font-medium text-coral hover:underline">
              {t('detail.cierre.pinModal.configurePinLink')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">{t('detail.cierre.pinModal.body')}</p>
            <label htmlFor="qe-cierre-pin-input" className="sr-only">
              {t('detail.cierre.pinModal.placeholder')}
            </label>
            <input
              id="qe-cierre-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('detail.cierre.pinModal.placeholder')}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
            />
            {error && <p className="mt-1 text-xs text-error">{t('detail.cierre.pinModal.error')}</p>}
            <Link
              to="/perfil#pin-firma"
              className="mt-1.5 inline-block text-xs text-coral hover:underline dark:text-coral"
            >
              {t('detail.cierre.pinModal.forgotPinLink')}
            </Link>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('detail.cierre.pinModal.cancel')}
          </button>
          {!noPinConfigured && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {t('detail.cierre.pinModal.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const errorCodeOf = (error: unknown): string | undefined =>
  (error as AxiosError<{ errorCode?: string }> | null)?.response?.data?.errorCode

// Última entrada que cumple el predicado (el audit trail viene en orden cronológico).
function ultimaEntrada(
  auditTrail: QEAuditTrailEntry[],
  predicado: (entry: QEAuditTrailEntry) => boolean,
): QEAuditTrailEntry | undefined {
  return [...auditTrail].reverse().find(predicado)
}

// qe-reapertura-reinicia-cierre D5: las filas de pasos/firmas solo miran el ciclo actual — las
// entradas posteriores al último REABIERTO (en ciclo 1, todo el audit trail).
function entradasDelCicloActual(auditTrail: QEAuditTrailEntry[]): QEAuditTrailEntry[] {
  let inicio = -1
  auditTrail.forEach((entry, i) => {
    if (entry.accion === 'REABIERTO') inicio = i
  })
  return inicio === -1 ? auditTrail : auditTrail.slice(inicio + 1)
}

// Firma 1: acción nueva FIRMA_CIERRE_JEFE_CALIDAD o la legacy FIRMA_REGISTRADA del backend anterior
// (qe-cierre-firma-supervisor-area).
const esFirmaJefeCalidad = (entry: QEAuditTrailEntry) =>
  entry.accion === 'FIRMA_CIERRE_JEFE_CALIDAD' ||
  (entry.accion === 'FIRMA_REGISTRADA' && entry.campoModificado === 'cerradoPorId')

const esFirmaSupervisor = (entry: QEAuditTrailEntry) =>
  entry.accion === 'FIRMA_CIERRE_SUPERVISOR' ||
  entry.accion === 'FIRMA_CIERRE_SEGUNDA' ||
  (entry.accion === 'FIRMA_REGISTRADA' && entry.campoModificado === 'cierreFirmaSupervisorId')

// El aviso de rechazo vale mientras no haya una entrada posterior que devuelva el QE a PENDIENTE_CIERRE.
const esRechazoOReingreso = (entry: QEAuditTrailEntry) =>
  entry.accion === 'CIERRE_RECHAZADO' ||
  ((entry.accion === 'ESTADO_CAMBIADO' || entry.accion === 'TRANSICION_AUTOMATICA') &&
    entry.estadoNuevo === 'PENDIENTE_CIERRE')

function RechazoCierreModal({
  onConfirm,
  onClose,
  isPending,
}: {
  onConfirm: (motivo: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t } = useTranslation('qualityEvents')
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RechazarCierreInput>({
    resolver: zodResolver(rechazarCierreSchema),
    defaultValues: { motivo: '' },
  })
  const motivoLength = (watch('motivo') ?? '').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="qe-rechazo-cierre-title"
        onSubmit={(e) => void handleSubmit((values) => onConfirm(values.motivo))(e)}
        className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.cierre.pinModal.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 id="qe-rechazo-cierre-title" className="mb-3 font-medium text-ink dark:text-on-dark">
          {t('detail.cierre.rechazar')}
        </h2>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="qe-motivo-rechazo" className="text-sm font-medium text-body dark:text-on-dark-soft">
            {t('detail.cierre.motivoRechazo')}
          </label>
          <span className={`text-xs ${motivoLength < 20 ? 'text-error' : 'text-muted dark:text-on-dark-soft'}`}>
            {t('detail.cierre.form.resultadoCierreCharCount', { count: motivoLength, max: 500 })}
          </span>
        </div>
        <textarea
          id="qe-motivo-rechazo"
          rows={4}
          maxLength={500}
          className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
          {...register('motivo')}
        />
        {errors.motivo?.message && <p className="mt-1 text-xs text-error">{t(errors.motivo.message)}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('detail.cierre.pinModal.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-error"
          >
            {t('detail.cierre.rechazar')}
          </button>
        </div>
      </form>
    </div>
  )
}

export function QECierreSection({ qe }: QECierreSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const cerrarQE = useCerrarQE()
  const firmarCierre = useFirmarCierre()
  const rechazarCierre = useRechazarCierreQE()
  const { data: area } = useArea(qe.areaId)
  const [pinModalRole, setPinModalRole] = useState<'JEFE_CALIDAD_SYST' | 'SUPERVISOR' | 'ALTA_DIRECCION' | null>(null)
  const [pinResetMidSession, setPinResetMidSession] = useState(false)
  const [rechazoModalOpen, setRechazoModalOpen] = useState(false)
  const [plazoOption, setPlazoOption] = useState<number | 'CUSTOM'>(60)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CierreFormFields, unknown, QualityEventCierreFormInput>({
    resolver: zodResolver(qualityEventCierreFormSchema),
    defaultValues: { resultadoCierre: '', plazoVerificacionDias: 60 },
  })

  const resultadoCierreValue = watch('resultadoCierre') ?? ''
  const resultadoCierreLength = resultadoCierreValue.length
  const resultadoCierreBelowMin = resultadoCierreLength < 100

  const ultimoRechazoOReingreso = ultimaEntrada(qe.auditTrail, esRechazoOReingreso)
  const rechazoVigente =
    qe.estado === 'EN_EJECUCION' && ultimoRechazoOReingreso?.accion === 'CIERRE_RECHAZADO'
      ? ultimoRechazoOReingreso
      : undefined

  if (!VISIBLE_STATES.includes(qe.estado) && !rechazoVigente) return null

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const areaNombre = area?.nombre ?? qe.areaId

  const showClosureForm = qe.estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre && user?.rol === 'JEFE_CALIDAD_SYST'
  const showFirstSignature =
    qe.estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId && user?.rol === 'JEFE_CALIDAD_SYST'

  const resolvedRole = qe.cerradoPorId
    ? resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId)
    : null
  const showPendingSecondSignature =
    qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId
  // La segunda firma (y el rechazo) solo la da un supervisor del área del QE — qe.supervisoresArea
  // lo resuelve el backend (qe-cierre-firma-supervisor-area D1/D9).
  const esSupervisorDelArea = !!user && (qe.supervisoresArea ?? []).some((s) => s.id === user.id)
  const showSecondSignature =
    showPendingSecondSignature && resolvedRole !== null && user?.rol === resolvedRole && esSupervisorDelArea
  const showNoEsDelArea = showPendingSecondSignature && user?.rol === 'SUPERVISOR' && !esSupervisorDelArea

  const showSummary = qe.estado === 'CERRADO' || qe.estado === 'EN_VERIFICACION' || qe.estado === 'VERIFICADO'
  // Siempre en PENDIENTE_CIERRE, para todos los roles (qe-siguiente-paso-responsable D1): sin
  // resultado del cierre nadie más que el JCA veía qué faltaba.
  const showFirmas = qe.estado === 'PENDIENTE_CIERRE' || showSummary

  const auditCiclo = entradasDelCicloActual(qe.auditTrail)
  const paso1Entry = qe.resultadoCierre ? ultimaEntrada(auditCiclo, (e) => e.accion === 'CIERRE_INICIADO') : undefined
  const firmaJefeEntry = qe.cerradoPorId ? ultimaEntrada(auditCiclo, esFirmaJefeCalidad) : undefined
  const firmaSupervisorEntry = qe.cierreFirmaSupervisorId ? ultimaEntrada(auditCiclo, esFirmaSupervisor) : undefined
  const supervisoresNombres = (qe.supervisoresArea ?? []).map((s) => s.nombreCompleto).join(', ')
  const areaSinSupervisor =
    errorCodeOf(cerrarQE.error) === 'AREA_SIN_SUPERVISOR' || errorCodeOf(firmarCierre.error) === 'AREA_SIN_SUPERVISOR'

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  const onSubmitCierre = (values: QualityEventCierreFormInput) => {
    cerrarQE.mutate({ id: qe.id, data: values })
  }

  const onPlazoOptionChange = (value: string) => {
    if (value === 'CUSTOM') {
      setPlazoOption('CUSTOM')
      return
    }
    const parsed = Number(value)
    setPlazoOption(parsed)
    setValue('plazoVerificacionDias', parsed)
  }

  // El cierre de un QE con severidad ALTA/CRITICA y la notificación al reportante
  // original ahora se entregan como notificaciones reales y persistidas (RN-NOTIF-001,
  // creadas por el handler `firmar-cierre`) — este toast confirma únicamente la
  // acción propia de quien firma, sin afirmar que otras personas fueron notificadas
  // (su sesión no tiene forma de confirmar una entrega entre sesiones distintas).
  const onPinConfirm = (rol: 'JEFE_CALIDAD_SYST' | 'SUPERVISOR' | 'ALTA_DIRECCION', pin: string) => {
    setPinResetMidSession(false)
    firmarCierre.mutate(
      { id: qe.id, data: { rol, pin } },
      {
        onSuccess: (updated) => {
          setPinModalRole(null)
          if (updated.estado === 'CERRADO') {
            toast.success(t('detail.cierre.toasts.closed'))
          }
        },
        onError: (error: unknown) => {
          const errorCode = (error as AxiosError<{ errorCode?: string }>)?.response?.data?.errorCode
          if (errorCode === 'PIN_NO_CONFIGURADO') setPinResetMidSession(true)
        },
      },
    )
  }

  const onRechazoConfirm = (motivo: string) => {
    rechazarCierre.mutate({ id: qe.id, motivo }, { onSuccess: () => setRechazoModalOpen(false) })
  }

  const firmaRow = (
    label: string,
    firmado: boolean,
    nombre: string | undefined,
    entry: QEAuditTrailEntry | undefined,
    pendiente: ReactNode,
  ) => (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
        {firmado
          ? t('detail.cierre.firmaHecha', {
              nombre: nombre ?? entry?.realizadoPorNombre ?? '—',
              fecha: entry ? dateFormatter.format(new Date(entry.timestamp)) : '—',
            })
          : pendiente}
      </dd>
    </div>
  )

  return (
    <section
      aria-labelledby="qe-cierre-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      {pinModalRole && (
        <PinModal
          titleKey={
            pinModalRole === 'JEFE_CALIDAD_SYST'
              ? 'detail.cierre.pinModal.titleJefeCalidad'
              : pinModalRole === 'SUPERVISOR'
                ? 'detail.cierre.pinModal.titleSupervisor'
                : 'detail.cierre.pinModal.titleAltaDireccion'
          }
          onConfirm={(pin) => onPinConfirm(pinModalRole, pin)}
          onClose={() => {
            setPinModalRole(null)
            setPinResetMidSession(false)
          }}
          isPending={firmarCierre.isPending}
          tienePinFirma={user?.tienePinFirma}
          pinResetMidSession={pinResetMidSession}
        />
      )}

      {rechazoModalOpen && (
        <RechazoCierreModal
          onConfirm={onRechazoConfirm}
          onClose={() => setRechazoModalOpen(false)}
          isPending={rechazarCierre.isPending}
        />
      )}

      <h2 id="qe-cierre-title" className="mb-4 text-base font-medium text-ink dark:text-on-dark">
        {t('detail.cierre.title')}
      </h2>

      {rechazoVigente && (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber/40 bg-amber/10 px-3.5 py-2.5 text-sm text-body dark:border-amber/30 dark:bg-amber/10 dark:text-on-dark"
        >
          {t('detail.cierre.rechazadoAviso', {
            nombre: rechazoVigente.realizadoPorNombre,
            fecha: dateFormatter.format(new Date(rechazoVigente.timestamp)),
            motivo: rechazoVigente.valorNuevo ?? '',
          })}
        </div>
      )}

      {areaSinSupervisor && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-error/40 bg-error/10 px-3.5 py-2.5 text-sm text-body dark:border-error/30 dark:bg-error/10 dark:text-on-dark"
        >
          <p>{t('errors.AREA_SIN_SUPERVISOR', { area: areaNombre })}</p>
          {user?.rol === 'JEFE_CALIDAD_SYST' && (
            <Link to="/usuarios" className="mt-1 inline-block font-medium text-coral hover:underline dark:text-coral">
              {t('detail.cierre.irAUsuarios')}
            </Link>
          )}
        </div>
      )}

      {showClosureForm && (
        <form onSubmit={(e) => void handleSubmit(onSubmitCierre)(e)} className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="qe-resultadoCierre" className={labelClass}>
                {t('detail.cierre.form.resultadoCierre')}
              </label>
              <span
                className={`text-xs ${resultadoCierreBelowMin ? 'text-error' : 'text-muted dark:text-on-dark-soft'}`}
              >
                {resultadoCierreBelowMin
                  ? t('detail.cierre.form.resultadoCierreCharCountRemaining', {
                      count: 100 - resultadoCierreLength,
                      min: 100,
                    })
                  : t('detail.cierre.form.resultadoCierreCharCount', { count: resultadoCierreLength, max: 500 })}
              </span>
            </div>
            <textarea
              id="qe-resultadoCierre"
              rows={4}
              maxLength={500}
              className={inputClass}
              placeholder={t('detail.cierre.form.resultadoCierrePlaceholder')}
              {...register('resultadoCierre')}
            />
            {errors.resultadoCierre && (
              <p className="mt-1 text-xs text-error">{errors.resultadoCierre.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="qe-plazoVerificacionDias" className={labelClass}>
              {t('detail.cierre.form.plazoVerificacionDias')}
            </label>
            <select
              id="qe-plazoVerificacionDias"
              className={inputClass}
              value={plazoOption}
              onChange={(e) => onPlazoOptionChange(e.target.value)}
            >
              {PLAZO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="CUSTOM">{t('detail.cierre.form.plazoCustom')}</option>
            </select>
            {plazoOption === 'CUSTOM' && (
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-2`}
                {...register('plazoVerificacionDias', { valueAsNumber: true })}
              />
            )}
            {errors.plazoVerificacionDias && (
              <p className="mt-1 text-xs text-error">{errors.plazoVerificacionDias.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={cerrarQE.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('detail.cierre.form.submit')}
          </button>
        </form>
      )}

      {showFirmas && (
        <dl className="mb-4 divide-y divide-hairline dark:divide-hairline/20">
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">{t('detail.cierre.paso1')}</dt>
            <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.resultadoCierre
                ? `✓${paso1Entry ? ` ${dateFormatter.format(new Date(paso1Entry.timestamp))}` : ''}`
                : t('detail.cierre.pendiente')}
            </dd>
          </div>
          {firmaRow(t('detail.cierre.firma1'), !!qe.cerradoPorId, qe.cerradoPorNombre, firmaJefeEntry, t('detail.cierre.pendiente'))}
          {firmaRow(
            t('detail.cierre.firma2', { area: areaNombre }),
            !!qe.cierreFirmaSupervisorId,
            qe.cierreFirmaSupervisorNombre,
            firmaSupervisorEntry,
            qe.cerradoPorId ? (
              <>
                <span>{t('detail.cierre.pendiente')}. </span>
                {supervisoresNombres && <span>{t('detail.cierre.puedenFirmar', { nombres: supervisoresNombres })} </span>}
                {supervisoresNombres && (
                  <span className="text-xs text-muted dark:text-on-dark-soft">{t('detail.cierre.avisoEnviado')}</span>
                )}
              </>
            ) : (
              t('detail.cierre.esperaJCA')
            ),
          )}
        </dl>
      )}

      {showNoEsDelArea && (
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
          {t('detail.cierre.noEsDelArea', { area: areaNombre })}
        </p>
      )}

      {(showFirstSignature || showSecondSignature) && (
        <div className="flex flex-wrap gap-2.5">
          {showFirstSignature && (
            <button
              type="button"
              onClick={() => setPinModalRole('JEFE_CALIDAD_SYST')}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
            >
              {t('detail.cierre.firstSignature.button')}
            </button>
          )}
          {showSecondSignature && resolvedRole && (
            <>
              <button
                type="button"
                onClick={() => setPinModalRole(resolvedRole)}
                className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
              >
                {t('detail.cierre.secondSignature.button')}
              </button>
              <button
                type="button"
                onClick={() => setRechazoModalOpen(true)}
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
              >
                {t('detail.cierre.rechazar')}
              </button>
            </>
          )}
        </div>
      )}

      {showSummary && (
        <dl className="divide-y divide-hairline dark:divide-hairline/20">
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.cierre.summary.resultado')}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.resultadoCierre}
            </dd>
          </div>
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.cierre.summary.plazo')}
            </dt>
            <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.plazoVerificacionDias}
            </dd>
          </div>
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.cierre.summary.fechaCierre')}
            </dt>
            <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.fechaCierre ? dateFormatter.format(new Date(qe.fechaCierre)) : '—'}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
