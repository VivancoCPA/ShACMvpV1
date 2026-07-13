import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { useAuthStore } from '../../../stores/authStore'
import { ExportButton } from './ExportButton'
import type { DashboardSummaryData } from '../types/dashboardData.types'

let mockData: DashboardSummaryData | undefined

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: false }),
}))
vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: [], isLoading: false }),
}))
vi.mock('../../incidents/hooks/useLocales', () => ({
  useLocales: () => ({ locales: [], isLoading: false, isError: false }),
}))
vi.mock('../../incidents/hooks/useIncidentList', () => ({
  useIncidentList: () => ({ incidentes: [], isLoading: false, isError: false, pagination: null, refetch: vi.fn() }),
}))

const exportToExcelMock = vi.fn()
const exportToPdfMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../export/exportToExcel', () => ({ exportToExcel: (...args: unknown[]) => exportToExcelMock(...args) }))
vi.mock('../export/exportToPdf', () => ({ exportToPdf: (...args: unknown[]) => exportToPdfMock(...args) }))

afterEach(() => {
  cleanup()
  exportToExcelMock.mockClear()
  exportToPdfMock.mockClear()
  useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null })
})

const JEFE_CALIDAD_DATA: DashboardSummaryData = {
  rol: 'JEFE_CALIDAD',
  data: {
    kpis: [],
    qeCriticosAbiertos: [],
    ncPendientesVerificacion: [],
    distribucionQEPorTipo: { CALIDAD: 0, SST: 0, ADUANERO: 0, OPERACIONAL: 0 },
    qePorEstado: {
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
    accionesCorrectivasPorVencer: [],
    tendenciaMensualVolumen: [],
    tendenciaMensualKpis: { 'KPI-01': [], 'KPI-04': [], 'KPI-05': [] },
  },
}

function renderButton() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ExportButton />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('ExportButton', () => {
  it('es visible para JEFE_CALIDAD_SYST', () => {
    useAuthStore.setState({
      user: { id: 'u1', nombre: 'Luis', apellido: 'Paredes', email: 'luis@shac.internal', rol: 'JEFE_CALIDAD_SYST' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    mockData = JEFE_CALIDAD_DATA
    renderButton()
    expect(screen.getByText(i18n.t('dashboard:export.button'))).toBeInTheDocument()
  })

  it('no es visible para otros roles (OPERARIO, SUPERVISOR, AUDITOR_INTERNO, JEFE_CONTROL_DOCUMENTARIO)', () => {
    for (const rol of ['OPERARIO', 'SUPERVISOR', 'AUDITOR_INTERNO', 'JEFE_CONTROL_DOCUMENTARIO'] as const) {
      useAuthStore.setState({
        user: { id: 'u1', nombre: 'A', apellido: 'B', email: 'a@shac.internal', rol },
        isAuthenticated: true,
        accessToken: 'token',
      })
      mockData = JEFE_CALIDAD_DATA
      const { container } = renderButton()
      expect(screen.queryByText(i18n.t('dashboard:export.button'))).not.toBeInTheDocument()
      cleanup()
      void container
    }
  })

  it('abre el selector de formato y no genera ningún archivo si se cierra sin confirmar', async () => {
    useAuthStore.setState({
      user: { id: 'u1', nombre: 'Luis', apellido: 'Paredes', email: 'luis@shac.internal', rol: 'JEFE_CALIDAD_SYST' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    mockData = JEFE_CALIDAD_DATA
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByText(i18n.t('dashboard:export.button')))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByText(i18n.t('dashboard:export.modal.cancel')))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(exportToExcelMock).not.toHaveBeenCalled()
    expect(exportToPdfMock).not.toHaveBeenCalled()
  })

  it('genera un Excel al confirmar el formato Excel', async () => {
    useAuthStore.setState({
      user: { id: 'u1', nombre: 'Luis', apellido: 'Paredes', email: 'luis@shac.internal', rol: 'JEFE_CALIDAD_SYST' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    mockData = JEFE_CALIDAD_DATA
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByText(i18n.t('dashboard:export.button')))
    await user.click(screen.getByText(i18n.t('dashboard:export.modal.excel')))

    expect(exportToExcelMock).toHaveBeenCalledTimes(1)
    expect(exportToPdfMock).not.toHaveBeenCalled()
  })
})
