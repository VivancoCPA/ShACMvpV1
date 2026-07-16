import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { X, Sparkles } from 'lucide-react'
import { resolveUserDisplayName } from '../../../mocks/fixtures/userIdentity.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { useUpdateQualityEvent } from '../hooks/useUpdateQualityEvent'
import type {
  QualityEvent,
  AnalisisCausaRaizMetodo,
  CincoPorques,
  Ishikawa,
  IshikawaCategoria,
} from '../types/qualityEvent.types'

const ISHIKAWA_CATEGORIAS: IshikawaCategoria[] = [
  'METODO',
  'MAQUINA',
  'MATERIAL',
  'MANO_DE_OBRA',
  'MEDICION',
  'MEDIO_AMBIENTE',
]

const causaRaizSchema = z.string().min(100).max(500)

interface QEInvestigationSectionProps {
  qe: QualityEvent
}

interface FormValues {
  metodoAnalisis: AnalisisCausaRaizMetodo
  cincoPorques: CincoPorques[]
  ishikawa: Ishikawa[]
  causaRaizDefinitiva: string
}

function buildDefaultCincoPorques(existing?: CincoPorques[]): CincoPorques[] {
  return [1, 2, 3, 4, 5].map((n) => existing?.[n - 1] ?? { pregunta: `¿Por qué ${n}?`, respuesta: '' })
}

function buildDefaultIshikawa(existing?: Ishikawa[]): Ishikawa[] {
  return ISHIKAWA_CATEGORIAS.map(
    (categoria) => existing?.find((i) => i.categoria === categoria) ?? { categoria, causa: '' },
  )
}

