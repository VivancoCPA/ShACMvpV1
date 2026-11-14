import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { AuditorDashboard } from './AuditorDashboard'
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
    expect(screen.queryByText(i18n.t('dashboard:auditor.hallazgosPorNorma.title'))).not.toBeInTheDocument()
  })

  it('renders a loading skeleton when data.rol is not AUDITOR', () => {
    mockIsLoading = false
    mockData = { rol: 'OPERARIO', data: { misIncidentesReportados: [], misQEReportados: [], accionesCorrectivasAsignadas: [], documentosPendientesLectura: [] } }
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:auditor.hallazgosPorNorma.title'))).not.toBeInTheDocument()
  })

  it('renders the 4 widgets in their zones, in order, once useDashboardSummary resolves with rol AUDITOR', () => {
    mockIsLoading = false
    mockData = {
      rol: 'AUDITOR',
      data: {
        hallazgosPorNorma: [{ norma: 'ISO_9001_2015', total: 2 }],
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
        tasaCierreEnPlazoPorArea: [{ areaId: 'Zona de Pesaje', tasaCierreEnPlazo: 50, totalCerrados: 2 }],
      },
    }
    renderDashboard()
    const titles = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent)
    expect(titles).toEqual([
      i18n.t('dashboard:layout.zonas.alertas'),
      i18n.t('dashboard:layout.zonas.trabajo'),
      i18n.t('dashboard:accionesRequeridas.title'),
      i18n.t('dashboard:auditor.hallazgosPorEstado.title'),
      i18n.t('dashboard:auditor.hallazgosPorNorma.title'),
      i18n.t('dashboard:auditor.evidenciasHallazgos.title'),
      i18n.t('dashboard:auditor.tasaCierrePorArea.title'),
    ])
    expect(screen.queryByTestId('zona-indicadores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zona-mapa')).not.toBeInTheDocument()
    // Abiertos = todo salvo CERRADO y VERIFICADO: 1 + 1 + 1 + 1 (REABIERTO).
    expect(screen.getByRole('link', { name: `4 ${i18n.t('dashboard:alertas.auditor.hallazgosAbiertos')}` })).toHaveAttribute(
      'href',
      '/quality-events?origen=O3_HALLAZGO_AUDITORIA',
    )
    expect(screen.getByRole('button', { name: `0 ${i18n.t('dashboard:alertas.auditor.verificaciones')}` })).toHaveAttribute('aria-pressed', 'false')
  })

  it('"Verificaciones asignadas pendientes" filters the pending list to the same count', () => {
    mockIsLoading = false
    mockAcciones = [accion('QE_VERIFICAR', 'qe-1'), accion('QE_VERIFICAR', 'qe-2'), accion('AC_EJECUTAR', 'qe-ac')]
    renderDashboard()
    const titulo = i18n.t('dashboard:alertas.auditor.verificaciones')
    fireEvent.click(screen.getByRole('button', { name: `2 ${titulo}` }))
    const filas = within(document.getElementById('acciones-requeridas')!).getAllByRole('button', { name: /^qe-/ })
    expect(filas).toHaveLength(2)
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.mostrando', { etiqueta: titulo, n: 2 }))).toBeInTheDocument()
  })
})
