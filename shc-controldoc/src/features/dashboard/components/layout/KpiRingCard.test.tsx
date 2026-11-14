import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../../i18n'
import { KpiRingCard } from './KpiRingCard'
import { KPI_DEFINITIONS } from '../../constants/kpi.constants'
import type { KpiId, KpiResult } from '../../types/kpi.types'

function kpi(overrides: Partial<KpiResult> & { kpiId: KpiId }): KpiResult {
  return {
    valor: 87,
    meta: 90,
    metaTipo: 'ABSOLUTO',
    semaforo: 'AMARILLO',
    periodo: '2026-11',
    calculadoEn: '2026-11-06T00:00:00Z',
    ...overrides,
  }
}

function renderCard(k: KpiResult, tendencia?: number[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <KpiRingCard kpi={k} definicion={KPI_DEFINITIONS[k.kpiId]} tendencia={tendencia} />
    </I18nextProvider>,
  )
}

afterEach(() => cleanup())

describe('KpiRingCard', () => {
  it('colors the progress arc from the semaforo', () => {
    renderCard(kpi({ kpiId: 'KPI-01', semaforo: 'AMARILLO' }))
    const arco = screen.getByTestId('kpi-ring-progreso')
    expect(arco.getAttribute('class')).toContain('stroke-amber')
    expect(arco.getAttribute('class')).not.toContain('stroke-success')
    expect(arco.getAttribute('class')).not.toContain('stroke-error')
  })

  it('draws the arc proportional to the progress and starting at 12 o\'clock', () => {
    renderCard(kpi({ kpiId: 'KPI-01', valor: 45, meta: 90 }))
    const arco = screen.getByTestId('kpi-ring-progreso')
    expect(arco.getAttribute('data-avance')).toBe('0.5000')
    expect(arco.getAttribute('transform')).toContain('rotate(-90')
    expect(arco.getAttribute('stroke-linecap')).toBe('round')
  })

  it('shows the target with ≥ for higher-is-better and ≤ for lower-is-better', () => {
    renderCard(kpi({ kpiId: 'KPI-01', meta: 90 }))
    expect(screen.getByText(i18n.t('dashboard:kpi.meta', { op: '≥', valor: '90.0%' }))).toBeInTheDocument()
    cleanup()
    renderCard(kpi({ kpiId: 'KPI-02', valor: 13, meta: 15 }))
    expect(screen.getByText(i18n.t('dashboard:kpi.meta', { op: '≤', valor: '15.0 d' }))).toBeInTheDocument()
  })

  it('shows an improvement in green with the arrow for a lower-is-better KPI', () => {
    renderCard(kpi({ kpiId: 'KPI-02', valor: 13, meta: 15, valorPeriodoAnterior: 15 }))
    const variacion = screen.getByTestId('kpi-variacion')
    expect(variacion).toHaveTextContent('▼ 2.0 d')
    expect(variacion.className).toContain('text-success')
  })

  it('shows a worsening in red with the arrow for a higher-is-better KPI', () => {
    renderCard(kpi({ kpiId: 'KPI-01', valor: 87, valorPeriodoAnterior: 90 }))
    const variacion = screen.getByTestId('kpi-variacion')
    expect(variacion).toHaveTextContent('▼ 3.0 pts')
    expect(variacion.className).toContain('text-error')
  })

  it('hides the variation without a previous value', () => {
    renderCard(kpi({ kpiId: 'KPI-01' }))
    expect(screen.queryByTestId('kpi-variacion')).not.toBeInTheDocument()
    cleanup()
    renderCard(kpi({ kpiId: 'KPI-01', valorPeriodoAnterior: null }))
    expect(screen.queryByTestId('kpi-variacion')).not.toBeInTheDocument()
  })

  it('draws the sparkline only when a trend arrives', () => {
    const { container } = renderCard(kpi({ kpiId: 'KPI-01' }))
    expect(container.querySelector('polyline')).toBeNull()
    cleanup()
    const withTrend = renderCard(kpi({ kpiId: 'KPI-01' }), [80, 82, 85, 87])
    expect(withTrend.container.querySelector('polyline')).not.toBeNull()
  })

  it('has a complete aria-label: name, value, target and state', () => {
    renderCard(kpi({ kpiId: 'KPI-01', valor: 87, meta: 90, semaforo: 'AMARILLO' }))
    const card = screen.getByRole('img')
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain(KPI_DEFINITIONS['KPI-01'].nombre)
    expect(label).toContain('87.0%')
    expect(label).toContain('90.0%')
    expect(label).toContain(i18n.t('dashboard:kpi.semaforo.AMARILLO'))
  })

  it('shows "Datos incompletos" when the KPI flags it', () => {
    renderCard(kpi({ kpiId: 'KPI-04', metaTipo: 'REDUCCION_INTERANUAL', meta: 10, valor: 2, datosIncompletos: true }))
    expect(screen.getByText(i18n.t('dashboard:kpi.datosIncompletos'))).toBeInTheDocument()
  })

  it('shows KPI-04 target as an interannual reduction, not a threshold', () => {
    renderCard(kpi({ kpiId: 'KPI-04', metaTipo: 'REDUCCION_INTERANUAL', meta: 10, valor: 2 }))
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.kpis.metaReduccionInteranual', { meta: 10 }))).toBeInTheDocument()
  })

  it('renders the area distribution instead of a ring for an INFORMATIVO KPI', () => {
    renderCard(
      kpi({
        kpiId: 'KPI-09',
        semaforo: 'INFORMATIVO',
        valor: 5,
        meta: 3,
        distribucion: [
          { area: 'Almacén Norte', valor: 5 },
          { area: 'Calidad', valor: 2 },
          { area: 'Patio', valor: 1 },
          { area: 'Muelle', valor: 1 },
        ],
      }),
    )
    expect(screen.queryByTestId('kpi-ring-progreso')).not.toBeInTheDocument()
    expect(screen.getByText(/Almacén Norte/)).toBeInTheDocument()
    expect(screen.queryByText(/Muelle/)).not.toBeInTheDocument()
  })
})
