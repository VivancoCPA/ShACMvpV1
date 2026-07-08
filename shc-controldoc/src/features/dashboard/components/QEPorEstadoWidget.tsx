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

const NAVEGABLE_ESTADOS: Partial<Record<QEStatus, true>> = {
  ANALISIS_COMPLETADO: true,
  PENDIENTE_CIERRE: true,
}

interface QEPorEstadoWidgetProps {
  qePorEstado: Record<QEStatus, number>
}

export function QEPorEstadoWidget({ qePorEstado }: QEPorEstadoWidgetProps) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  const rowClass =
    'flex w-full items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-card px-4 py-3 text-left dark:border-hairline/20 dark:bg-surface-dark-elevated'

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">{t('jefeCalidad.qePorEstado.title')}</h2>
      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <div className="space-y-2 p-3">
          {QE_STATUSES.map((estado) => {
            const label = t(`jefeCalidad.qePorEstado.estados.${estado}`)
            const content = (
              <>
                <QEStatusBadge status={estado} />
                <span className="shrink-0 text-sm font-medium text-body dark:text-on-dark-soft">
                  {qePorEstado[estado]}
                </span>
              </>
            )

            if (NAVEGABLE_ESTADOS[estado]) {
              return (
                <button
                  key={estado}
                  type="button"
                  aria-label={label}
                  onClick={() => navigate(`/quality-events?estado=${estado}`)}
                  className={rowClass}
                >
                  {content}
                </button>
              )
            }

            return (
              <div key={estado} aria-label={label} className={rowClass}>
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
