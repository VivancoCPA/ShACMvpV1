import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { SupervisorDashboard } from './SupervisorDashboard'
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

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: undefined }),
  useArea: () => ({ data: undefined }),
}))

function renderDashboard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<SupervisorDashboard />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('SupervisorDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:supervisor.panelPendientes.title'))).not.toBeInTheDocument()
  })

  it('renders the 4 widgets once useDashboardSummary resolves', () => {
    mockIsLoading = false
    mockData = {
      rol: 'SUPERVISOR',
      data: {
        kpisArea: [],
        qePorEstado: {} as never,
        qeAbiertosPorTipo: { CALIDAD: 2, SST: 0, ADUANERO: 0, OPERACIONAL: 1 },
        qesEnVerificacionArea: [
          {
            id: 'qe-2026-200',
            numero: 'QE-2026-200',
            estado: 'EN_VERIFICACION',
            severidad: 'MEDIA',
            tipo: 'CALIDAD',
            origen: 'O1_INCIDENTE_CAMPO',
            areaId: 'area-001',
            fechaHoraReporte: '2026-06-01T00:00:00Z',
            fechaVerificacionProgramada: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          },
        ],
        accionesCorrectivasPendientesArea: [],
        accionesCorrectivasVencidas: [
          {
            id: 'ac-vencida-1',
            origenTipo: 'QE',
            origenId: 'qe-2026-200',
            descripcion: 'AC vencida de prueba',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: new Date(Date.now() - 5 * 86_400_000).toISOString(),
            estado: 'EN_EJECUCION',
          },
        ],
        incidentesRecientes: [
          {
            id: 'inc-300',
            numero: 'INC-2026-300',
            tipo: 'ACCIDENTE',
            estado: 'ABIERTO',
            severidad: 'ALTA',
            fechaEvento: '2026-06-01T00:00:00Z',
            areaId: 'Almacén Norte',
          },
        ],
        semaforoPlazos: { verde: 0, amarillo: 0, rojo: 0 },
      },
    }
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:supervisor.panelPendientes.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.qePorTipo.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.acsVencidas.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:supervisor.incidentesRecientes.title'))).toBeInTheDocument()
    expect(screen.getByText('QE-2026-200')).toBeInTheDocument()
    expect(screen.getByText('AC vencida de prueba')).toBeInTheDocument()
    expect(screen.getByText('INC-2026-300')).toBeInTheDocument()
  })
})
