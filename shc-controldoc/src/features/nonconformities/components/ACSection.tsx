import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, X, CheckCircle, Play, ArrowUpRight, Check } from 'lucide-react'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { useUpdateAccionCorrectiva, useCerrarAccionCorrectiva } from '../hooks/useNonconformities'
import { cerrarACSchema, type CerrarACInput } from '../schemas/cerrarAC.schema'
import { qualityEventFixtures } from '../../../mocks/fixtures/quality-events.fixtures'
import { useSolicitarACEnQE } from '../../quality-events/hooks/useSolicitarACEnQE'
import type { AccionCorrectiva, NCStatus } from '../types/nonconformity.types'

const TERMINAL_NC: NCStatus[] = ['CERRADA', 'ANULADA']

const AC_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-muted-soft/20 text-muted',
  EN_EJECUCION: 'bg-amber/20 text-amber',
  COMPLETADA: 'bg-teal/20 text-teal',
  CERRADA: 'bg-success/20 text-success',
  VENCIDA: 'bg-error/20 text-error',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  BAJA: 'bg-teal/10 text-teal',
  MEDIA: 'bg-amber/10 text-amber',
  ALTA: 'bg-error/10 text-error',
  CRITICA: 'bg-error/20 text-error font-semibold',
}

// ─── CerrarACModal ────────────────────────────────────────────────────────────

interface CerrarACModalProps {
  onConfirm: (data: CerrarACInput) => void
  onClose: () => void
  isPending: boolean
}

