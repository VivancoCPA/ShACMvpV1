import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { devolverQEAccionSchema, type DevolverQEACInput, type VerificarQEACInput } from '../schemas/verificarQEAccion.schema'
import { EvidenciaACItem } from './EvidenciaACItem'
import type { AccionCorrectivaQE } from '../types/qualityEvent.types'

// "Verificar AC" (solo JCA): revisa la descripción y los archivos que subió el responsable, y la
// cierra o la devuelve con motivo (ac-ejecucion-verificacion-evidencias).
export function VerificarQEACModal({
  qeId,
  ac,
  onVerificar,
  onClose,
  isPending,
}: {
  qeId: string
  ac: AccionCorrectivaQE
  onVerificar: (data: VerificarQEACInput) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t, i18n } = useTranslation('qualityEvents')
  const [devolviendo, setDevolviendo] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DevolverQEACInput>({ resolver: zodResolver(devolverQEAccionSchema) })

  const evidencias = ac.evidencias ?? []
  const fecha = ac.ejecutadaEn
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ac.ejecutadaEn))
    : null

  const onDevolver = (data: DevolverQEACInput) => onVerificar({ aprobada: false, comentario: data.comentario })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qeac-verificar-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 id="qeac-verificar-title" className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.verificar.title')}
        </h2>
        <p className="mb-4 text-sm text-body dark:text-on-dark-soft">{ac.titulo ?? ac.descripcion}</p>

        {(ac.ejecutadaPorNombre || fecha) && (
          <p className="mb-2 text-xs text-muted dark:text-on-dark-soft">
            {t('detail.acSection.verificar.ejecutadaPor', {
              nombre: ac.ejecutadaPorNombre ?? ac.responsableNombre,
              fecha: fecha ?? '—',
            })}
          </p>
        )}

        <div className="mb-4 rounded-md bg-surface-soft p-3 text-sm text-body dark:bg-surface-dark-soft dark:text-on-dark-soft">
          {ac.descripcionEvidencia}
        </div>

        <p className="mb-1 text-sm font-medium text-body dark:text-on-dark-soft">
          {t('detail.acSection.evidencias.titulo')} ({evidencias.length})
        </p>
        {evidencias.length === 0 ? (
          <p className="mb-4 text-xs text-muted dark:text-on-dark-soft">{t('detail.acSection.verificar.sinEvidencias')}</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {evidencias.map((ev) => (
              <EvidenciaACItem key={ev.id} qeId={qeId} acId={ac.id} evidencia={ev} />
            ))}
          </ul>
        )}

        {devolviendo ? (
          <form onSubmit={(e) => void handleSubmit(onDevolver)(e)} className="space-y-3">
            <div>
              <label htmlFor="qeac-motivo-devolucion" className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft">
                {t('detail.acSection.verificar.motivo')} <span className="text-error">*</span>
              </label>
              <textarea
                id="qeac-motivo-devolucion"
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                {...register('comentario')}
              />
              {errors.comentario && <p className="mt-1 text-xs text-error">{errors.comentario.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDevolviendo(false)}
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
              >
                {t('detail.acSection.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-error"
              >
                {t('detail.acSection.verificar.confirmarDevolucion')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDevolviendo(true)}
              disabled={isPending}
              className="rounded-md border border-error/40 bg-canvas px-4 py-2 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-60 dark:border-error/40 dark:bg-surface-dark dark:text-error"
            >
              {t('detail.acSection.verificar.devolver')}
            </button>
            <button
              type="button"
              onClick={() => onVerificar({ aprobada: true })}
              disabled={isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
            >
              {t('detail.acSection.verificar.aprobar')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
