import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import type { z } from 'zod'
import { useAuthStore } from '../../../stores/authStore'
import { useCerrarQE } from '../hooks/useCerrarQE'
import { useFirmarCierre } from '../hooks/useFirmarCierre'
import { qualityEventCierreFormSchema, type QualityEventCierreFormInput } from '../schemas/qualityEventCierre.schema'
import { resolveRolSegundaFirma } from '../utils/qualityEventPermissions'
import type { QualityEvent, QEStatus } from '../types/qualityEvent.types'

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
}: {
  titleKey: string
  onConfirm: (pin: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t } = useTranslation('qualityEvents')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = () => {
    if (pin !== '1234') {
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
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('detail.cierre.pinModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('detail.cierre.pinModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function QECierreSection({ qe }: QECierreSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const cerrarQE = useCerrarQE()
  const firmarCierre = useFirmarCierre()
  const [pinModalRole, setPinModalRole] = useState<'JEFE_CALIDAD_SYST' | 'SUPERVISOR' | 'ALTA_DIRECCION' | null>(null)
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

  if (!VISIBLE_STATES.includes(qe.estado)) return null

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  const showClosureForm = qe.estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre && user?.rol === 'JEFE_CALIDAD_SYST'
  const showFirstSignature =
    qe.estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId && user?.rol === 'JEFE_CALIDAD_SYST'

  const resolvedRole = qe.cerradoPorId
    ? resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada)
    : null
  const showPendingSecondSignature =
    qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId
  const showSecondSignature = showPendingSecondSignature && resolvedRole !== null && user?.rol === resolvedRole
  const firstSignatureEntry = qe.auditTrail.find((entry) => entry.accion === 'FIRMA_CIERRE_JEFE_CALIDAD')

  const showSummary = qe.estado === 'CERRADO' || qe.estado === 'EN_VERIFICACION' || qe.estado === 'VERIFICADO'

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

  const showCierreToasts = (updated: QualityEvent) => {
    toast.success(t('detail.cierre.toasts.closed'))
    if (updated.severidad === 'ALTA' || updated.severidad === 'CRITICA') {
      toast.info(t('detail.cierre.toasts.gerenciaNotificada'))
    }
    toast.info(t('detail.cierre.toasts.reportanteNotificado'))
  }

  const onPinConfirm = (rol: 'JEFE_CALIDAD_SYST' | 'SUPERVISOR' | 'ALTA_DIRECCION', pin: string) => {
    firmarCierre.mutate(
      { id: qe.id, data: { rol, pin } },
      {
        onSuccess: (updated) => {
          setPinModalRole(null)
          if (updated.estado === 'CERRADO') {
            showCierreToasts(updated)
          }
        },
      },
    )
  }

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
          onClose={() => setPinModalRole(null)}
          isPending={firmarCierre.isPending}
        />
      )}

      <h2 id="qe-cierre-title" className="mb-4 text-base font-medium text-ink dark:text-on-dark">
        {t('detail.cierre.title')}
      </h2>

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

      {showPendingSecondSignature && (
        <div className="mb-4 rounded-md border border-hairline bg-canvas p-3.5 text-sm dark:border-hairline/20 dark:bg-surface-dark">
          <p className="text-body dark:text-on-dark">
            {resolvedRole === 'ALTA_DIRECCION'
              ? t('detail.cierre.pendingSecondSignature.waitingForAltaDireccion')
              : t('detail.cierre.pendingSecondSignature.waitingForSupervisor')}
          </p>
          {firstSignatureEntry && (
            <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
              {t('detail.cierre.pendingSecondSignature.signedBy', {
                nombre: firstSignatureEntry.realizadoPorNombre,
                fecha: dateFormatter.format(new Date(firstSignatureEntry.timestamp)),
              })}
            </p>
          )}
        </div>
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
            <button
              type="button"
              onClick={() => setPinModalRole(resolvedRole)}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
            >
              {resolvedRole === 'SUPERVISOR'
                ? t('detail.cierre.secondSignature.buttonSupervisor')
                : t('detail.cierre.secondSignature.buttonAltaDireccion')}
            </button>
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
