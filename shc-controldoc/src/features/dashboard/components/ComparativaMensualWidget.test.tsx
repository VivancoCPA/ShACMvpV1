import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { ComparativaMensualWidget } from './ComparativaMensualWidget'
import type { AltaDireccionDashboardData } from '../types/dashboardData.types'

afterEach(() => cleanup())

function renderWidget(comparativaMensual: AltaDireccionDashboardData['comparativaMensual']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ComparativaMensualWidget comparativaMensual={comparativaMensual} />
    </I18nextProvider>,
  )
}

describe('ComparativaMensualWidget', () => {
  it('renders the 3 KPI cards (KPI-01/04/05) with actual and previous-month values', () => {
    renderWidget({
      'KPI-01': { actual: 92.5, anterior: 91, tendencia: 'ESTABLE' },
      'KPI-04': { actual: 8, anterior: 10, tendencia: 'BAJA' },
      'KPI-05': { actual: 85, anterior: 80, tendencia: 'SUBE' },
    })
    expect(screen.getByTestId('comparativa-card-KPI-01')).toBeInTheDocument()
    expect(screen.getByTestId('comparativa-card-KPI-04')).toBeInTheDocument()
    expect(screen.getByTestId('comparativa-card-KPI-05')).toBeInTheDocument()
    expect(screen.getByTestId('comparativa-card-KPI-01').textContent).toContain('92.5')
    expect(screen.getByTestId('comparativa-card-KPI-01').textContent).toContain('91.0')
  })

  it('shows an up arrow for SUBE and a down arrow for BAJA', () => {
    renderWidget({
      'KPI-01': { actual: 92, anterior: 80, tendencia: 'SUBE' },
      'KPI-04': { actual: 5, anterior: 10, tendencia: 'BAJA' },
      'KPI-05': { actual: 85, anterior: 85, tendencia: 'ESTABLE' },
    })
    expect(screen.getByTestId('comparativa-card-KPI-01').textContent).toContain('↑')
    expect(screen.getByTestId('comparativa-card-KPI-04').textContent).toContain('↓')
    expect(screen.getByTestId('comparativa-card-KPI-05').textContent).toContain('=')
  })
})
