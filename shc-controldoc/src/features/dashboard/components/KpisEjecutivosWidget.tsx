import { useTranslation } from 'react-i18next'
import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiId, KpiResult, KpiUnidad } from '../types/kpi.types'

const KPI_IDS_EJECUTIVOS: KpiId[] = ['KPI-01', 'KPI-04', 'KPI-05']

const SEMAFORO_CLASSES: Record<KpiResult['semaforo'], string> = {
  VERDE: 'border-l-success',
  AMARILLO: 'border-l-warning',
  ROJO: 'border-l-error',
  INFORMATIVO: 'border-l-hairline dark:border-l-hairline/40',
}

const VALOR_CLASSES: Record<KpiResult['semaforo'], string> = {
  VERDE: 'text-success dark:text-success',
  AMARILLO: 'text-warning dark:text-warning',
  ROJO: 'text-error dark:text-error',
  INFORMATIVO: 'text-ink dark:text-on-dark',
}

function formatValor(valor: number, unidad: KpiUnidad): string {
  switch (unidad) {
    case 'PORCENTAJE':
      return `${valor.toFixed(1)}%`
    case 'DIAS':
      return `${valor.toFixed(1)} d`
    case 'TASA':
      return valor.toFixed(2)
    case 'CONTEO':
      return Math.round(valor).toString()
    case 'DISTRIBUCION':
      return Math.round(valor).toString()
  }
}

interface KpisEjecutivosWidgetProps {
  resumenQE: { abiertos: number; vencidos: number }
  kpis: KpiResult[]
}

export function KpisEjecutivosWidget({ resumenQE, kpis }: KpisEjecutivosWidgetProps) {
  const { t } = useTranslation('dashboard')
  const kpisEjecutivos = KPI_IDS_EJECUTIVOS.map((id) => kpis.find((k) => k.kpiId === id)).filter(
    (k): k is KpiResult => !!k,
  )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('altaDireccion.kpisEjecutivos.title')}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div
          data-testid="kpi-card-qes-abiertos"
          className="rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated"
        >
          <p className="text-xs font-medium text-muted dark:text-on-dark-soft">
            {t('altaDireccion.kpisEjecutivos.qesAbiertos')}
          </p>
          <p className="mt-1 text-2xl font-medium text-ink dark:text-on-dark">{resumenQE.abiertos}</p>
        </div>
        <div
          data-testid="kpi-card-qes-vencidos"
          className="rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated"
        >
          <p className="text-xs font-medium text-muted dark:text-on-dark-soft">
            {t('altaDireccion.kpisEjecutivos.qesVencidos')}
          </p>
          <p className="mt-1 text-2xl font-medium text-ink dark:text-on-dark">{resumenQE.vencidos}</p>
        </div>
        {kpisEjecutivos.map((kpiResult) => {
          const definicion = KPI_DEFINITIONS[kpiResult.kpiId]
          return (
            <div
              key={kpiResult.kpiId}
              data-testid={`kpi-card-${kpiResult.kpiId}`}
              className={`rounded-lg border-y border-r border-y-hairline border-r-hairline bg-surface-card p-4 dark:border-y-hairline/20 dark:border-r-hairline/20 dark:bg-surface-dark-elevated border-l-[3px] ${SEMAFORO_CLASSES[kpiResult.semaforo]}`}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-soft dark:text-on-dark-soft">
                {kpiResult.kpiId}
              </p>
              <p className="mt-1 text-xs font-medium text-muted dark:text-on-dark-soft">{definicion.nombre}</p>
              <p className={`mt-1 text-2xl font-medium ${VALOR_CLASSES[kpiResult.semaforo]}`}>
                {formatValor(kpiResult.valor, definicion.unidad)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
