import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { QEStatusBadge } from '../../quality-events/components/QEStatusBadge'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'

const QE_STATUSES: QEStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'EN_VERIFICACION',
  'VERIFICADO',
  'REABIERTO',
]

interface HallazgosPorEstadoWidgetProps {
  hallazgosPorEstado: Record<QEStatus, number>
}

export function HallazgosPorEstadoWidget({ hallazgosPorEstado }: HallazgosPorEstadoWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('auditor.hallazgosPorEstado.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <div className="space-y-2 p-3">
          {QE_STATUSES.map((estado) => {
            const label = t(`jefeCalidad.qePorEstado.estados.${estado}`)
            return (
              <button
                key={estado}
                type="button"
                aria-label={label}
                onClick={() => navigate(`/quality-events?estado=${estado}&origen=O3_HALLAZGO_AUDITORIA`)}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated"
              >
                <QEStatusBadge status={estado} />
                <span className="shrink-0 text-sm font-medium text-body dark:text-on-dark-soft">
                  {hallazgosPorEstado[estado]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
