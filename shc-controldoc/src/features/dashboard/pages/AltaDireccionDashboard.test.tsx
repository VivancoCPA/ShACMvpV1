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
import { AltaDireccionDashboard } from './AltaDireccionDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'

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
            <Route path="/dashboard" element={<AltaDireccionDashboard />} />
            <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('AltaDireccionDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:altaDireccion.kpisEjecutivos.title'))).not.toBeInTheDocument()
  })

  it('renders the 6 widgets, in order, once useDashboardSummary resolves', async () => {
    mockIsLoading = false
    mockData = {
      rol: 'ALTA_DIRECCION',
      data: {
        kpisEstrategicos: [
          { kpiId: 'KPI-01', valor: 92, meta: 90, metaTipo: 'ABSOLUTO', semaforo: 'VERDE', periodo: '2026-07', calculadoEn: '2026-07-08T00:00:00Z' },
          { kpiId: 'KPI-04', valor: 8, meta: 10, metaTipo: 'REDUCCION_INTERANUAL', semaforo: 'VERDE', periodo: '2026-07', calculadoEn: '2026-07-08T00:00:00Z' },
          { kpiId: 'KPI-05', valor: 88, meta: 85, metaTipo: 'ABSOLUTO', semaforo: 'VERDE', periodo: '2026-07', calculadoEn: '2026-07-08T00:00:00Z' },
        ],
        resumenPorModulo: {
          documentos: { total: 10, publicados: 8, vencidosRevision: 1 },
          noConformidades: { total: 5, abiertas: 2, cerradas: 3 },
          incidentes: { total: 4, conLesionados: 1 },
          qualityEvents: { total: 20, criticosAbiertos: 1, abiertos: 12, vencidos: 3 },
        },
        alertasCriticas: [
          {
            id: 'qe-2026-010',
            numero: 'QE-2026-010',
            estado: 'EN_INVESTIGACION',
            severidad: 'CRITICA',
            tipo: 'SST',
            origen: 'O1_INCIDENTE_CAMPO',
            areaId: 'area-002',
            fechaHoraReporte: '2026-07-01T00:00:00Z',
          },
        ],
        tendenciaTrimestral: [],
        comparativaMensual: {
          'KPI-01': { actual: 92, anterior: 90, tendencia: 'ESTABLE' },
          'KPI-04': { actual: 8, anterior: 10, tendencia: 'BAJA' },
          'KPI-05': { actual: 88, anterior: 80, tendencia: 'SUBE' },
        },
        reaperturas: [
          {
            id: 'qe-2026-005',
            numero: 'QE-2026-005',
            estado: 'REABIERTO',
            severidad: 'ALTA',
            tipo: 'SST',
            origen: 'O1_INCIDENTE_CAMPO',
            areaId: 'area-001',
            fechaHoraReporte: '2026-01-10T09:30:00Z',
            ciclo: 2,
            fechaReapertura: '2026-05-01T09:00:00Z',
          },
        ],
        acsConSolicitudAjustePlazo: [
          {
            qeId: 'qe-2026-005',
            qeNumero: 'QE-2026-005',
            qeSeveridad: 'ALTA',
            acId: 'ac-qe-005-2',
            acDescripcion: 'Auditoría sorpresa de uso de EPP',
            plazoFechaActual: '2026-03-15',
            solicitudesAjustePlazo: [
              {
                id: 'sol-ac-qe-005-2-1',
                fechaSolicitada: '2026-04-15',
                justificacion: 'Rotación de personal.',
                estado: 'PENDIENTE',
                solicitadoPorId: 'user-operario-001',
                solicitadoEn: '2026-03-05T09:00:00Z',
                requiereAprobacionGerencia: true,
              },
            ],
          },
        ],
      },
    }
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.kpisEjecutivos.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.comparativaMensual.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.qesCriticos.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.reaperturas.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:altaDireccion.acsExtensionPlazo.title'))).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText(i18n.t('dashboard:heatmapIncidentes.title'))).toBeInTheDocument(),
    )

    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((el) => el.textContent)
    expect(titles).toEqual([
      i18n.t('dashboard:accionesRequeridas.title'),
      i18n.t('dashboard:altaDireccion.kpisEjecutivos.title'),
      i18n.t('dashboard:altaDireccion.comparativaMensual.title'),
      i18n.t('dashboard:altaDireccion.qesCriticos.title'),
      i18n.t('dashboard:altaDireccion.reaperturas.title'),
      i18n.t('dashboard:altaDireccion.acsExtensionPlazo.title'),
      i18n.t('dashboard:heatmapIncidentes.title'),
    ])
  })

  it('does not render the incidents heatmap widget for a rol other than ALTA_DIRECCION', () => {
    mockIsLoading = false
    mockData = {
      rol: 'AUDITOR',
      data: {
        hallazgosPorNorma: [],
        hallazgosPorEstado: {
          ABIERTO: 0,
          EN_INVESTIGACION: 0,
          ANALISIS_COMPLETADO: 0,
          EN_EJECUCION: 0,
          PENDIENTE_CIERRE: 0,
          CERRADO: 0,
          EN_VERIFICACION: 0,
          VERIFICADO: 0,
          REABIERTO: 0,
        },
        evidenciasHallazgos: { conEvidencia: 0, sinEvidencia: 0 },
        tasaCierreEnPlazoPorArea: [],
      },
    }
    renderDashboard()
    expect(screen.queryByText(i18n.t('dashboard:heatmapIncidentes.title'))).not.toBeInTheDocument()
  })
})
