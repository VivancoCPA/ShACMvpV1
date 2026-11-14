import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { SupervisorDashboard } from './SupervisorDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'
import type { AccionRequerida } from '../types/accionesRequeridas.types'

afterEach(() => cleanup())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

let mockAcciones: AccionRequerida[] = []
vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: mockAcciones, isLoading: false }),
}))

function accion(tipo: AccionRequerida['tipo'], id: string): AccionRequerida {
  return { id, dominio: 'QE', tipo, codigo: id, descripcion: id, prioridad: 'normal', ruta: `/quality-events/${id}` }
}


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
            tipo: 'CORRECTIVA',
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
          {
            id: 'inc-301',
            numero: 'INC-2026-301',
            tipo: 'INCIDENTE',
            estado: 'ABIERTO',
            severidad: 'MEDIA',
            fechaEvento: new Date(Date.now() - 2 * 86_400_000).toISOString(),
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

    // dashboard-layout-4-zonas: alertas y trabajo; sin indicadores ni mapa.
    expect(screen.getByTestId('zona-alertas')).toBeInTheDocument()
    expect(screen.getByTestId('zona-trabajo')).toBeInTheDocument()
    expect(screen.queryByTestId('zona-indicadores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zona-mapa')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `1 ${i18n.t('dashboard:alertas.supervisor.acVencidas')}` })).toHaveAttribute('aria-pressed', 'false')
    // Solo el incidente de hace 2 días cae en los últimos 7.
    const recientes = screen.getByRole('link', { name: `1 ${i18n.t('dashboard:alertas.supervisor.incidentesRecientes')}` })
    expect(recientes.getAttribute('href')).toMatch(/^\/incidents\?fechaDesde=\d{4}-\d{2}-\d{2}$/)
    // AccionesRequeridas es el primer widget de la columna principal.
    const principal = screen.getByTestId('trabajo-principal')
    expect(principal.firstElementChild).toHaveAttribute('id', 'acciones-requeridas')
  })

  // dashboard-alertas-coherentes: el número de cada tarjeta = las filas de su lista tras el clic.
  it('"Esperan mi firma de cierre" filters the pending list to the same count', () => {
    mockIsLoading = false
    mockAcciones = [accion('QE_FIRMAR_CIERRE', 'qe-1'), accion('QE_FIRMAR_CIERRE', 'qe-2'), accion('QE_INICIAR_INVESTIGACION', 'qe-3')]
    renderDashboard()
    const titulo = i18n.t('dashboard:alertas.supervisor.firmaCierre')
    fireEvent.click(screen.getByRole('button', { name: `2 ${titulo}` }))
    expect(screen.getByRole('button', { name: `2 ${titulo}` })).toHaveAttribute('aria-pressed', 'true')
    expect(within(document.getElementById('acciones-requeridas')!).getAllByRole('button', { name: /^qe-/ })).toHaveLength(2)
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.mostrando', { etiqueta: titulo, n: 2 }))).toBeInTheDocument()
  })

  it('"AC vencidas de mi área" selects its list, which has the same rows', () => {
    mockIsLoading = false
    mockAcciones = []
    renderDashboard()
    const tarjeta = screen.getByRole('button', { name: `1 ${i18n.t('dashboard:alertas.supervisor.acVencidas')}` })
    fireEvent.click(tarjeta)
    expect(tarjeta).toHaveAttribute('aria-pressed', 'true')
    expect(within(document.getElementById('acs-vencidas')!).getAllByRole('button')).toHaveLength(1)
  })
})
