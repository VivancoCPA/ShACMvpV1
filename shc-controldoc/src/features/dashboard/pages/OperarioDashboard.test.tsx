import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { OperarioDashboard } from './OperarioDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'

afterEach(() => cleanup())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

function NuevoReportePage() {
  const [searchParams] = useSearchParams()
  return <div data-testid="nuevo-reporte-page">{searchParams.get('origen')}</div>
}

function renderDashboard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<OperarioDashboard />} />
          <Route path="/quality-events/nuevo" element={<NuevoReportePage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('OperarioDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:operario.misQEs.title'))).not.toBeInTheDocument()
  })

  it('renders both widgets once useDashboardSummary resolves', () => {
    mockIsLoading = false
    mockData = {
      rol: 'OPERARIO',
      data: {
        misIncidentesReportados: [],
        misQEReportados: [
          {
            id: 'qe-2026-100',
            numero: 'QE-2026-100',
            estado: 'ABIERTO',
            severidad: 'MEDIA',
            tipo: 'CALIDAD',
            origen: 'O1_INCIDENTE_CAMPO',
            areaAfectada: 'Almacén Norte',
            fechaHoraReporte: '2026-06-01T00:00:00Z',
          },
        ],
        accionesCorrectivasAsignadas: [
          {
            id: 'ac-1',
            origenTipo: 'QE',
            origenId: 'qe-2026-100',
            descripcion: 'Acción de prueba',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: new Date(Date.now() + 5 * 86_400_000).toISOString(),
            estado: 'PENDIENTE',
          },
        ],
        documentosPendientesLectura: [],
      },
    }
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:operario.misQEs.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:operario.misACs.title'))).toBeInTheDocument()
    expect(screen.getByText('QE-2026-100')).toBeInTheDocument()
    expect(screen.getByText('Acción de prueba')).toBeInTheDocument()
  })

  it('"Crear nuevo reporte" navigates to /quality-events/nuevo?origen=O1_INCIDENTE_CAMPO', async () => {
    mockIsLoading = false
    mockData = {
      rol: 'OPERARIO',
      data: {
        misIncidentesReportados: [],
        misQEReportados: [],
        accionesCorrectivasAsignadas: [],
        documentosPendientesLectura: [],
      },
    }
    const user = userEvent.setup()
    renderDashboard()
    await user.click(screen.getByRole('button', { name: i18n.t('dashboard:operario.crearReporte') }))
    expect(screen.getByTestId('nuevo-reporte-page')).toHaveTextContent('O1_INCIDENTE_CAMPO')
  })
})
