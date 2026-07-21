import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IncidentDetailPage } from './IncidentDetailPage'
import type { Incidente } from '../types/incident.types'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('../components/IncidentACSection', () => ({
  IncidentACSection: () => <div data-testid="incident-ac-section" />,
}))

vi.mock('../components/EscaladoBanner', () => ({
  EscaladoBanner: () => null,
}))

vi.mock('../hooks/useLocales', () => ({
  useLocales: () => ({ locales: [] }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: undefined }),
}))

let mockIncident: Incidente | undefined
let mockRole: UserRole | undefined = 'SUPERVISOR'
const navigateMock = vi.fn()

vi.mock('../hooks/useIncidents', () => ({
  useIncident: () => ({ data: mockIncident, isLoading: false, isError: false }),
  useDeleteIncident: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: mockRole ? { rol: mockRole } : null }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function makeIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-003',
    numero: 'INC-2026-003',
    tipo: 'INCIDENTE',
    estado: 'EN_INVESTIGACION',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba para el incidente',
    areaId: 'SyST',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-1',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/incidents/inc-003']}>
      <Routes>
        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('IncidentDetailPage — botón Crear QE', () => {
  it('is visible for SUPERVISOR on an active incident without a linked QE', () => {
    mockIncident = makeIncidente()
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.getByText('detail.actions.crearQE')).toBeInTheDocument()
  })

  it('is absent when the incident already has a linked QE', () => {
    mockIncident = makeIncidente({ qeId: 'qe-2026-005' })
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('is absent for OPERARIO', () => {
    mockIncident = makeIncidente()
    mockRole = 'OPERARIO'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('navigates with the correct vinculación query params on click', async () => {
    mockIncident = makeIncidente()
    mockRole = 'SUPERVISOR'
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('detail.actions.crearQE'))

    expect(navigateMock).toHaveBeenCalledWith(
      '/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST',
    )
  })
})
