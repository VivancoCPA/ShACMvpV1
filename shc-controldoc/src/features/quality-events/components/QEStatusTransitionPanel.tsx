import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getValidQETransitions } from '../utils/qualityEventTransitions'
import {
  esResponsableInvestigacion,
  getQualityEventPermissions,
  puedeAsignarResponsable,
} from '../utils/qualityEventPermissions'
import { QEAsignarResponsableModal } from './QEAsignarResponsableModal'
import { useTransitionQEStatus } from '../hooks/useTransitionQEStatus'
import { QE_STATUS_LABELS } from '../../../constants/shared.constants'
import type { QualityEvent, QEStatus } from '../types/qualityEvent.types'
import type { UserRole } from '../../../types/auth.types'

interface QEStatusTransitionPanelProps {
  qe: QualityEvent
  rol: UserRole
  usuarioId: string
}

const EXCLUDED_TARGETS: QEStatus[] = ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO', 'REABIERTO']

export function QEStatusTransitionPanel({ qe, rol, usuarioId }: QEStatusTransitionPanelProps) {
  const { t } = useTranslation('qualityEvents')
  const { mutate, isPending } = useTransitionQEStatus()
  const [asignarOpen, setAsignarOpen] = useState(false)

  const permissions = getQualityEventPermissions(qe.estado, rol, esResponsableInvestigacion(qe, { id: usuarioId }))
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

        // PRD §1.3 (1 → 2): requiere responsable de investigación (espejo de QE_SIN_RESPONSABLE).
        // Solo desde ABIERTO — la reapertura no se bloquea.
        if (qe.estado === 'ABIERTO' && target === 'EN_INVESTIGACION' && !qe.responsableInvestigacionId) {
          return (
            <span key={target} className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled
                title={t('errors.QE_SIN_RESPONSABLE')}
                aria-describedby="qe-sin-responsable-hint"
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft"
              >
                {QE_STATUS_LABELS[target]}
              </button>
              <span id="qe-sin-responsable-hint" className="sr-only">
                {t('errors.QE_SIN_RESPONSABLE')}
              </span>
              {puedeAsignarResponsable(qe, rol) && (
                <button
                  type="button"
                  onClick={() => setAsignarOpen(true)}
                  className="text-sm font-medium text-coral hover:underline dark:text-coral"
                >
                  {t('detail.responsable.asignarPrimero')}
                </button>
              )}
            </span>
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
      {asignarOpen && <QEAsignarResponsableModal qe={qe} onClose={() => setAsignarOpen(false)} />}
    </div>
  )
}
