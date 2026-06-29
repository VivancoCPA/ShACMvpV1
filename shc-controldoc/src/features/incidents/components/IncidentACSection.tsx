import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Plus, X, CheckCircle, Play } from 'lucide-react'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { useUsers } from '../../nonconformities/hooks/useUsers'
import {
  useCreateACIncidente,
  useUpdateACIncidente,
  useCerrarACIncidente,
} from '../hooks/useIncidents'
import { createACIncidenteSchema, type CreateACIncidenteInput } from '../schemas/createAC.schema'
import { cerrarACIncidenteSchema, type CerrarACIncidenteInput } from '../schemas/cerrarAC.schema'
import type { AccionCorrectivaIncidente, IncidentStatus } from '../types/incident.types'

const TERMINAL_INCIDENT: IncidentStatus[] = ['CERRADO', 'ANULADO']

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

// ─── CerrarACModal ────────────────────────────────────────────────────────────

interface CerrarACModalProps {
  onConfirm: (data: CerrarACIncidenteInput) => void
  onClose: () => void
  isPending: boolean
}

function CerrarACModal({ onConfirm, onClose, isPending }: CerrarACModalProps) {
  const { t } = useTranslation('incidents')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CerrarACIncidenteInput>({ resolver: zodResolver(cerrarACIncidenteSchema) })

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

// ─── AgregarACModal ───────────────────────────────────────────────────────────

interface AgregarACModalProps {
  incidenteId: string
  incidenteLabel: string
  onConfirm: (data: CreateACIncidenteInput) => Promise<void>
  onClose: () => void
  isPending: boolean
}

function AgregarACModal({ incidenteLabel, onConfirm, onClose, isPending }: AgregarACModalProps) {
  const { t } = useTranslation('incidents')
  const { data: users = [] } = useUsers()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateACIncidenteInput>({ resolver: zodResolver(createACIncidenteSchema) })

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas shadow-xl dark:bg-surface-dark-elevated">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-hairline/20">
          <h2 className="font-medium text-ink dark:text-on-dark">
            {t('acSection.agregarModal.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('acSection.actions.cancel')}
            className="text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(onConfirm)(e)}>
          <div className="space-y-4 px-6 py-5">
            {/* Incidente pre-cargado (readonly) */}
            <div>
              <label className={labelClass}>{t('acSection.fields.incidente')}</label>
              <input
                type="text"
                value={incidenteLabel}
                readOnly
                className="w-full rounded-md border border-hairline bg-surface-soft px-3.5 py-2.5 text-sm text-muted dark:border-hairline/20 dark:bg-surface-dark-soft dark:text-on-dark-soft"
              />
            </div>

            {/* Título */}
            <div>
              <label htmlFor="ac-titulo" className={labelClass}>
                {t('acSection.fields.titulo')} <span className="text-error">*</span>
              </label>
              <input
                id="ac-titulo"
                type="text"
                maxLength={200}
                className={inputClass}
                placeholder={t('acSection.placeholders.titulo')}
                {...register('titulo')}
              />
              {errors.titulo && (
                <p className="mt-1 text-xs text-error">{errors.titulo.message}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="ac-descripcion" className={labelClass}>
                {t('acSection.fields.descripcion')} <span className="text-error">*</span>
              </label>
              <textarea
                id="ac-descripcion"
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                placeholder={t('acSection.placeholders.descripcion')}
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="mt-1 text-xs text-error">{errors.descripcion.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Responsable */}
              <div>
                <label htmlFor="ac-responsable" className={labelClass}>
                  {t('acSection.fields.responsable')} <span className="text-error">*</span>
                </label>
                <select id="ac-responsable" className={inputClass} {...register('responsableId')}>
                  <option value="">{t('acSection.placeholders.responsable')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.apellido}
                    </option>
                  ))}
                </select>
                {errors.responsableId && (
                  <p className="mt-1 text-xs text-error">{errors.responsableId.message}</p>
                )}
              </div>

              {/* Prioridad */}
              <div>
                <label htmlFor="ac-prioridad" className={labelClass}>
                  {t('acSection.fields.prioridad')} <span className="text-error">*</span>
                </label>
                <select id="ac-prioridad" className={inputClass} {...register('prioridad')}>
                  <option value="">{t('acSection.placeholders.prioridad')}</option>
                  {(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`acSection.prioridad.${p}`)}
                    </option>
                  ))}
                </select>
                {errors.prioridad && (
                  <p className="mt-1 text-xs text-error">{errors.prioridad.message}</p>
                )}
              </div>
            </div>

            {/* Fecha de vencimiento */}
            <div>
              <label htmlFor="ac-plazo" className={labelClass}>
                {t('acSection.fields.plazoFecha')} <span className="text-error">*</span>
              </label>
              <input
                id="ac-plazo"
                type="date"
                className={inputClass}
                {...register('plazoFecha')}
              />
              {errors.plazoFecha && (
                <p className="mt-1 text-xs text-error">{errors.plazoFecha.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-hairline px-6 py-4 dark:border-hairline/20">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {t('acSection.actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── IncidentACSection ────────────────────────────────────────────────────────

interface IncidentACSectionProps {
  incidenteId: string
  incidenteNumero: string
  accionesCorrectivas: AccionCorrectivaIncidente[]
  incidenteEstado: IncidentStatus
  canAsignarAC: boolean
  canCerrarAC: boolean
}

export function IncidentACSection({
  incidenteId,
  incidenteNumero,
  accionesCorrectivas,
  incidenteEstado,
  canAsignarAC,
  canCerrarAC,
}: IncidentACSectionProps) {
  const { t } = useTranslation('incidents')

  const [showAddModal, setShowAddModal] = useState(false)
  const [closingAcId, setClosingAcId] = useState<string | null>(null)

  const createAC = useCreateACIncidente(incidenteId)
  const updateAC = useUpdateACIncidente(incidenteId)
  const cerrarAC = useCerrarACIncidente(incidenteId)

  const isTerminal = TERMINAL_INCIDENT.includes(incidenteEstado)

  const onAddAC = async (data: CreateACIncidenteInput) => {
    await createAC.mutateAsync(data)
    setShowAddModal(false)
  }

  const onTransition = (acId: string, newEstado: string) => {
    updateAC.mutate({ acId, data: { estado: newEstado as AccionCorrectivaIncidente['estado'] } })
  }

  const onCerrarConfirm = (data: CerrarACIncidenteInput) => {
    if (!closingAcId) return
    cerrarAC.mutate(
      { acId: closingAcId, data },
      { onSuccess: () => setClosingAcId(null) },
    )
  }

  return (
    <section aria-labelledby="inc-ac-section-title">
      {showAddModal && (
        <AgregarACModal
          incidenteId={incidenteId}
          incidenteLabel={incidenteNumero}
          onConfirm={onAddAC}
          onClose={() => setShowAddModal(false)}
          isPending={createAC.isPending}
        />
      )}

      {closingAcId && (
        <CerrarACModal
          onConfirm={onCerrarConfirm}
          onClose={() => setClosingAcId(null)}
          isPending={cerrarAC.isPending}
        />
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3
          id="inc-ac-section-title"
          className="text-base font-medium text-ink dark:text-on-dark"
        >
          {t('acSection.title')}
          {accionesCorrectivas.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted dark:text-on-dark-soft">
              ({accionesCorrectivas.length})
            </span>
          )}
        </h3>

        {canAsignarAC && !isTerminal && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-white hover:bg-coral-dark"
          >
            <Plus size={14} />
            {t('acSection.actions.add')}
          </button>
        )}
      </div>

      {accionesCorrectivas.length === 0 ? (
        <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('acSection.empty')}</p>
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
                </div>

                {!isTerminal && (
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
    </section>
  )
}
