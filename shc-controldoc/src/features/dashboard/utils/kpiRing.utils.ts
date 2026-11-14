import type { KpiDefinition, KpiId, KpiResult, KpiUnidad } from '../types/kpi.types'

// KPIs del JCA en la zona "Indicadores", en el orden de la maqueta aprobada
// (dashboard-layout-4-zonas design.md D7).
export const KPI_IDS_JEFE_CALIDAD: KpiId[] = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-05', 'KPI-07', 'KPI-06']

const MESES_TENDENCIA = 6

export type TendenciasKpi = Partial<Record<KpiId, { periodo: string; valor: number }[]>>

// Últimos 6 valores mensuales de la serie de un KPI, para el minigráfico (design.md D5).
export function ultimosValores(tendencias: TendenciasKpi | undefined, kpiId: KpiId): number[] | undefined {
  return tendencias?.[kpiId]?.slice(-MESES_TENDENCIA).map((e) => e.valor)
}

export function formatValorKpi(valor: number, unidad: KpiUnidad): string {
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

// Diferencia formateada en la unidad del KPI (puntos para porcentajes) — design.md D5.
export function formatDiferenciaKpi(diff: number, unidad: KpiUnidad): string {
  switch (unidad) {
    case 'PORCENTAJE':
      return `${diff.toFixed(1)} pts`
    case 'DIAS':
      return `${diff.toFixed(1)} d`
    case 'TASA':
      return diff.toFixed(2)
    case 'CONTEO':
    case 'DISTRIBUCION':
      return Math.round(diff).toString()
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

// Avance del anillo contra la meta, en [0, 1] — dashboard-layout-4-zonas design.md D5.
export function calcularAvanceKpi(kpi: KpiResult, definicion: KpiDefinition): number {
  if (kpi.metaTipo === 'REDUCCION_INTERANUAL') {
    const anterior = kpi.valorPeriodoAnterior
    if (!anterior || kpi.meta <= 0) return 0
    const reduccion = ((anterior - kpi.valor) / anterior) * 100
    return clamp01(reduccion / kpi.meta)
  }
  if (definicion.direccion === 'MENOR_MEJOR') {
    if (kpi.valor <= 0) return 1
    return clamp01(kpi.meta / kpi.valor)
  }
  if (kpi.meta <= 0) return 0
  return clamp01(kpi.valor / kpi.meta)
}

export type SentidoVariacion = 'mejora' | 'empeora' | 'igual'

export interface VariacionKpi {
  diff: number
  flecha: '▲' | '▼' | '='
  sentido: SentidoVariacion
}

// Variación contra valorPeriodoAnterior; null si no hay valor anterior. Mejora según la dirección
// de la meta (KPI-04 se trata como MENOR_MEJOR — design.md D4).
export function calcularVariacionKpi(kpi: KpiResult, definicion: KpiDefinition): VariacionKpi | null {
  if (kpi.valorPeriodoAnterior === undefined || kpi.valorPeriodoAnterior === null) return null
  const diff = kpi.valor - kpi.valorPeriodoAnterior
  if (diff === 0) return { diff, flecha: '=', sentido: 'igual' }
  const menorMejor = definicion.direccion === 'MENOR_MEJOR' || kpi.metaTipo === 'REDUCCION_INTERANUAL'
  const mejora = menorMejor ? diff < 0 : diff > 0
  return { diff, flecha: diff > 0 ? '▲' : '▼', sentido: mejora ? 'mejora' : 'empeora' }
}

// Puntos de un polyline en un viewBox de `ancho`×`alto`, normalizados al min/max de la serie.
// Una serie plana se dibuja a media altura. Menos de 2 puntos → null (sin minigráfico).
export function sparklinePoints(valores: number[], ancho = 100, alto = 28): string | null {
  if (valores.length < 2) return null
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min
  const paso = ancho / (valores.length - 1)
  const margen = 2
  return valores
    .map((v, i) => {
      const y = rango === 0 ? alto / 2 : margen + (1 - (v - min) / rango) * (alto - margen * 2)
      return `${(i * paso).toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
