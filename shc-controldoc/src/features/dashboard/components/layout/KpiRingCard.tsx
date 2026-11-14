import { useTranslation } from 'react-i18next'
import type { KpiDefinition, KpiResult } from '../../types/kpi.types'
import {
  calcularAvanceKpi,
  calcularVariacionKpi,
  formatDiferenciaKpi,
  formatValorKpi,
  sparklinePoints,
} from '../../utils/kpiRing.utils'

const SIZE = 84
const STROKE = 8
const RADIO = (SIZE - STROKE) / 2
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

const ARCO_CLASSES: Record<KpiResult['semaforo'], string> = {
  VERDE: 'stroke-success',
  AMARILLO: 'stroke-amber',
  ROJO: 'stroke-error',
  INFORMATIVO: 'stroke-muted',
}

const SPARK_CLASSES: Record<KpiResult['semaforo'], string> = {
  VERDE: 'stroke-success',
  AMARILLO: 'stroke-amber',
  ROJO: 'stroke-error',
  INFORMATIVO: 'stroke-muted',
}

const VARIACION_CLASSES = {
  mejora: 'text-success dark:text-success',
  empeora: 'text-error dark:text-error',
  igual: 'text-muted dark:text-on-dark-soft',
} as const

interface KpiRingCardProps {
  kpi: KpiResult
  definicion: KpiDefinition
  // Serie mensual (últimos 6 meses) para el minigráfico; sin ella no se dibuja.
  tendencia?: number[]
}

export function KpiRingCard({ kpi, definicion, tendencia }: KpiRingCardProps) {
  const { t } = useTranslation('dashboard')
  const valorTexto = formatValorKpi(kpi.valor, definicion.unidad)
  const metaTexto =
    kpi.metaTipo === 'REDUCCION_INTERANUAL'
      ? t('jefeCalidad.kpis.metaReduccionInteranual', { meta: kpi.meta })
      : t('kpi.meta', {
          op: definicion.direccion === 'MENOR_MEJOR' ? '≤' : '≥',
          valor: formatValorKpi(kpi.meta, definicion.unidad),
        })
  const ariaLabel = t('kpi.ariaLabel', {
    nombre: definicion.nombre,
    valor: valorTexto,
    meta: metaTexto,
    estado: t(`kpi.semaforo.${kpi.semaforo}`),
  })

  const cardClass =
    'flex min-w-0 items-center gap-4 rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated'

  // KPI-09 (INFORMATIVO): una distribución no tiene avance contra meta — se muestra el top 3.
  if (kpi.semaforo === 'INFORMATIVO') {
    return (
      <div role="img" aria-label={ariaLabel} data-testid={`kpi-card-${kpi.kpiId}`} className={cardClass}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink dark:text-on-dark">{definicion.nombre}</p>
          <ol className="mt-1 space-y-0.5">
            {(kpi.distribucion ?? []).slice(0, 3).map((entrada, index) => (
              <li key={entrada.area} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-body dark:text-on-dark-soft">
                  {index + 1}. {entrada.area}
                </span>
                <span className="shrink-0 font-medium text-ink dark:text-on-dark">{entrada.valor}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  const avance = calcularAvanceKpi(kpi, definicion)
  const variacion = calcularVariacionKpi(kpi, definicion)
  const puntos = tendencia ? sparklinePoints(tendencia) : null

  return (
    <div role="img" aria-label={ariaLabel} data-testid={`kpi-card-${kpi.kpiId}`} className={cardClass}>
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIO}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-hairline dark:stroke-surface-dark-soft"
          />
          <circle
            data-testid="kpi-ring-progreso"
            data-avance={avance.toFixed(4)}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIO}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${avance * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className={ARCO_CLASSES[kpi.semaforo]}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-ink dark:text-on-dark">
          {valorTexto}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink dark:text-on-dark">{definicion.nombre}</p>
        <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{metaTexto}</p>
        {variacion && (
          <p data-testid="kpi-variacion" className={`mt-0.5 text-xs font-medium ${VARIACION_CLASSES[variacion.sentido]}`}>
            {variacion.sentido === 'igual'
              ? `= ${t('kpi.variacionSinCambio')}`
              : `${variacion.flecha} ${formatDiferenciaKpi(Math.abs(variacion.diff), definicion.unidad)}`}
          </p>
        )}
        {kpi.datosIncompletos && (
          <p className="mt-0.5 text-xs text-warning dark:text-amber">{t('kpi.datosIncompletos')}</p>
        )}
        {puntos && (
          <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-1 h-7 w-full max-w-[140px]" aria-hidden="true">
            <polyline
              points={puntos}
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={SPARK_CLASSES[kpi.semaforo]}
            />
          </svg>
        )}
      </div>
    </div>
  )
}
