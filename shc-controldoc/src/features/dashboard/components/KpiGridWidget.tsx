import { useTranslation } from 'react-i18next'
import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiResult } from '../types/kpi.types'
import type { KpiUnidad } from '../types/kpi.types'

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

interface KpiGridWidgetProps {
  kpis: KpiResult[]
}

export function KpiGridWidget({ kpis }: KpiGridWidgetProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">{t('jefeCalidad.kpis.title')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpiResult) => {
          const definicion = KPI_DEFINITIONS[kpiResult.kpiId]
          const esInformativo = kpiResult.semaforo === 'INFORMATIVO'
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

              {esInformativo ? (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-muted dark:text-on-dark-soft">{t('jefeCalidad.kpis.distribucionTitulo')}</p>
                  <ol className="space-y-0.5">
                    {(kpiResult.distribucion ?? []).slice(0, 3).map((entrada, index) => (
                      <li key={entrada.area} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink dark:text-on-dark">
                          {index + 1}. {entrada.area}
                        </span>
                        <span className="shrink-0 font-medium text-ink dark:text-on-dark">{entrada.valor}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <>
                  <p className={`mt-1 text-2xl font-medium ${VALOR_CLASSES[kpiResult.semaforo]}`}>
                    {formatValor(kpiResult.valor, definicion.unidad)}
                  </p>
                  <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
                    {kpiResult.metaTipo === 'REDUCCION_INTERANUAL'
                      ? t('jefeCalidad.kpis.metaReduccionInteranual', { meta: kpiResult.meta })
                      : t('jefeCalidad.kpis.meta', { meta: formatValor(kpiResult.meta, definicion.unidad) })}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
