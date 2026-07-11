import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { AuditorDashboard } from './AuditorDashboard'
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
          <Route path="/dashboard" element={<AuditorDashboard />} />
          <Route path="/quality-events" element={<div data-testid="qe-list">qe-list</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('AuditorDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:auditor.hallazgosPorArea.title'))).not.toBeInTheDocument()
  })

  it('renders a loading skeleton when data.rol is not AUDITOR', () => {
    mockIsLoading = false
    mockData = { rol: 'OPERARIO', data: { misIncidentesReportados: [], misQEReportados: [], accionesCorrectivasAsignadas: [], documentosPendientesLectura: [] } }
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:auditor.hallazgosPorArea.title'))).not.toBeInTheDocument()
  })

  it('renders the 4 widgets, in order, once useDashboardSummary resolves with rol AUDITOR', () => {
    mockIsLoading = false
    mockData = {
      rol: 'AUDITOR',
      data: {
        hallazgosPorArea: [{ area: 'Zona de Pesaje', total: 2 }],
        hallazgosPorEstado: {
          ABIERTO: 0,
          EN_INVESTIGACION: 1,
          ANALISIS_COMPLETADO: 1,
          EN_EJECUCION: 0,
          PENDIENTE_CIERRE: 1,
          CERRADO: 1,
          EN_VERIFICACION: 0,
          VERIFICADO: 0,
          REABIERTO: 1,
        },
        evidenciasHallazgos: { conEvidencia: 2, sinEvidencia: 3 },
        tasaCierreEnPlazoPorArea: [{ area: 'Zona de Pesaje', tasaCierreEnPlazo: 50, totalCerrados: 2 }],
      },
    }
    renderDashboard()
    const titles = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent)
    expect(titles).toEqual([
      i18n.t('dashboard:accionesRequeridas.title'),
      i18n.t('dashboard:auditor.hallazgosPorArea.title'),
      i18n.t('dashboard:auditor.hallazgosPorEstado.title'),
      i18n.t('dashboard:auditor.evidenciasHallazgos.title'),
      i18n.t('dashboard:auditor.tasaCierrePorArea.title'),
    ])
  })
})
