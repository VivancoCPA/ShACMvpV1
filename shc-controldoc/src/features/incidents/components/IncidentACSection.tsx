import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { useUsers } from '../../nonconformities/hooks/useUsers'
import { useCreateACIncidente } from '../hooks/useIncidents'
import { createACIncidenteSchema, type CreateACIncidenteInput } from '../schemas/createAC.schema'
import type { AccionCorrectivaIncidente } from '../types/incident.types'

const AC_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-muted-soft/20 text-muted',
  EN_EJECUCION: 'bg-amber/20 text-amber',
  COMPLETADA: 'bg-teal/20 text-teal',
  CERRADA: 'bg-success/20 text-success',
}

interface AgregarACModalProps {
  incidenteId: string
  onClose: () => void
}

function AgregarACModal({ incidenteId, onClose }: AgregarACModalProps) {
  const { t } = useTranslation('incidents')
  const { data: users = [] } = useUsers()
  const createAC = useCreateACIncidente(incidenteId)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateACIncidenteInput>({ resolver: zodResolver(createACIncidenteSchema) })

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  const onSubmit = async (data: CreateACIncidenteInput) => {
    await createAC.mutateAsync(data)
    onClose()
  }

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

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="ac-descripcion" className={labelClass}>
                {t('acSection.fields.descripcion')} <span className="text-error">*</span>
              </label>
              <textarea
                id="ac-descripcion"
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                placeholder={t('acSection.placeholders.descripcion')}
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="mt-1 text-xs text-error">{errors.descripcion.message}</p>
              )}
            </div>

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

            <div>
              <label htmlFor="ac-fecha" className={labelClass}>
                {t('acSection.fields.fechaLimite')} <span className="text-error">*</span>
              </label>
              <input
                id="ac-fecha"
                type="date"
                className={inputClass}
                {...register('fechaLimite')}
              />
              {errors.fechaLimite && (
                <p className="mt-1 text-xs text-error">{errors.fechaLimite.message}</p>
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
              disabled={isSubmitting || createAC.isPending}
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

interface IncidentACSectionProps {
  incidenteId: string
  accionesCorrectivas: AccionCorrectivaIncidente[]
  canAddAC: boolean
}

export function IncidentACSection({
  incidenteId,
  accionesCorrectivas,
  canAddAC,
}: IncidentACSectionProps) {
  const { t } = useTranslation('incidents')
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <section aria-labelledby="inc-ac-section-title">
      {showAddModal && (
        <AgregarACModal incidenteId={incidenteId} onClose={() => setShowAddModal(false)} />
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 id="inc-ac-section-title" className="text-base font-medium text-ink dark:text-on-dark">
          {t('acSection.title')}
          {accionesCorrectivas.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted dark:text-on-dark-soft">
              ({accionesCorrectivas.length})
            </span>
          )}
        </h3>

        {canAddAC && (
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
                  <p className="text-sm text-body dark:text-on-dark-soft">{ac.descripcion}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-pill px-2 py-0.5 text-xs font-medium ${AC_STATUS_COLORS[ac.estado] ?? 'bg-muted-soft/20 text-muted'}`}
                    >
                      {t(`acSection.acStatus.${ac.estado}`)}
                    </span>
                    <DeadlineBadge fechaCierre={ac.fechaLimite} estado={ac.estado} />
                  </div>
                  {ac.evidencia && (
                    <p className="mt-1 text-xs text-success">{ac.evidencia}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
