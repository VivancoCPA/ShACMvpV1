import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { KpiGridWidget } from './KpiGridWidget'
import type { KpiId, KpiResult } from '../types/kpi.types'

const ALL_KPI_IDS: KpiId[] = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09']

function kpi(overrides: Partial<KpiResult>): KpiResult {
  return {
    kpiId: 'KPI-01',
    valor: 87.5,
    meta: 95,
    metaTipo: 'ABSOLUTO',
    semaforo: 'ROJO',
    periodo: '2026-07',
    calculadoEn: '2026-07-08T00:00:00Z',
    ...overrides,
  }
}

function renderWidget(props: Parameters<typeof KpiGridWidget>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <KpiGridWidget {...props} />
    </I18nextProvider>,
  )
}

afterEach(() => cleanup())

describe('KpiGridWidget', () => {
  it('by default renders the 6 JCA rings in the mockup order, skipping KPI-04/08/09', () => {
    renderWidget({ kpis: ALL_KPI_IDS.map((kpiId) => kpi({ kpiId })) })
    const ids = screen.getAllByTestId(/^kpi-card-/).map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['KPI-01', 'KPI-02', 'KPI-03', 'KPI-05', 'KPI-07', 'KPI-06'].map((id) => `kpi-card-${id}`))
  })

  it('renders only the requested ids that are present, in the given order', () => {
    renderWidget({ kpis: [kpi({ kpiId: 'KPI-05' }), kpi({ kpiId: 'KPI-01' })], kpiIds: ['KPI-05', 'KPI-02', 'KPI-01'] })
    const ids = screen.getAllByTestId(/^kpi-card-/).map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['kpi-card-KPI-05', 'kpi-card-KPI-01'])
  })

  it('has no section heading of its own (the zone provides the label)', () => {
    renderWidget({ kpis: [kpi({})] })
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('formats a PORCENTAJE value with the % symbol', () => {
    renderWidget({ kpis: [kpi({ kpiId: 'KPI-01', valor: 87.5, semaforo: 'VERDE' })] })
    expect(screen.getByText('87.5%')).toBeInTheDocument()
  })

  it('passes the last 6 months of the trend to the ring sparkline', () => {
    const serie = [1, 2, 3, 4, 5, 6, 7, 8].map((valor, i) => ({ periodo: `2026-0${i + 1}`, valor }))
    renderWidget({ kpis: [kpi({ kpiId: 'KPI-01' })], tendencias: { 'KPI-01': serie } })
    const points = screen.getByTestId('kpi-card-KPI-01').querySelector('polyline')?.getAttribute('points') ?? ''
    expect(points.split(' ')).toHaveLength(6)
  })
})