function CerrarACModal({ onConfirm, onClose, isPending }: CerrarACModalProps) {
  const { t } = useTranslation('nonconformities')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CerrarACInput>({ resolver: zodResolver(cerrarACSchema) })

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('acSection.cerrarModal.title')}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
          {t('acSection.cerrarModal.body')}
        </p>

        <form onSubmit={(e) => void handleSubmit(onConfirm)(e)} className="space-y-4">
          <div>
            <label
              htmlFor="descripcionEvidencia"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('acSection.fields.evidencia')} <span className="text-error">*</span>
            </label>
            <textarea
              id="descripcionEvidencia"
              rows={3}
              maxLength={2000}
              className={inputClass}
              placeholder={t('acSection.placeholders.evidencia')}
              {...register('descripcionEvidencia')}
            />
            {errors.descripcionEvidencia && (
              <p className="mt-1 text-xs text-error">{errors.descripcionEvidencia.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="evidenciaUrl"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('acSection.fields.evidenciaUrl')}
            </label>
            <input
              id="evidenciaUrl"
              type="url"
              className={inputClass}
              placeholder={t('acSection.placeholders.evidenciaUrl')}
              {...register('evidenciaUrl')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {t('acSection.actions.cerrarModal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── ACSection ───────────────────────────────────────────────────────────────

interface ACSectionProps {
  ncId: string
  ncNumero: string
  accionesCorrectivas: AccionCorrectiva[]
  ncEstado: NCStatus
  canAsignarAC: boolean
  canCerrarAC: boolean
  qeGeneradoId?: string
}

export function ACSection({
  ncId,
  accionesCorrectivas,
  ncEstado,
  canAsignarAC,
  canCerrarAC,
  qeGeneradoId,
}: ACSectionProps) {
  const { t } = useTranslation('nonconformities')

  const [closingAcId, setClosingAcId] = useState<string | null>(null)
  const [solicitadoExitoso, setSolicitadoExitoso] = useState(false)

  const updateAC = useUpdateAccionCorrectiva(ncId)
  const cerrarAC = useCerrarAccionCorrectiva(ncId)
  const solicitarACEnQE = useSolicitarACEnQE()

  const isTerminal = TERMINAL_NC.includes(ncEstado)
  const isQELinked = !!qeGeneradoId

  const onTransition = (acId: string, newEstado: string) => {
    updateAC.mutate({ acId, data: { estado: newEstado as AccionCorrectiva['estado'] } })
  }

  const onCerrarConfirm = (data: CerrarACInput) => {
    if (!closingAcId) return
    cerrarAC.mutate(
      { acId: closingAcId, data },
      { onSuccess: () => setClosingAcId(null) },
    )
  }

  const onSolicitarACEnQE = () => {
    if (!qeGeneradoId) return
    solicitarACEnQE.mutate(qeGeneradoId, {
      onSuccess: () => {
        setSolicitadoExitoso(true)
        toast.success(t('acSection.toasts.solicitudEnviada'))
      },
    })
  }

  const solicitarACButton =
    isQELinked && canAsignarAC ? (
      solicitadoExitoso ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check size={14} />
          {t('acSection.actions.solicitudEnviada')}
        </span>
      ) : (
        <button
          type="button"
          onClick={onSolicitarACEnQE}
          disabled={solicitarACEnQE.isPending}
          className="flex items-center gap-1.5 rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-white hover:bg-coral-dark disabled:opacity-60"
        >
          <Plus size={14} />
          {t('acSection.actions.solicitarQE')}
        </button>
      )
    ) : null

  return (
    <section aria-labelledby="ac-section-title">
      {closingAcId && (
        <CerrarACModal
          onConfirm={onCerrarConfirm}
          onClose={() => setClosingAcId(null)}
          isPending={cerrarAC.isPending}
        />
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3
          id="ac-section-title"
          className="text-base font-medium text-ink dark:text-on-dark"
        >
          {t('acSection.title')}
          {accionesCorrectivas.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted dark:text-on-dark-soft">
              ({accionesCorrectivas.length})
            </span>
          )}
        </h3>

        {isQELinked && (
          <div className="flex items-center gap-3">
            {accionesCorrectivas.length === 0 && solicitarACButton}
            <Link
              to={`/quality-events/${qeGeneradoId}`}
              className="flex items-center gap-1 text-xs font-medium text-coral hover:underline"
            >
              <ArrowUpRight size={14} />
              {t('acSection.actions.verQE')}
            </Link>
          </div>
        )}
      </div>

      {!isQELinked && (
        <p className="mb-3 text-sm text-muted dark:text-on-dark-soft">
          {t('acSection.qeRequerido')}
        </p>
      )}

      {/* AC List */}
      {accionesCorrectivas.length === 0 ? (
        isQELinked && (
          <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('acSection.empty')}</p>
        )
      ) : (
        <ul className="divide-y divide-hairline dark:divide-hairline/20">
          {accionesCorrectivas.map((ac) => (
            <li key={ac.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {ac.titulo && (
                    <p className="text-sm font-medium text-body dark:text-on-dark">{ac.titulo}</p>
                  )}
                  <p className="text-sm text-body dark:text-on-dark-soft">{ac.descripcion}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-pill px-2 py-0.5 text-xs font-medium ${AC_STATUS_COLORS[ac.estado] ?? 'bg-muted-soft/20 text-muted'}`}
                    >
                      {t(`acSection.acStatus.${ac.estado}`)}
                    </span>
                    {ac.prioridad && (
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs ${PRIORIDAD_COLORS[ac.prioridad] ?? ''}`}
                      >
                        {t(`acSection.prioridad.${ac.prioridad}`)}
                      </span>
                    )}
                    <span className="text-xs text-muted dark:text-on-dark-soft">
                      {ac.responsableNombre}
                    </span>
                    <DeadlineBadge fechaCierre={ac.plazoFecha} estado={ac.estado} />
                  </div>
                  {ac.descripcionEvidencia && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-success">
                      <CheckCircle size={12} />
                      {ac.descripcionEvidencia}
                    </p>
                  )}
                  {ac.qeId && (
                    <Link
                      to={`/quality-events/${ac.qeId}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-coral hover:underline"
                    >
                      <ArrowUpRight size={12} />
                      {t('acSection.verQE', {
                        numero: qualityEventFixtures.find((qe) => qe.id === ac.qeId)?.numero ?? ac.qeId,
                      })}
                    </Link>
                  )}
                </div>

                {/* Transition buttons */}
                {!isTerminal && !isQELinked && (
                  <div className="shrink-0">
                    {ac.estado === 'PENDIENTE' && (
                      <button
                        type="button"
                        onClick={() => onTransition(ac.id, 'EN_EJECUCION')}
                        disabled={updateAC.isPending}
                        className="flex items-center gap-1 rounded-md border border-teal/40 px-2.5 py-1 text-xs font-medium text-teal hover:bg-teal/10 disabled:opacity-60"
                      >
                        <Play size={11} />
                        {t('acSection.actions.iniciar')}
                      </button>
                    )}
                    {ac.estado === 'EN_EJECUCION' && canCerrarAC && (
                      <button
                        type="button"
                        onClick={() => setClosingAcId(ac.id)}
                        className="flex items-center gap-1 rounded-md border border-success/40 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10"
                      >
                        <CheckCircle size={11} />
                        {t('acSection.actions.cerrar')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {accionesCorrectivas.length > 0 && solicitarACButton && (
        <div className="mt-3 flex justify-end">{solicitarACButton}</div>
      )}
    </section>
  )
}
