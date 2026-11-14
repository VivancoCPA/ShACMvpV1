import { render, screen, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach } from 'vitest'
import i18n from '../../../../i18n'
import { DashboardLayout } from './DashboardLayout'

function renderLayout(props: Parameters<typeof DashboardLayout>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DashboardLayout {...props} />
    </I18nextProvider>,
  )
}

afterEach(() => cleanup())

describe('DashboardLayout', () => {
  it('does not render empty zones', () => {
    renderLayout({ alertas: <div>a</div>, trabajoPrincipal: <div>p</div>, indicadores: null, mapa: false })
    expect(screen.getByTestId('zona-alertas')).toBeInTheDocument()
    expect(screen.getByTestId('zona-trabajo')).toBeInTheDocument()
    expect(screen.queryByTestId('zona-indicadores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zona-mapa')).not.toBeInTheDocument()
  })

  it('the main column takes the full width when there is no side column', () => {
    renderLayout({ trabajoPrincipal: <div>p</div> })
    expect(screen.getByTestId('trabajo-principal')).toHaveClass('lg:col-span-3')
    expect(screen.queryByTestId('trabajo-lateral')).not.toBeInTheDocument()
  })

  it('splits 2/3 + 1/3 when both work columns are present', () => {
    renderLayout({ trabajoPrincipal: <div>p</div>, trabajoLateral: <div>l</div> })
    expect(screen.getByTestId('trabajo-principal')).toHaveClass('lg:col-span-2')
    expect(screen.getByTestId('trabajo-lateral')).toHaveClass('lg:col-span-1')
  })

  it('renders the zone labels in a fixed order, with the period selector next to Indicadores', () => {
    renderLayout({
      mapa: <div>m</div>,
      trabajoLateral: <div>l</div>,
      indicadores: <div>i</div>,
      periodoSelector: <button type="button">sel</button>,
      alertas: <div>a</div>,
    })
    const labels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(labels).toEqual([
      i18n.t('dashboard:layout.zonas.alertas'),
      i18n.t('dashboard:layout.zonas.indicadores'),
      i18n.t('dashboard:layout.zonas.trabajo'),
      i18n.t('dashboard:layout.zonas.mapa'),
    ])
    expect(screen.getByTestId('zona-indicadores')).toContainElement(screen.getByRole('button', { name: 'sel' }))
    expect(screen.getByTestId('zona-alertas')).not.toHaveClass('mt-6')
    expect(screen.getByTestId('zona-mapa')).toHaveClass('mt-6')
  })

  it('labels each zone section with its heading', () => {
    renderLayout({ alertas: <div>a</div> })
    expect(screen.getByRole('region', { name: i18n.t('dashboard:layout.zonas.alertas') })).toBeInTheDocument()
  })
})
