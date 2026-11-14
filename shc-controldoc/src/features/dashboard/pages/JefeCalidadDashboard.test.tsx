import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import type { KpiId, KpiResult } from '../types/kpi.types'
import type { AccionRequerida } from '../types/accionesRequeridas.types'

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

let mockAcciones: AccionRequerida[] = []
vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: mockAcciones, isLoading: false }),
}))

let mockKpis: KpiResult[] | undefined
const kpisSpy = vi.fn()
vi.mock('../hooks/useDashboardKpis', () => ({
  useDashboardKpis: (periodo?: string) => {
    kpisSpy(periodo)
    return { data: mockKpis, isLoading: !mockKpis }
  },
}))

const ALL_KPI_IDS: KpiId[] = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09']

function kpi(kpiId: KpiId, valor = 10): KpiResult {
  return { kpiId, valor, meta: 5, metaTipo: 'ABSOLUTO', semaforo: 'VERDE', periodo: '2026-11', calculadoEn: '2026-11-06T00:00:00Z' }
}

function accion(tipo: AccionRequerida['tipo'], id: string): AccionRequerida {
  return { id, dominio: 'QE', tipo, codigo: id, descripcion: id, prioridad: 'normal', ruta: `/quality-events/${id}` }
}

function LocationSpy() {
  return <output data-testid="location-search">{useLocation().search}</output>
}

const searchParams = () => new URLSearchParams(screen.getByTestId('location-search').textContent ?? '')

function renderDashboard(url = '/dashboard') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/dashboard" element={<JefeCalidadDashboard />} />
          </Routes>
          <LocationSpy />
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

function acResumen(id: string, dias: number) {
  return {
    id,
    origenTipo: 'QE' as const,
    origenId: 'qe-2026-201',
    descripcion: `AC ${id}`,
    responsableId: 'user-operario-001',
    responsableNombre: 'Luis Quispe',
    tipo: 'CORRECTIVA' as const,
    plazoFecha: new Date(Date.now() + dias * 86_400_000).toISOString(),
    estado: 'EN_EJECUCION',
  }
}

type JefeCalidadData = Extract<DashboardSummaryData, { rol: 'JEFE_CALIDAD' }>['data']

function summaryJefeCalidad(overrides: Partial<JefeCalidadData> = {}): DashboardSummaryData {
  return {
    rol: 'JEFE_CALIDAD',
    data: {
      kpis: [{ ...kpi('KPI-08', 5), semaforo: 'ROJO' }],
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
          tipo: 'CORRECTIVA' as const,
          plazoFecha: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          estado: 'EN_EJECUCION',
        },
      ],
      accionesCorrectivasVencidas: [acResumen('ac-vencida-1', -3), acResumen('ac-vencida-2', -1)],
      tendenciaMensualVolumen: [{ periodo: '2026-07', abiertos: 1, cerrados: 1 }],
      tendenciaMensualKpis: {
        'KPI-01': [80, 82, 85, 84, 86, 87, 88].map((valor, i) => ({ periodo: `2026-0${i + 1}`, valor })),
        'KPI-04': [{ periodo: '2026-07', valor: 2 }],
        'KPI-05': [{ periodo: '2026-07', valor: 90 }],
      },
      incidentesSinQeVencidos: [],
      incidentesSinQeVencidosTotal: 2,
      ...overrides,
    },
  }
}

