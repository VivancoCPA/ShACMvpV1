import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getValidQETransitions } from '../utils/qualityEventTransitions'
import { getQualityEventPermissions } from '../utils/qualityEventPermissions'
import { useTransitionQEStatus } from '../hooks/useTransitionQEStatus'
import { QE_STATUS_LABELS } from '../../../constants/shared.constants'
import type { QualityEvent, QEStatus } from '../types/qualityEvent.types'
import type { UserRole } from '../../../types/auth.types'

interface QEStatusTransitionPanelProps {
  qe: QualityEvent
  rol: UserRole
}

const EXCLUDED_TARGETS: QEStatus[] = ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO', 'REABIERTO']

export function QEStatusTransitionPanel({ qe, rol }: QEStatusTransitionPanelProps) {
  const { t } = useTranslation('qualityEvents')
  const { mutate, isPending } = useTransitionQEStatus()

  const permissions = getQualityEventPermissions(qe.estado, rol, false)
  const validTargets = getValidQETransitions(qe.estado).filter(
    (target) => !EXCLUDED_TARGETS.includes(target) && permissions.puedeAvanzarEstado,
  )

  if (validTargets.length === 0) return null

  const handleClick = (target: QEStatus) => {
    mutate(
      { id: qe.id, data: { nuevoEstado: target } },
      {
        onSuccess: () => {
          toast.success(t('detail.transitions.success', { estado: QE_STATUS_LABELS[target] }))
        },
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label={t('detail.transitions.title')}>
      {validTargets.map((target) => {
        if (target === 'PENDIENTE_CIERRE') {
          const bloqueadaPorACs = qe.accionesCorrectivas.some((ac) => ac.estado !== 'CERRADA')
          if (bloqueadaPorACs) {
            return (
              <button
                key={target}
                type="button"
                disabled
                title={t('detail.transitions.rnQe003Tooltip')}
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
              >
                {QE_STATUS_LABELS[target]}
              </button>
            )
          }
        }

        if (target === 'ANALISIS_COMPLETADO' && qe.solicitudesAC > 0) {
          return (
            <button
              key={target}
              type="button"
              disabled
              title={t('detail.transitions.rnQe009Tooltip', { count: qe.solicitudesAC })}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
            >
              {QE_STATUS_LABELS[target]}
            </button>
          )
        }

        if (target === 'EN_EJECUCION' && !qe.causaRaizFirmadaEn) {
          return (
            <button
              key={target}
              type="button"
              disabled
              title={t('detail.transitions.rnQe002Tooltip')}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
            >
              {QE_STATUS_LABELS[target]}
            </button>
          )
        }

        return (
          <button
            key={target}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(target)}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {QE_STATUS_LABELS[target]}
          </button>
        )
      })}
    </div>
  )
}