function PinModal({
  onConfirm,
  onClose,
  isPending,
}: {
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
          aria-label={t('detail.investigation.pinModal.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.investigation.pinModal.title')}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
          {t('detail.investigation.pinModal.body')}
        </p>
        <label htmlFor="qe-pin-input" className="sr-only">
          {t('detail.investigation.pinModal.placeholder')}
        </label>
        <input
          id="qe-pin-input"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={t('detail.investigation.pinModal.placeholder')}
          className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
        />
        {error && <p className="mt-1 text-xs text-error">{t('detail.investigation.pinModal.error')}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('detail.investigation.pinModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('detail.investigation.pinModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function QEInvestigationSection({ qe }: QEInvestigationSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const updateQE = useUpdateQualityEvent()
  const [pinModalOpen, setPinModalOpen] = useState(false)

  const isEditable =
    !qe.deletedAt &&
    user?.rol === 'JEFE_CALIDAD_SYST' &&
    (qe.estado === 'EN_INVESTIGACION' || qe.estado === 'ANALISIS_COMPLETADO')

  const { register, watch, setValue, getValues, formState: { errors }, clearErrors, setError } =
    useForm<FormValues>({
      defaultValues: {
        metodoAnalisis: qe.metodoAnalisis ?? '5_PORQUES',
        cincoPorques: buildDefaultCincoPorques(qe.cincoPorques),
        ishikawa: buildDefaultIshikawa(qe.ishikawa),
        causaRaizDefinitiva: qe.causaRaizDefinitiva ?? '',
      },
    })

  const metodo = watch('metodoAnalisis')
  const causaRaizValue = watch('causaRaizDefinitiva') ?? ''

  const handleToolSwitch = (target: AnalisisCausaRaizMetodo) => {
    if (!isEditable || target === metodo) return
    toast(t('detail.investigation.switchToastMessage'), {
      action: {
        label: t('detail.investigation.confirmarCambio'),
        onClick: () => {
          setValue('metodoAnalisis', target)
          if (target === 'ISHIKAWA') {
            setValue('cincoPorques', buildDefaultCincoPorques())
          } else {
            setValue('ishikawa', buildDefaultIshikawa())
          }
        },
      },
    })
  }

  const onGuardar = () => {
    const values = getValues()
    updateQE.mutate({
      id: qe.id,
      data: {
        metodoAnalisis: values.metodoAnalisis,
        ...(values.metodoAnalisis === '5_PORQUES'
          ? { cincoPorques: values.cincoPorques }
          : { ishikawa: values.ishikawa }),
        causaRaizDefinitiva: values.causaRaizDefinitiva,
      },
    })
  }

  const onAprobarClick = () => {
    const result = causaRaizSchema.safeParse(getValues('causaRaizDefinitiva'))
    if (!result.success) {
      setError('causaRaizDefinitiva', {
        type: 'manual',
        message: t('detail.investigation.errors.causaRaizLength'),
      })
      return
    }
    clearErrors('causaRaizDefinitiva')
    setPinModalOpen(true)
  }

  const onPinConfirm = () => {
    updateQE.mutate(
      {
        id: qe.id,
        data: {
          causaRaizDefinitiva: getValues('causaRaizDefinitiva'),
          causaRaizFirmadaEn: new Date().toISOString(),
          causaRaizAprobadaPorId: user?.id,
        },
      },
      { onSuccess: () => setPinModalOpen(false) },
    )
  }

  const aprobadorNombre = qe.causaRaizAprobadaPorId
    ? resolveUserDisplayName(qe.causaRaizAprobadaPorId)
    : undefined

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  return (
    <section
      aria-labelledby="qe-investigation-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      {pinModalOpen && (
        <PinModal
          onConfirm={onPinConfirm}
          onClose={() => setPinModalOpen(false)}
          isPending={updateQE.isPending}
        />
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 id="qe-investigation-title" className="text-base font-medium text-ink dark:text-on-dark">
          {t('detail.investigation.title')}
        </h2>
        <button
          type="button"
          disabled
          title={t('detail.investigation.asistirIATooltip')}
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
        >
          <Sparkles size={13} aria-hidden="true" />
          {t('detail.investigation.asistirIA')}
        </button>
      </div>

      {/* Tool toggle */}
      <div className="mb-4">
        <span className={labelClass}>{t('detail.investigation.metodoAnalisis')}</span>
        {isEditable ? (
          <div className="flex gap-4">
            {(['5_PORQUES', 'ISHIKAWA'] as const).map((tool) => (
              <label key={tool} className="flex items-center gap-1.5 text-sm text-body dark:text-on-dark-soft">
                <input
                  type="radio"
                  name="metodoAnalisis"
                  checked={metodo === tool}
                  onChange={() => handleToolSwitch(tool)}
                  className="accent-coral"
                />
                {tool === '5_PORQUES'
                  ? t('detail.investigation.tool5Porques')
                  : t('detail.investigation.toolIshikawa')}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-body dark:text-on-dark">
            {metodo === '5_PORQUES'
              ? t('detail.investigation.tool5Porques')
              : t('detail.investigation.toolIshikawa')}
          </p>
        )}
      </div>

      {/* 5 Porqués table */}
      {metodo === '5_PORQUES' && (
        <div className="mb-4 space-y-3">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx}>
              <label htmlFor={`porque-${idx}`} className={labelClass}>
                {t('detail.investigation.porque', { n: idx + 1 })}
              </label>
              {isEditable ? (
                <textarea
                  id={`porque-${idx}`}
                  rows={2}
                  className={inputClass}
                  placeholder={t('detail.investigation.respuestaPlaceholder')}
                  {...register(`cincoPorques.${idx}.respuesta` as const)}
                />
              ) : (
                <p className="text-sm text-body dark:text-on-dark-soft">
                  {qe.cincoPorques?.[idx]?.respuesta || '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ishikawa categories */}
      {metodo === 'ISHIKAWA' && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ISHIKAWA_CATEGORIAS.map((categoria, idx) => (
            <div key={categoria}>
              <label htmlFor={`ishikawa-${categoria}`} className={labelClass}>
                {t(`detail.investigation.ishikawaCategoria.${categoria}`)}
              </label>
              {isEditable ? (
                <textarea
                  id={`ishikawa-${categoria}`}
                  rows={2}
                  className={inputClass}
                  placeholder={t('detail.investigation.respuestaPlaceholder')}
                  {...register(`ishikawa.${idx}.causa` as const)}
                />
              ) : (
                <p className="text-sm text-body dark:text-on-dark-soft">
                  {qe.ishikawa?.find((i) => i.categoria === categoria)?.causa || '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Causa raíz definitiva */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="causaRaizDefinitiva" className="block text-sm font-medium text-body dark:text-on-dark-soft">
            {t('detail.investigation.causaRaizDefinitiva')}
          </label>
          {isEditable && !qe.causaRaizFirmadaEn && (
            <span className="text-xs text-muted dark:text-on-dark-soft">{causaRaizValue.length}/500</span>
          )}
        </div>

        {qe.causaRaizFirmadaEn ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
              {qe.causaRaizDefinitiva}
            </p>
            <p className="mt-2 text-xs text-success">
              {t('detail.investigation.aprobadoPor', {
                nombre: aprobadorNombre,
                fecha: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(qe.causaRaizFirmadaEn),
                ),
              })}
            </p>
          </>
        ) : isEditable ? (
          <>
            <textarea
              id="causaRaizDefinitiva"
              rows={4}
              maxLength={500}
              className={inputClass}
              placeholder={t('detail.investigation.causaRaizPlaceholder')}
              {...register('causaRaizDefinitiva')}
            />
            {errors.causaRaizDefinitiva && (
              <p className="mt-1 text-xs text-error">{errors.causaRaizDefinitiva.message}</p>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
            {qe.causaRaizDefinitiva || '—'}
          </p>
        )}
      </div>

      {isEditable && !qe.causaRaizFirmadaEn && (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onGuardar}
            disabled={updateQE.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('detail.investigation.guardar')}
          </button>
          {causaRaizValue.length > 0 && (
            <button
              type="button"
              onClick={onAprobarClick}
              className="rounded-md border border-success/40 px-4 py-2 text-sm font-medium text-success hover:bg-success/10"
            >
              {t('detail.investigation.aprobarCausaRaiz')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
