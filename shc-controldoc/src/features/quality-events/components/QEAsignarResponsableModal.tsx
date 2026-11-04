import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { SearchableSelect } from '../../../components/shared/SearchableSelect'
import { useCandidatosResponsableQE } from '../hooks/useCandidatosResponsableQE'
import { useAsignarResponsableQE } from '../hooks/useAsignarResponsableQE'
import type { QualityEvent } from '../types/qualityEvent.types'

const asignarResponsableSchema = z.object({
  responsableInvestigacionId: z.string().min(1),
})

type AsignarResponsableValues = z.infer<typeof asignarResponsableSchema>

interface QEAsignarResponsableModalProps {
  qe: QualityEvent
  onClose: () => void
}

// PATCH /api/quality-events/:id/responsable — usado desde QEHeaderSection y desde el enlace del
// QEStatusTransitionPanel (qe-precarga-incidente-responsable D10). Solo se monta para JCA.
export function QEAsignarResponsableModal({ qe, onClose }: QEAsignarResponsableModalProps) {
  const { t } = useTranslation('qualityEvents')
  const { data: candidatos = [], isLoading } = useCandidatosResponsableQE()
  const { mutate, isPending } = useAsignarResponsableQE()

  const { control, handleSubmit, watch } = useForm<AsignarResponsableValues>({
    resolver: zodResolver(asignarResponsableSchema),
    defaultValues: { responsableInvestigacionId: qe.responsableInvestigacionId ?? '' },
  })
  const seleccionado = watch('responsableInvestigacionId')
  const sinCambios = !seleccionado || seleccionado === qe.responsableInvestigacionId

  const onSubmit = ({ responsableInvestigacionId }: AsignarResponsableValues) => {
    mutate(
      { id: qe.id, responsableInvestigacionId },
      {
        onSuccess: () => {
          toast.success(t('detail.responsable.exito'))
          onClose()
        },
        onError: () => toast.error(t('detail.responsable.error')),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qe-asignar-responsable-title"
        className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.responsable.cerrar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 id="qe-asignar-responsable-title" className="mb-4 font-medium text-ink dark:text-on-dark">
          {t('detail.responsable.modalTitle')}
        </h2>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="qe-responsable-select"
              className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft"
            >
              {t('form.fields.responsableInvestigacion')}
            </label>
            <Controller
              name="responsableInvestigacionId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  id="qe-responsable-select"
                  ariaLabel={t('form.fields.responsableInvestigacion')}
                  placeholder={t('form.placeholders.search')}
                  disabled={isLoading}
                  options={candidatos.map((c) => ({
                    id: c.id,
                    label: c.nombreCompleto,
                    sublabel: t(`roles.${c.rol}`),
                  }))}
                  value={field.value || undefined}
                  onChange={(id) => field.onChange(id ?? '')}
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('detail.responsable.cancelar')}
            </button>
            <button
              type="submit"
              disabled={sinCambios || isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
            >
              {isPending ? t('detail.responsable.guardando') : t('detail.responsable.guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
