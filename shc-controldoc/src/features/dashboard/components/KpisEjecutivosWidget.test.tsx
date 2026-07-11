import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { KpisEjecutivosWidget } from './KpisEjecutivosWidget'
import type { KpiResult } from '../types/kpi.types'

afterEach(() => cleanup())

function kpi(overrides: Partial<KpiResult>): KpiResult {
  return {
    kpiId: 'KPI-01',
    valor: 87.5,
    meta: 90,
    metaTipo: 'ABSOLUTO',
    semaforo: 'AMARILLO',
    periodo: '2026-07',
    calculadoEn: '2026-07-08T00:00:00Z',
    ...overrides,
  }
}

const ALL_KPIS: KpiResult[] = [
  kpi({ kpiId: 'KPI-01', valor: 87.5, semaforo: 'AMARILLO' }),
  kpi({ kpiId: 'KPI-02', valor: 12, semaforo: 'VERDE' }),
  kpi({ kpiId: 'KPI-03', valor: 4, semaforo: 'VERDE' }),
  kpi({ kpiId: 'KPI-04', valor: 8, semaforo: 'VERDE', metaTipo: 'REDUCCION_INTERANUAL' }),
  kpi({ kpiId: 'KPI-05', valor: 92, semaforo: 'VERDE' }),
]

function renderWidget(resumenQE: { abiertos: number; vencidos: number }, kpis: KpiResult[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <KpisEjecutivosWidget resumenQE={resumenQE} kpis={kpis} />
    </I18nextProvider>,
  )
}

describe('KpisEjecutivosWidget', () => {
  it('renders exactly 5 cards in order: abiertos, vencidos, KPI-01, KPI-04, KPI-05', () => {
    renderWidget({ abiertos: 12, vencidos: 3 }, ALL_KPIS)
    expect(screen.getByTestId('kpi-card-qes-abiertos')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-card-qes-vencidos')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-card-KPI-01')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-card-KPI-04')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-card-KPI-05')).toBeInTheDocument()
    expect(screen.queryByTestId('kpi-card-KPI-02')).not.toBeInTheDocument()
    expect(screen.queryByTestId('kpi-card-KPI-03')).not.toBeInTheDocument()

    const container = screen.getByTestId('kpi-card-qes-abiertos').parentElement!
    const testIds = Array.from(container.children).map((el) => el.getAttribute('data-testid'))
    expect(testIds).toEqual(['kpi-card-qes-abiertos', 'kpi-card-qes-vencidos', 'kpi-card-KPI-01', 'kpi-card-KPI-04', 'kpi-card-KPI-05'])
  })

  it('shows the abiertos/vencidos counts as plain numbers', () => {
    renderWidget({ abiertos: 12, vencidos: 3 }, ALL_KPIS)
    expect(screen.getByTestId('kpi-card-qes-abiertos').textContent).toContain('12')
    expect(screen.getByTestId('kpi-card-qes-vencidos').textContent).toContain('3')
  })

  it('formats KPI-01 as a percentage value', () => {
    renderWidget({ abiertos: 0, vencidos: 0 }, ALL_KPIS)
    expect(screen.getByTestId('kpi-card-KPI-01').textContent).toContain('87.5%')
  })
})
