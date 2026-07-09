import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { JefeCalidadDashboard } from './JefeCalidadDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'

afterEach(() => cleanup())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

function renderDashboard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<JefeCalidadDashboard />} />
        </Routes>
      </MemoryRouter>
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

  it('renders the 3 widgets once useDashboardSummary resolves', () => {
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
  })
})
