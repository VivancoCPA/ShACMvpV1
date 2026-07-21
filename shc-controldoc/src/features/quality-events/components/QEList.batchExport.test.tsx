import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QEList } from './QEList'
import { useAuthStore } from '../../../stores/authStore'
import type { QualityEvent } from '../types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(() => 'toast-id'), success: vi.fn(), error: vi.fn() },
}))

let mockItems: QualityEvent[] = []
vi.mock('../hooks/useQEList', () => ({
  useQEList: () => ({
    qualityEvents: mockItems,
    isLoading: false,
    isError: false,
    pagination: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('../hooks/useDeleteQualityEvent', () => ({
  useDeleteQualityEvent: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/useReactivateQualityEvent', () => ({
  useReactivateQualityEvent: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('./QEEditSeveridadMineralModal', () => ({
  QEEditSeveridadMineralModal: () => null,
}))
vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [] }),
}))
vi.mock('../export/exportQualityEventsBatch', () => ({
  exportQualityEventsBatch: vi.fn(),
  buildBatchExportFilename: vi.fn(() => 'quality-events-export-test.zip'),
}))
vi.mock('../../../utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

function makeQE(index: number, overrides: Partial<QualityEvent> = {}): QualityEvent {
  return {
    id: `qe-2026-${index}`,
    numero: `QE-2026-${String(index).padStart(3, '0')}`,
    origen: 'O2_NC_DETECTADA',
    tipo: 'CALIDAD',
    severidad: 'ALTA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: `Descripción ${index}`,
    areaId: 'Almacén Norte',
    turno: 'DIA',
    fechaHoraEvento: '2026-06-01T08:00:00Z',
    fechaHoraReporte: '2026-06-01T08:00:00Z',
    reportadoPorId: 'user-creator',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-06-01T08:00:00Z',
    actualizadoEn: '2026-06-01T08:00:00Z',
    ...overrides,
  }
}

function setUser(rol: 'JEFE_CALIDAD_SYST' | 'OPERARIO') {
  useAuthStore.setState({
    user: { id: 'user-1', nombre: 'Ana', apellido: 'Torres', email: 'a@shac.internal', rol },
    isAuthenticated: true,
    accessToken: 'token',
  })
}

function renderList(initialEntries: string[] = ['/quality-events']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/quality-events" element={<QEList />} />
        <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QEList — batch PDF export selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OPERARIO sees no selection checkboxes and no export toolbar', () => {
    mockItems = [makeQE(1)]
    setUser('OPERARIO')
    renderList()
    expect(screen.queryByRole('checkbox', { name: /seleccionarFila/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'list.batchExport.seleccionarTodosVisibles' })).not.toBeInTheDocument()
    expect(screen.queryByText(/list.batchExport.exportar/)).not.toBeInTheDocument()
  })

  it('selecting a row updates the toolbar count and enables the button', async () => {
    mockItems = [makeQE(1), makeQE(2)]
    setUser('JEFE_CALIDAD_SYST')
    renderList()

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /seleccionarFila/ })
    expect(rowCheckboxes).toHaveLength(2)

    await userEvent.click(rowCheckboxes[0])

    const exportButton = screen.getByText(/list.batchExport.exportarConteo/).closest('button')
    expect(exportButton).not.toBeDisabled()
    expect(exportButton?.textContent).toContain('"count":1')
  })

  it('renders no export link at all when nothing is selected', () => {
    mockItems = [makeQE(1)]
    setUser('JEFE_CALIDAD_SYST')
    renderList()
    expect(screen.queryByText(/list.batchExport.exportarConteo/)).not.toBeInTheDocument()
  })

  it('selecting more than 50 disables the button and shows the limit message', async () => {
    mockItems = Array.from({ length: 51 }, (_, i) => makeQE(i + 1))
    setUser('JEFE_CALIDAD_SYST')
    renderList()

    const selectAll = screen.getByRole('checkbox', { name: 'list.batchExport.seleccionarTodosVisibles' })
    await userEvent.click(selectAll)

    const exportButton = screen.getByText(/list.batchExport.exportarConteo/).closest('button')
    expect(exportButton).toBeDisabled()
    expect(screen.getByText(/list.batchExport.limiteExcedido/)).toBeInTheDocument()
  })

  it('selecting exactly 50 keeps the button enabled', async () => {
    mockItems = Array.from({ length: 50 }, (_, i) => makeQE(i + 1))
    setUser('JEFE_CALIDAD_SYST')
    renderList()

    const selectAll = screen.getByRole('checkbox', { name: 'list.batchExport.seleccionarTodosVisibles' })
    await userEvent.click(selectAll)

    const exportButton = screen.getByText(/list.batchExport.exportarConteo/).closest('button')
    expect(exportButton).not.toBeDisabled()
    expect(screen.queryByText(/list.batchExport.limiteExcedido/)).not.toBeInTheDocument()
  })

  it('clears the selection when a filter is removed (search params change)', async () => {
    mockItems = [makeQE(1)]
    setUser('JEFE_CALIDAD_SYST')
    renderList(['/quality-events?severidad=ALTA'])

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /seleccionarFila/ })
    await userEvent.click(rowCheckboxes[0])
    expect(screen.getByText(/list.batchExport.exportarConteo/).closest('button')?.textContent).toContain('"count":1')

    const clearFilterButton = screen.getByRole('button', { name: 'list.filters.limpiar' })
    await userEvent.click(clearFilterButton)

    expect(screen.queryByText(/list.batchExport.exportarConteo/)).not.toBeInTheDocument()
  })
})
