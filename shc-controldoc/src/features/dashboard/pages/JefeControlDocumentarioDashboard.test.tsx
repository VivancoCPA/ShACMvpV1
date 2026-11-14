import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { JefeControlDocumentarioDashboard } from './JefeControlDocumentarioDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'

afterEach(() => cleanup())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: [], isLoading: false }),
}))

function renderDashboard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<JefeControlDocumentarioDashboard />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('JefeControlDocumentarioDashboard', () => {
  it('renders the page title and the Acciones Requeridas widget regardless of loading state', () => {
    mockData = undefined
    mockIsLoading = true
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:jefeControlDoc.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.title'))).toBeInTheDocument()
  })

  it('shows a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows no skeleton once useDashboardSummary resolves with rol JEFE_CONTROL_DOC', () => {
    mockIsLoading = false
    mockData = { rol: 'JEFE_CONTROL_DOC', data: { documentosRevisionVencida: 2, documentosRevisionProxima: 0 } }
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0)
  })

  it('renders the revision alerts and AccionesRequeridas full width, without KPIs', () => {
    mockIsLoading = false
    mockData = { rol: 'JEFE_CONTROL_DOC', data: { documentosRevisionVencida: 2, documentosRevisionProxima: 0 } }
    renderDashboard()
    const vencida = screen.getByRole('link', { name: `2 ${i18n.t('dashboard:alertas.jefeControlDoc.revisionVencida')}` })
    expect(vencida).toHaveAttribute('href', '/documentos?estado=PUBLICADO')
    const proxima = screen.getByRole('link', { name: `0 ${i18n.t('dashboard:alertas.jefeControlDoc.revisionProxima')}` })
    expect(proxima).toHaveTextContent(i18n.t('dashboard:layout.todoEnOrden'))
    expect(screen.getByTestId('trabajo-principal')).toHaveClass('lg:col-span-3')
    expect(screen.queryByTestId('trabajo-lateral')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zona-indicadores')).not.toBeInTheDocument()
  })
})
