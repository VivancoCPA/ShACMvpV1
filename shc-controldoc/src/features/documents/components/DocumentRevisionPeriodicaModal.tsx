import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { CheckCircle, RefreshCw, Loader2 } from 'lucide-react'
import { useConfirmarRevisionPeriodica } from '../hooks/useDocumentActions'
import { formatCalendarDateMedium, todayCalendarDateIso, addCalendarDays, addCalendarMonths } from '../../../utils/date.utils'
import { DOC_PERIODICIDAD_POR_TIPO } from '../../../config/businessRules.config'
import {
  confirmarRevisionPeriodicaSchema,
  REVISION_PERIODICA_MIN_GAP_DAYS,
  type ConfirmarRevisionPeriodicaInput,
} from '../schemas/confirmarRevisionPeriodica.schema'
import type { Documento } from '../../../types/documents.types'

interface DocumentRevisionPeriodicaModalProps {
  documento: Documento
  onClose: () => void
  onCrearNuevaVersion: () => void
}

export function DocumentRevisionPeriodicaModal({
  documento,
  onClose,
  onCrearNuevaVersion,
}: DocumentRevisionPeriodicaModalProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const [selected, setSelected] = useState<'A' | 'B' | null>(null)

  const confirmar = useConfirmarRevisionPeriodica(documento.id)

  // revision-periodica-fecha-editable (D1): sugerencia según el tipo de documento — misma tabla
  // que el backend usa cuando no se envía fecha (DOC_PERIODICIDAD_POR_TIPO/
  // DocumentoPeriodicidadConstants). REG/INF no tienen sugerencia (campo queda vacío).
  const hoy = todayCalendarDateIso()
  const minFecha = useMemo(() => addCalendarDays(hoy, REVISION_PERIODICA_MIN_GAP_DAYS), [hoy])
  const fechaSugerida = useMemo(() => {
    const meses = DOC_PERIODICIDAD_POR_TIPO[documento.tipo]
    return meses ? addCalendarMonths(hoy, meses) : ''
  }, [hoy, documento.tipo])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConfirmarRevisionPeriodicaInput>({
    resolver: zodResolver(confirmarRevisionPeriodicaSchema),
    defaultValues: { fechaRevisionProxima: fechaSugerida },
  })

  // fechaRevisionProxima es una fecha de calendario (sin hora significativa) — se lee en UTC
  // para no desfasarla un día en zonas horarias negativas (fix-fechas-utc).
  function formatDate(iso: string | undefined): string {
    if (!iso) return '—'
    return formatCalendarDateMedium(iso, locale)
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      await confirmar.mutateAsync({ fechaRevisionProxima: data.fechaRevisionProxima || undefined })
      onClose()
    } catch (error) {
      // El toast de error ya lo muestra useConfirmarRevisionPeriodica (onError) — aquí solo se
      // intenta ubicar el mensaje de campo del backend (FieldValidationException) en el input,
      // sin perder el valor que el usuario ingresó.
      const serverErrors = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      const campoFecha = serverErrors?.find((e) => e.startsWith('fechaRevisionProxima:'))
      if (campoFecha) {
        setError('fechaRevisionProxima', { message: campoFecha.replace(/^fechaRevisionProxima:\s*/, '') })
      }
    }
  })

  function handleOpcionB() {
    onClose()
    onCrearNuevaVersion()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-periodica-title"
        className="w-full max-w-md rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <h2
          id="revision-periodica-title"
          className="mb-1 text-base font-semibold text-ink dark:text-on-dark"
        >
          {t('revisionPeriodica.modal.title')}
        </h2>
        <p className="mb-1 text-xs font-mono text-muted dark:text-on-dark-soft">
          {documento.codigo}
        </p>
        <p className="mb-5 text-sm text-body dark:text-on-dark line-clamp-2">
          {documento.titulo}
        </p>

        {documento.fechaRevisionProxima && (
          <p className="mb-4 rounded-md bg-surface-soft px-3 py-2 text-xs text-muted dark:bg-surface-dark dark:text-on-dark-soft">
            {t('revisionPeriodica.modal.proximaRevision', {
              fecha: formatDate(documento.fechaRevisionProxima),
            })}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected('A')}
            className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
              selected === 'A'
                ? 'border-teal bg-teal/5 dark:border-teal dark:bg-teal/10'
                : 'border-hairline hover:border-teal/50 dark:border-hairline/20 dark:hover:border-teal/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle
                size={18}
                aria-hidden="true"
                className={`mt-0.5 flex-shrink-0 ${selected === 'A' ? 'text-teal' : 'text-muted dark:text-on-dark-soft'}`}
              />
              <div>
                <p className={`text-sm font-medium ${selected === 'A' ? 'text-teal' : 'text-body-strong dark:text-on-dark'}`}>
                  {t('revisionPeriodica.modal.opcionA')}
                </p>
                <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                  {t('revisionPeriodica.modal.opcionADesc')}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected('B')}
            className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
              selected === 'B'
                ? 'border-amber bg-amber/5 dark:border-amber dark:bg-amber/10'
                : 'border-hairline hover:border-amber/50 dark:border-hairline/20 dark:hover:border-amber/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <RefreshCw
                size={18}
                aria-hidden="true"
                className={`mt-0.5 flex-shrink-0 ${selected === 'B' ? 'text-amber' : 'text-muted dark:text-on-dark-soft'}`}
              />
              <div>
                <p className={`text-sm font-medium ${selected === 'B' ? 'text-amber' : 'text-body-strong dark:text-on-dark'}`}>
                  {t('revisionPeriodica.modal.opcionB')}
                </p>
                <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                  {t('revisionPeriodica.modal.opcionBDesc')}
                </p>
              </div>
            </div>
          </button>
        </div>

        {selected === 'A' && (
          <div className="mt-4">
            <label
              htmlFor="revision-periodica-fecha"
              className="mb-1 block text-sm font-medium text-body-strong dark:text-on-dark"
            >
              {t('revisionPeriodica.modal.fechaLabel')}
            </label>
            <input
              id="revision-periodica-fecha"
              type="date"
              min={minFecha}
              {...register('fechaRevisionProxima')}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
            />
            <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
              {t('revisionPeriodica.modal.fechaAyuda', { minDias: REVISION_PERIODICA_MIN_GAP_DAYS })}
            </p>
            {errors.fechaRevisionProxima && (
              <p className="mt-1 text-xs text-error">{errors.fechaRevisionProxima.message}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={confirmar.isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
          >
            {t('detail.cancel')}
          </button>

          {selected === 'A' && (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={confirmar.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {confirmar.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {t('revisionPeriodica.modal.opcionAConfirm')}
            </button>
          )}

          {selected === 'B' && (
            <button
              type="button"
              onClick={handleOpcionB}
              className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t('revisionPeriodica.modal.opcionBAction')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
