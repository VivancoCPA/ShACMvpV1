import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { KpiGridWidget } from './KpiGridWidget'
import type { KpiResult } from '../types/kpi.types'
import type { KpiId } from '../types/kpi.types'

const ALL_KPI_IDS: KpiId[] = [
  'KPI-01',
  'KPI-02',
  'KPI-03',
  'KPI-04',
  'KPI-05',
  'KPI-06',
  'KPI-07',
  'KPI-08',
  'KPI-09',
]

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

function renderWidget(kpis: KpiResult[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <KpiGridWidget kpis={kpis} />
    </I18nextProvider>,
  )
}

afterEach(() => cleanup())

describe('KpiGridWidget', () => {
  it('renders exactly 9 KPI cards, one per KpiId', () => {
    const kpis = ALL_KPI_IDS.map((kpiId) => kpi({ kpiId }))
    renderWidget(kpis)
    for (const kpiId of ALL_KPI_IDS) {
      expect(screen.getByTestId(`kpi-card-${kpiId}`)).toBeInTheDocument()
    }
  })

  it('formats a PORCENTAJE value with the % symbol', () => {
    renderWidget([kpi({ kpiId: 'KPI-01', valor: 87.5, semaforo: 'VERDE' })])
    expect(screen.getByText('87.5%')).toBeInTheDocument()
  })

  it('reflects semaforo ROJO with the error color class, not success or warning', () => {
    renderWidget([kpi({ kpiId: 'KPI-03', semaforo: 'ROJO' })])
    const card = screen.getByTestId('kpi-card-KPI-03')
    expect(card.className).toContain('border-l-error')
    expect(card.className).not.toContain('border-l-success')
    expect(card.className).not.toContain('border-l-warning')
  })

  it('uses split border classes so the dark-mode left border color is not overridden by a shorthand border', () => {
    renderWidget([kpi({ kpiId: 'KPI-02', semaforo: 'VERDE' })])
    const card = screen.getByTestId('kpi-card-KPI-02')
    // A bare `dark:border-hairline/20` (shorthand, higher Tailwind specificity than border-l-*)
    // would repaint all 4 sides, including the semantic left border, in dark mode.
    expect(card.className).not.toMatch(/\bdark:border-hairline\/20\b/)
    expect(card.className).toContain('dark:border-y-hairline/20')
    expect(card.className).toContain('dark:border-r-hairline/20')
    expect(card.className).toContain('border-l-success')
  })

  it('KPI-04 (REDUCCION_INTERANUAL) shows the interannual reduction text, not a numeric threshold', () => {
    renderWidget([
      kpi({ kpiId: 'KPI-04', valor: 8, meta: 10, metaTipo: 'REDUCCION_INTERANUAL', semaforo: 'VERDE', valorPeriodoAnterior: 10 }),
    ])
    expect(screen.getByText('Reducción ≥10% anual')).toBeInTheDocument()
    expect(screen.queryByText('Meta: 10.00')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Meta: 10%?$/)).not.toBeInTheDocument()
  })

  it('KPI-09 (INFORMATIVO) shows a ranked area list instead of a single numeric value', () => {
    renderWidget([
      kpi({
        kpiId: 'KPI-09',
        valor: 5,
        semaforo: 'INFORMATIVO',
        distribucion: [
          { area: 'Almacén Norte', valor: 5 },
          { area: 'Calidad', valor: 2 },
          { area: 'Laboratorio de Calidad', valor: 1 },
        ],
      }),
    ])
    const card = screen.getByTestId('kpi-card-KPI-09')
    expect(card.textContent).toContain('Almacén Norte')
    expect(card.textContent).toContain('Calidad')
    expect(card.textContent).toContain('Laboratorio de Calidad')
    expect(card.className).not.toContain('border-l-success')
    expect(card.className).not.toContain('border-l-warning')
    expect(card.className).not.toContain('border-l-error')
  })
})
