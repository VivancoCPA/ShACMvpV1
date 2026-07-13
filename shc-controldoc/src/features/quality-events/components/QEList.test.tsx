import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QEList } from './QEList'
import { useAuthStore } from '../../../stores/authStore'
import type { QualityEvent } from '../types/qualityEvent.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
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
  QEEditSeveridadMineralModal: ({ qe }: { qe: QualityEvent }) => (
    <div data-testid="edit-modal">{qe.numero}</div>
  ),
}))

const baseQE: QualityEvent = {
  id: 'qe-2026-300',
  numero: 'QE-2026-300',
  origen: 'O2_NC_DETECTADA',
  tipo: 'CALIDAD',
  severidad: 'ALTA',
  estado: 'ABIERTO',
  ciclo: 1,
  descripcion: 'Descripción del evento de prueba para la lista',
  areaAfectada: 'Almacén Norte',
  turno: 'DIA',
  fechaHoraEvento: '2026-06-01T08:00:00Z',
  fechaHoraReporte: new Date().toISOString(),
  reportadoPorId: 'user-creator',
  documentosVinculados: [],
  requiereEvaluacionRiesgos: false,
  solicitudesAC: 0,
  accionesCorrectivas: [],
  auditTrail: [],
  creadoEn: '2026-06-01T08:00:00Z',
  actualizadoEn: '2026-06-01T08:00:00Z',
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/quality-events']}>
      <Routes>
        <Route path="/quality-events" element={<QEList />} />
        <Route path="/quality-events/:id/editar" element={<div data-testid="edit-page">edit-page</div>} />
        <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QEList — Acciones column edit icon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItems = [{ ...baseQE }]
  })

  afterEach(() => cleanup())

  it('OPERARIO who is not the creator never sees the Editar icon', () => {
    useAuthStore.setState({
      user: { id: 'user-other', nombre: 'Ajeno', apellido: 'Uno', email: 'a@shac.internal', rol: 'OPERARIO', area: 'Otra Área' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    expect(screen.queryByRole('button', { name: 'list.actions.editar' })).not.toBeInTheDocument()
  })

  it('omits the icon entirely (no disabled state) when no rule applies', () => {
    useAuthStore.setState({
      user: { id: 'user-other', nombre: 'Ajeno', apellido: 'Uno', email: 'a@shac.internal', rol: 'SUPERVISOR', area: 'Otra Área', areasAsignadas: ['Otra Área'] },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const { container } = renderList()
    expect(container.querySelector('button[disabled][title="list.actions.editar"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'list.actions.editar' })).not.toBeInTheDocument()
  })

  it('Supervisor whose areasAsignadas includes the QE area (not creator) sees Editar and navigates to the full form', async () => {
    useAuthStore.setState({
      user: { id: 'sup-1', nombre: 'Carmen', apellido: 'Torres', email: 's@shac.internal', rol: 'SUPERVISOR', area: 'Operaciones', areasAsignadas: ['Almacén Norte', 'Almacén Sur'] },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    await userEvent.click(screen.getByRole('button', { name: 'list.actions.editar' }))
    expect(await screen.findByTestId('edit-page')).toBeInTheDocument()
  })

  it('Supervisor whose own area matches but areasAsignadas does not include the QE area never sees the Editar icon', () => {
    useAuthStore.setState({
      user: { id: 'sup-2', nombre: 'Diego', apellido: 'Salazar', email: 's2@shac.internal', rol: 'SUPERVISOR', area: 'Almacén Norte', areasAsignadas: ['Galpón B', 'Galpón C'] },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    expect(screen.queryByRole('button', { name: 'list.actions.editar' })).not.toBeInTheDocument()
  })

  it('creator within the RN-QE-014 window sees Editar and it navigates to the full form', async () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    await userEvent.click(screen.getByRole('button', { name: 'list.actions.editar' }))
    expect(await screen.findByTestId('edit-page')).toBeInTheDocument()
  })

  it('JEFE_CALIDAD_SYST outside the RN-QE-014 window sees Editar and it opens the reduced modal', async () => {
    mockItems = [{ ...baseQE, fechaHoraReporte: '2020-01-01T00:00:00Z', reportadoPorId: 'user-other' }]
    useAuthStore.setState({
      user: { id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    await userEvent.click(screen.getByRole('button', { name: 'list.actions.editar' }))
    expect(await screen.findByTestId('edit-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-page')).not.toBeInTheDocument()
  })

  it('double-role user sees a single Editar icon routing to the full form, not the modal', async () => {
    mockItems = [{ ...baseQE, reportadoPorId: 'jc-1' }]
    useAuthStore.setState({
      user: { id: 'jc-1', nombre: 'Luis', apellido: 'Paredes', email: 'l@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderList()
    const editButtons = screen.getAllByRole('button', { name: 'list.actions.editar' })
    expect(editButtons).toHaveLength(1)

    await userEvent.click(editButtons[0])
    expect(await screen.findByTestId('edit-page')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })
})
