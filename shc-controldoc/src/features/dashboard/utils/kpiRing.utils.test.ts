import { describe, expect, it } from 'vitest'
import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { KpiId, KpiResult } from '../types/kpi.types'
import { calcularAvanceKpi, calcularVariacionKpi, sparklinePoints, ultimosValores } from './kpiRing.utils'

function kpi(kpiId: KpiId, overrides: Partial<KpiResult> = {}): KpiResult {
  return {
    kpiId,
    valor: 0,
    meta: KPI_DEFINITIONS[kpiId].meta,
    metaTipo: KPI_DEFINITIONS[kpiId].metaTipo,
    semaforo: 'VERDE',
    periodo: '2026-11',
    calculadoEn: '2026-11-06T00:00:00Z',
    ...overrides,
  }
}

const avance = (k: KpiResult) => calcularAvanceKpi(k, KPI_DEFINITIONS[k.kpiId])
const variacion = (k: KpiResult) => calcularVariacionKpi(k, KPI_DEFINITIONS[k.kpiId])

describe('calcularAvanceKpi', () => {
  it('higher-is-better: valor / meta', () => {
    expect(avance(kpi('KPI-01', { valor: 87, meta: 90 }))).toBeCloseTo(87 / 90)
  })

  it('lower-is-better: meta / valor', () => {
    expect(avance(kpi('KPI-02', { valor: 20, meta: 15 }))).toBeCloseTo(0.75)
  })

  it('lower-is-better with valor 0 counts as complete', () => {
    expect(avance(kpi('KPI-03', { valor: 0, meta: 5 }))).toBe(1)
  })

  it('is clamped to [0, 1]', () => {
    expect(avance(kpi('KPI-01', { valor: 100, meta: 90 }))).toBe(1)
    expect(avance(kpi('KPI-02', { valor: 5, meta: 15 }))).toBe(1)
  })

  it('interannual reduction: reduction / target, 0 without a previous value', () => {
    expect(avance(kpi('KPI-04', { valor: 9.5, meta: 10, valorPeriodoAnterior: 10 }))).toBeCloseTo(0.5)
    expect(avance(kpi('KPI-04', { valor: 2, meta: 10 }))).toBe(0)
    expect(avance(kpi('KPI-04', { valor: 12, meta: 10, valorPeriodoAnterior: 10 }))).toBe(0)
  })
})

describe('calcularVariacionKpi', () => {
  it('returns null without a previous value', () => {
    expect(variacion(kpi('KPI-01', { valor: 80 }))).toBeNull()
    expect(variacion(kpi('KPI-01', { valor: 80, valorPeriodoAnterior: null }))).toBeNull()
  })

  it('follows the direction of the target', () => {
    expect(variacion(kpi('KPI-01', { valor: 92, valorPeriodoAnterior: 90 }))).toEqual({ diff: 2, flecha: '▲', sentido: 'mejora' })
    expect(variacion(kpi('KPI-02', { valor: 17, valorPeriodoAnterior: 15 }))).toEqual({ diff: 2, flecha: '▲', sentido: 'empeora' })
    expect(variacion(kpi('KPI-04', { valor: 3, valorPeriodoAnterior: 4 }))?.sentido).toBe('mejora')
  })

  it('no change is neutral', () => {
    expect(variacion(kpi('KPI-05', { valor: 85, valorPeriodoAnterior: 85 }))).toEqual({ diff: 0, flecha: '=', sentido: 'igual' })
  })
})

describe('sparklinePoints', () => {
  it('needs at least 2 points', () => {
    expect(sparklinePoints([])).toBeNull()
    expect(sparklinePoints([5])).toBeNull()
  })

  it('spans the full width and draws a flat series at mid height', () => {
    expect(sparklinePoints([3, 3, 3])).toBe('0.0,14.0 50.0,14.0 100.0,14.0')
  })

  it('puts the max at the top and the min at the bottom', () => {
    const [primero, ultimo] = (sparklinePoints([0, 10]) ?? '').split(' ')
    expect(primero).toBe('0.0,26.0')
    expect(ultimo).toBe('100.0,2.0')
  })
})

describe('ultimosValores', () => {
  it('takes the last 6 monthly values', () => {
    const serie = [1, 2, 3, 4, 5, 6, 7, 8].map((valor) => ({ periodo: 'x', valor }))
    expect(ultimosValores({ 'KPI-01': serie }, 'KPI-01')).toEqual([3, 4, 5, 6, 7, 8])
    expect(ultimosValores({}, 'KPI-01')).toBeUndefined()
  })
})
