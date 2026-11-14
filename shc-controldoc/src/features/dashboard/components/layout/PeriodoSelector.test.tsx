import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach, vi } from 'vitest'
import i18n from '../../../../i18n'
import { PeriodoSelector } from './PeriodoSelector'
import { periodoActual, usePeriodoKpi } from '../../hooks/usePeriodoKpi'
import { DASHBOARD_QUERY_KEYS } from '../../hooks/dashboardQueryKeys'

const queryKeys: unknown[] = []

function Harness() {
  const { tipo, setTipo, periodo } = usePeriodoKpi()
  const location = useLocation()
  queryKeys.push(DASHBOARD_QUERY_KEYS.kpis(periodo))
  return (
    <>
      <PeriodoSelector value={tipo} onChange={setTipo} />
      <output data-testid="search">{location.search}</output>
      <output data-testid="periodo">{periodo}</output>
    </>
  )
}

function renderAt(url: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[url]}>
        <Harness />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

afterEach(() => {
  cleanup()
  queryKeys.length = 0
  vi.useRealTimers()
})

describe('periodoActual', () => {
  // 2026-11-06 12:00 UTC.
  const ahora = new Date(Date.UTC(2026, 10, 6, 12))

  it('builds the API period for month, quarter and year', () => {
    expect(periodoActual('mes', ahora).periodo).toBe('2026-11')
    expect(periodoActual('trimestre', ahora).periodo).toBe('2026-Q4')
    expect(periodoActual('anio', ahora).periodo).toBe('2026')
  })

  it('uses the Lima date, not UTC, at month end', () => {
    // 2026-12-01 03:00 UTC is still 2026-11-30 in Lima.
    expect(periodoActual('mes', new Date(Date.UTC(2026, 11, 1, 3))).periodo).toBe('2026-11')
  })

  it('returns the [desde, hasta) range of the quarter', () => {
    const { rango } = periodoActual('trimestre', ahora)
    expect(rango.desde.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(rango.hasta.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('PeriodoSelector', () => {
  it('defaults to month when the URL has no period', () => {
    renderAt('/dashboard')
    expect(screen.getByRole('button', { name: i18n.t('dashboard:layout.periodo.mes') })).toHaveAttribute('aria-pressed', 'true')
  })

  it('an unknown value falls back to month', () => {
    renderAt('/dashboard?periodo=semana')
    expect(screen.getByRole('button', { name: i18n.t('dashboard:layout.periodo.mes') })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reads the period from the URL (survives a reload)', () => {
    renderAt('/dashboard?periodo=anio')
    expect(screen.getByRole('button', { name: i18n.t('dashboard:layout.periodo.anio') })).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes ?periodo= and the KPIs query key, keeping other params', async () => {
    renderAt('/dashboard?tab=x')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('dashboard:layout.periodo.trimestre') }))
    expect(screen.getByTestId('search').textContent).toBe('?tab=x&periodo=trimestre')
    const periodo = screen.getByTestId('periodo').textContent
    expect(periodo).toMatch(/^\d{4}-Q[1-4]$/)
    expect(queryKeys.at(-1)).toEqual(['dashboard', 'kpis', periodo])
  })
})
