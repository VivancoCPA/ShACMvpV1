import { useTranslation } from 'react-i18next'
import type { AltaDireccionDashboardData } from '../types/dashboardData.types'

type ComparativaMensual = AltaDireccionDashboardData['comparativaMensual']
type ComparativaKpiId = keyof ComparativaMensual
type Tendencia = ComparativaMensual[ComparativaKpiId]['tendencia']

const KPI_IDS: ComparativaKpiId[] = ['KPI-01', 'KPI-04', 'KPI-05']

const TENDENCIA_ICONS: Record<Tendencia, string> = {
  SUBE: '↑',
  BAJA: '↓',
  ESTABLE: '=',
}

const TENDENCIA_CLASSES: Record<Tendencia, string> = {
  SUBE: 'text-success dark:text-success',
  BAJA: 'text-error dark:text-error',
  ESTABLE: 'text-muted dark:text-on-dark-soft',
}

interface ComparativaMensualWidgetProps {
  comparativaMensual: ComparativaMensual
}

export function ComparativaMensualWidget({ comparativaMensual }: ComparativaMensualWidgetProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('altaDireccion.comparativaMensual.title')}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {KPI_IDS.map((kpiId) => {
          const entry = comparativaMensual[kpiId]
          return (
            <div
              key={kpiId}
              data-testid={`comparativa-card-${kpiId}`}
              className="rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-soft dark:text-on-dark-soft">
                {kpiId}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-medium text-ink dark:text-on-dark">{entry.actual.toFixed(1)}</p>
                <span className={`text-lg font-medium ${TENDENCIA_CLASSES[entry.tendencia]}`}>
                  {TENDENCIA_ICONS[entry.tendencia]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
                {t('altaDireccion.comparativaMensual.mesAnterior', { valor: entry.anterior.toFixed(1) })}
              </p>
              <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                {t(`altaDireccion.comparativaMensual.tendencia.${entry.tendencia}`)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