describe('JefeCalidadDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    mockKpis = undefined
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('kpi-card-KPI-01')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.title'))).toBeInTheDocument()
  })

  it('renders the 4 zones with alerts, 6 rings, work and map once data resolves', async () => {
    mockIsLoading = false
    mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
    mockAcciones = [
      accion('QE_APROBAR_CAUSA_RAIZ', 'a'),
      accion('QE_APROBAR_CAUSA_RAIZ', 'b'),
      accion('QE_FIRMAR_CIERRE_JCA', 'c'),
      accion('QE_VERIFICAR', 'd'),
    ]
    mockData = summaryJefeCalidad()
    renderDashboard()

    for (const zona of ['alertas', 'indicadores', 'trabajo']) {
      expect(screen.getByTestId(`zona-${zona}`)).toBeInTheDocument()
    }

    // Alertas: AC vencidas = la lista accionesCorrectivasVencidas (no el KPI-08 del summary);
    // aprobaciones = aprobar causa raíz + firmar cierre JCA + registrar cierre (no verificar).
    expect(screen.getByRole('button', { name: `2 ${i18n.t('dashboard:alertas.jefeCalidad.acVencidas')}` })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: `2 ${i18n.t('dashboard:alertas.jefeCalidad.incidentesSinQe')}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `3 ${i18n.t('dashboard:alertas.jefeCalidad.aprobaciones')}` })).toBeInTheDocument()
    const criticos = screen.getByRole('link', { name: `0 ${i18n.t('dashboard:alertas.jefeCalidad.qeCriticos')}` })
    expect(criticos).toHaveAttribute('href', '/quality-events?severidad=CRITICA')
    expect(criticos).toHaveTextContent(i18n.t('dashboard:layout.todoEnOrden'))

    // Indicadores: 6 anillos en el orden de la maqueta; KPI-04/08/09 no son tarjeta.
    const ids = within(screen.getByTestId('zona-indicadores'))
      .getAllByTestId(/^kpi-card-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['KPI-01', 'KPI-02', 'KPI-03', 'KPI-05', 'KPI-07', 'KPI-06'].map((id) => `kpi-card-${id}`))
    expect(screen.getByTestId('kpi-card-KPI-01').querySelector('polyline')).not.toBeNull()
    expect(screen.getByTestId('kpi-card-KPI-06').querySelector('polyline')).toBeNull()

    // Trabajo y contexto.
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.qePorEstado.title'))).toBeInTheDocument()
    // Sin ?alerta=, la pestaña activa es "Vencidas" porque tiene ítems.
    expect(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.vencidas', { n: 2 }) })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.porVencer', { n: 1 }) })).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:jefeCalidad.tendencia.title'))).toBeInTheDocument()

    const mapa = await screen.findByTestId('zona-mapa')
    await waitFor(() => expect(within(mapa).getByText(i18n.t('dashboard:heatmapIncidentes.title'))).toBeInTheDocument())
  })

  it('queries the KPIs with the period from the URL', () => {
    mockIsLoading = false
    mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
    mockData = summaryJefeCalidad()
    kpisSpy.mockClear()
    renderDashboard('/dashboard?periodo=anio')
    expect(kpisSpy).toHaveBeenLastCalledWith(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date()),
    )
    expect(screen.getByRole('button', { name: i18n.t('dashboard:layout.periodo.anio') })).toHaveAttribute('aria-pressed', 'true')
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

  describe('alertas coherentes con su lista (dashboard-alertas-coherentes)', () => {
    const filasAcciones = () => within(document.getElementById('acciones-requeridas')!).queryAllByRole('button', { name: /^qe-/ })

    it('clicking "Aprobaciones y cierres pendientes" filters the list to exactly that many rows', () => {
      mockIsLoading = false
      mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
      mockAcciones = [
        accion('QE_APROBAR_CAUSA_RAIZ', 'qe-a'),
        accion('QE_FIRMAR_CIERRE_JCA', 'qe-b'),
        accion('QE_REGISTRAR_CIERRE', 'qe-c'),
        accion('QE_VERIFICAR', 'qe-d'),
        accion('QE_ASIGNAR_RESPONSABLE', 'qe-e'),
      ]
      mockData = summaryJefeCalidad()
      renderDashboard('/dashboard?periodo=mes')

      const titulo = i18n.t('dashboard:alertas.jefeCalidad.aprobaciones')
      const tarjeta = screen.getByRole('button', { name: `3 ${titulo}` })
      expect(filasAcciones()).toHaveLength(5)

      fireEvent.click(tarjeta)

      expect(searchParams().get('alerta')).toBe('aprobaciones')
      expect(searchParams().get('periodo')).toBe('mes')
      expect(screen.getByRole('button', { name: `3 ${titulo}` })).toHaveAttribute('aria-pressed', 'true')
      expect(filasAcciones().map((b) => b.textContent)).toEqual([
        expect.stringContaining('qe-a'),
        expect.stringContaining('qe-b'),
        expect.stringContaining('qe-c'),
      ])
      expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.mostrando', { etiqueta: titulo, n: 3 }))).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard:accionesRequeridas.quitarFiltro') }))
      expect(searchParams().has('alerta')).toBe(false)
      expect(filasAcciones()).toHaveLength(5)
    })

    // ac-ejecucion-verificacion-evidencias: las AC ejecutadas por verificar cuentan como aprobaciones.
    it('"Aprobaciones y cierres pendientes" counts AC_VERIFICAR and lists exactly those rows', () => {
      mockIsLoading = false
      mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
      mockAcciones = [
        accion('QE_APROBAR_CAUSA_RAIZ', 'qe-a'),
        accion('AC_VERIFICAR', 'qe-ac-1'),
        accion('AC_VERIFICAR', 'qe-ac-2'),
        accion('AC_EJECUTAR', 'qe-ac-3'),
      ]
      mockData = summaryJefeCalidad()
      renderDashboard('/dashboard?periodo=mes')

      const titulo = i18n.t('dashboard:alertas.jefeCalidad.aprobaciones')
      fireEvent.click(screen.getByRole('button', { name: `3 ${titulo}` }))

      expect(filasAcciones()).toHaveLength(3)
    })

    it('with ?alerta=aprobaciones it shows every matching item even beyond 10', () => {
      mockIsLoading = false
      mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
      mockAcciones = Array.from({ length: 13 }, (_, i) =>
        accion((['QE_APROBAR_CAUSA_RAIZ', 'QE_FIRMAR_CIERRE_JCA', 'QE_REGISTRAR_CIERRE'] as const)[i % 3], `qe-${i}`),
      )
      mockData = summaryJefeCalidad()
      renderDashboard('/dashboard?alerta=aprobaciones')

      expect(screen.getByRole('button', { name: `13 ${i18n.t('dashboard:alertas.jefeCalidad.aprobaciones')}` })).toHaveAttribute('aria-pressed', 'true')
      expect(filasAcciones()).toHaveLength(13)
    })

    it('"AC vencidas" opens the Vencidas tab with the same count as the card', () => {
      mockIsLoading = false
      mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
      mockAcciones = []
      mockData = summaryJefeCalidad()
      renderDashboard('/dashboard?alerta=acPorVencer')

      expect(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.porVencer', { n: 1 }) })).toHaveAttribute('aria-selected', 'true')
      fireEvent.click(screen.getByRole('button', { name: `2 ${i18n.t('dashboard:alertas.jefeCalidad.acVencidas')}` }))

      expect(searchParams().get('alerta')).toBe('acVencidas')
      expect(screen.getByRole('tab', { name: i18n.t('dashboard:acs.tabs.vencidas', { n: 2 }) })).toHaveAttribute('aria-selected', 'true')
      expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(2)
    })

    it('the Por vencer tab never repeats an overdue CA', () => {
      mockIsLoading = false
      mockKpis = ALL_KPI_IDS.map((id) => kpi(id))
      mockData = summaryJefeCalidad({
        accionesCorrectivasPorVencer: [acResumen('ya-vencida', -1), acResumen('por-vencer', 2)],
      })
      renderDashboard('/dashboard?alerta=acPorVencer')
      const panel = within(screen.getByRole('tabpanel'))
      expect(panel.getAllByRole('button')).toHaveLength(1)
      expect(panel.queryByText(/ya-vencida/)).not.toBeInTheDocument()
    })
  })
})
