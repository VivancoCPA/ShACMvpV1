import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { setupServer } from 'msw/node'
import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from 'vitest'
import i18n from '../../../i18n'
import { localesHandlers } from '../../../mocks/handlers/locales.handlers'
import { incidentHandlers } from '../../../mocks/handlers/incidents.handlers'
import { areaHandlers } from '../../../mocks/handlers/areas.handlers'
import { JefeCalidadDashboard } from './JefeCalidadDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'

const server = setupServer(...localesHandlers, ...incidentHandlers, ...areaHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: [], isLoading: false }),
}))

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<JefeCalidadDashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

const EMPTY_QE_POR_ESTADO: Record<QEStatus, number> = {
  ABIERTO: 0,
  EN_INVESTIGACION: 0,
  ANALISIS_COMPLETADO: 0,
  EN_EJECUCION: 0,
  PENDIENTE_CIERRE: 0,
  CERRADO: 0,
  EN_VERIFICACION: 0,
  VERIFICADO: 0,
  REABIERTO: 0,
}

describe('JefeCalidadDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:jefeCalidad.kpis.title'))).not.toBeInTheDocument()
  })

  it('renders the 4 widgets once useDashboardSummary resolves', async () => {
    mockIsLoading = false
    mockData = {
      rol: 'JEFE_CALIDAD',
      data: {
        kpis: [],
        qeCriticosAbiertos: [],
        ncPendientesVerificacion: [],
        distribucionQEPorTipo: { CALIDAD: 0, SST: 0, ADUANERO: 0, OPERACIONAL: 0 },
        qePorEstado: { ...EMPTY_QE_POR_ESTADO, ABIERTO: 3 },
        accionesCorrectivasPorVencer: [
          {
            id: 'ac-por-vencer-1',
            origenTipo: 'QE',
            origenId: 'qe-2026-200',
            descripcion: 'AC por vencer de prueba',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: new Date(Date.now() + 2 * 86_400_000).toISOString(),
            estado: 'EN_EJECUCION',
          },
        ],
        tendenciaMensualVolumen: [{ periodo: '2026-07', abiertos: 1, cerrados: 1 }],
        tendenciaMensualKpis: {
          'KPI-01': [{ periodo: '2026-07', valor: 80 }],
          'KPI-04': [{ periodo: '2026-07', valor: 2 }],
          'KPI-05': [{ periodo: '2026-07', valor: 90 }],
        },
      },
    }
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.kpis.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.qePorEstado.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.acsPorVencer.title'))).toBeInTheDocument()
    expect(screen.getByText('AC por vencer de prueba')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.tendencia.title'))).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText(i18n.t('dashboard:heatmapIncidentes.title'))).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('group', { name: i18n.t('dashboard:heatmapIncidentes.rango.label') }),
    ).toBeInTheDocument()
  })

  it('does not render the incidents heatmap widget for a rol other than JEFE_CALIDAD', () => {
    mockIsLoading = false
    mockData = {
      rol: 'SUPERVISOR',
      data: {
        kpisArea: [],
        qePorEstado: EMPTY_QE_POR_ESTADO,
        qeAbiertosPorTipo: { CALIDAD: 0, SST: 0, ADUANERO: 0, OPERACIONAL: 0 },
        qesEnVerificacionArea: [],
        accionesCorrectivasPendientesArea: [],
        accionesCorrectivasVencidas: [],
        incidentesRecientes: [],
        semaforoPlazos: { verde: 0, amarillo: 0, rojo: 0 },
      },
    }
    renderDashboard()
    expect(screen.queryByText(i18n.t('dashboard:heatmapIncidentes.title'))).not.toBeInTheDocument()
  })
})
