import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { useForzarVencimientoVerificacion } from '../hooks/useForzarVencimientoVerificacion'
import { useVerificacionEficacia } from '../hooks/useVerificacionEficacia'
import { getQualityEventPermissions } from '../utils/qualityEventPermissions'
import { verificacionEficaciaSchema, type VerificacionEficaciaInput } from '../schemas/verificacionEficacia.schema'
import type { QualityEvent, QEStatus } from '../types/qualityEvent.types'

const VISIBLE_STATES: QEStatus[] = ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO']

interface QEVerificacionSectionProps {
  qe: QualityEvent
}

export function QEVerificacionSection({ qe }: QEVerificacionSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const forzarVencimiento = useForzarVencimientoVerificacion()
  const verificacionEficacia = useVerificacionEficacia()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VerificacionEficaciaInput>({
    resolver: zodResolver(verificacionEficaciaSchema),
    defaultValues: { resultado: 'EFECTIVO', evidencia: '' },
  })

  if (!VISIBLE_STATES.includes(qe.estado)) return null

  const permissions = user ? getQualityEventPermissions(qe.estado, user.rol, false) : null

  const showForzarVencimiento =
    import.meta.env.DEV && (qe.estado === 'CERRADO' || qe.estado === 'EN_VERIFICACION')
  const showForm = qe.estado === 'EN_VERIFICACION' && !!permissions?.puedeVerificar
  const showSummary = qe.estado === 'VERIFICADO'

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  const onForzarVencimiento = () => {
    forzarVencimiento.mutate(
      { id: qe.id },
      {
        onSuccess: (updated) => {
          if (updated.estado === 'EN_VERIFICACION') {
            toast.success(t('detail.verificacion.toasts.forzadoAVerificacion'))
          } else {
            showReaperturaToasts()
          }
        },
      },
    )
  }

  const showReaperturaToasts = () => {
    toast.info(t('detail.verificacion.toasts.reaperturaEscalada'))
  }

  const onSubmitVerificacion = (values: VerificacionEficaciaInput) => {
    verificacionEficacia.mutate(
      { id: qe.id, data: values },
      {
        onSuccess: (updated) => {
          reset()
          if (updated.estado === 'VERIFICADO') {
            toast.success(t('detail.verificacion.toasts.verificado'))
            if (updated.severidad === 'ALTA' || updated.severidad === 'CRITICA') {
              toast.info(t('detail.verificacion.toasts.gerenciaNotificada'))
            }
            toast.info(t('detail.verificacion.toasts.reportanteNotificado'))
          } else {
            showReaperturaToasts()
          }
        },
      },
    )
  }

  return (
    <section
      aria-labelledby="qe-verificacion-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      <h2 id="qe-verificacion-title" className="mb-4 text-base font-medium text-ink dark:text-on-dark">
        {t('detail.verificacion.title')}
      </h2>

      {showForm && (
        <form onSubmit={(e) => void handleSubmit(onSubmitVerificacion)(e)} className="mb-4 space-y-4">
          <div>
            <span className={labelClass}>{t('detail.verificacion.form.resultado')}</span>
            <div className="flex gap-4">
              {(['EFECTIVO', 'NO_EFECTIVO'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm text-body dark:text-on-dark-soft">
                  <input type="radio" value={opt} className="accent-coral" {...register('resultado')} />
                  {t(`detail.verificacion.form.resultadoOptions.${opt}`)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="qe-verificacion-evidencia" className={labelClass}>
              {t('detail.verificacion.form.evidencia')}
            </label>
            <textarea
              id="qe-verificacion-evidencia"
              rows={4}
              className={inputClass}
              placeholder={t('detail.verificacion.form.evidenciaPlaceholder')}
              {...register('evidencia')}
            />
            {errors.evidencia && <p className="mt-1 text-xs text-error">{errors.evidencia.message}</p>}
          </div>

          <button
            type="submit"
            disabled={verificacionEficacia.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('detail.verificacion.form.submit')}
          </button>
        </form>
      )}

      {showSummary && (
        <dl className="mb-4 divide-y divide-hairline dark:divide-hairline/20">
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.verificacion.summary.resultado')}
            </dt>
            <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.resultadoVerificacion
                ? t(`detail.verificacion.form.resultadoOptions.${qe.resultadoVerificacion}`)
                : '—'}
            </dd>
          </div>
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.verificacion.summary.evidencia')}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.evidenciaVerificacion ?? '—'}
            </dd>
          </div>
          <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">
              {t('detail.verificacion.summary.fechaVerificacionRealizada')}
            </dt>
            <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
              {qe.fechaVerificacionRealizada ? dateFormatter.format(new Date(qe.fechaVerificacionRealizada)) : '—'}
            </dd>
          </div>
        </dl>
      )}

      {showForzarVencimiento && (
        <button
          type="button"
          onClick={onForzarVencimiento}
          disabled={forzarVencimiento.isPending}
          className="rounded-md border border-hairline bg-canvas px-4 py-2 text-xs font-medium text-muted hover:bg-surface-soft disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:bg-surface-dark-soft"
        >
          {t('detail.verificacion.forzarVencimiento')}
        </button>
      )}
    </section>
  )
}
