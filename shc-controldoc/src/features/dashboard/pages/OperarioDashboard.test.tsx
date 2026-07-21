import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import i18n from '../../../i18n'
import { OperarioDashboard } from './OperarioDashboard'
import type { DashboardSummaryData } from '../types/dashboardData.types'
import type { Notificacion } from '../../../types/notification.types'

afterEach(() => cleanup())

let mockData: DashboardSummaryData | undefined
let mockIsLoading = false
let mockNotifications: Notificacion[] = []
const markNotificationReadMutate = vi.fn()

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({ data: mockData, isLoading: mockIsLoading }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: undefined }),
  useArea: () => ({ data: undefined }),
}))

vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => ({ items: [], isLoading: false }),
}))

vi.mock('../../notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ data: mockNotifications }),
}))

vi.mock('../../notifications/hooks/useMarkNotificationRead', () => ({
  useMarkNotificationRead: () => ({ mutate: markNotificationReadMutate, isPending: false }),
}))

beforeEach(() => {
  mockNotifications = []
  markNotificationReadMutate.mockClear()
})

function NuevoReportePage() {
  const [searchParams] = useSearchParams()
  return <div data-testid="nuevo-reporte-page">{searchParams.get('origen')}</div>
}

function renderDashboard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<OperarioDashboard />} />
          <Route path="/quality-events/nuevo" element={<NuevoReportePage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('OperarioDashboard', () => {
  it('renders a loading skeleton while useDashboardSummary is loading', () => {
    mockData = undefined
    mockIsLoading = true
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(i18n.t('dashboard:operario.misQEs.title'))).not.toBeInTheDocument()
  })

  it('renders both widgets once useDashboardSummary resolves', () => {
    mockIsLoading = false
    mockData = {
      rol: 'OPERARIO',
      data: {
        misIncidentesReportados: [],
        misQEReportados: [
          {
            id: 'qe-2026-100',
            numero: 'QE-2026-100',
            estado: 'ABIERTO',
            severidad: 'MEDIA',
            tipo: 'CALIDAD',
            origen: 'O1_INCIDENTE_CAMPO',
            areaId: 'area-001',
            fechaHoraReporte: '2026-06-01T00:00:00Z',
          },
        ],
        accionesCorrectivasAsignadas: [
          {
            id: 'ac-1',
            origenTipo: 'QE',
            origenId: 'qe-2026-100',
            descripcion: 'Acción de prueba',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: new Date(Date.now() + 5 * 86_400_000).toISOString(),
            estado: 'PENDIENTE',
          },
        ],
        documentosPendientesLectura: [],
      },
    }
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:operario.misQEs.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:operario.misACs.title'))).toBeInTheDocument()
    expect(screen.getByText('QE-2026-100')).toBeInTheDocument()
    expect(screen.getByText('Acción de prueba')).toBeInTheDocument()
  })

  it('"Crear nuevo reporte" navigates to /quality-events/nuevo?origen=O1_INCIDENTE_CAMPO', async () => {
    mockIsLoading = false
    mockData = {
      rol: 'OPERARIO',
      data: {
        misIncidentesReportados: [],
        misQEReportados: [],
        accionesCorrectivasAsignadas: [],
        documentosPendientesLectura: [],
      },
    }
    const user = userEvent.setup()
    renderDashboard()
    await user.click(screen.getByRole('button', { name: i18n.t('dashboard:operario.crearReporte') }))
    expect(screen.getByTestId('nuevo-reporte-page')).toHaveTextContent('O1_INCIDENTE_CAMPO')
  })
})

describe('OperarioDashboard — Notificaciones pendientes', () => {
  beforeEach(() => {
    mockIsLoading = false
    mockData = {
      rol: 'OPERARIO',
      data: {
        misIncidentesReportados: [],
        misQEReportados: [],
        accionesCorrectivasAsignadas: [],
        documentosPendientesLectura: [],
      },
    }
  })

  it('renders the section listing the current user notifications via the shared NotificationList', () => {
    mockNotifications = [
      {
        id: 'notif-1',
        usuarioId: 'user-operario-001',
        tipo: 'CAMBIO_ESTADO',
        entidadTipo: 'QE',
        entidadId: 'qe-2026-001',
        entidadCodigo: 'QE-2026-001',
        mensaje: 'El QE-2026-001 cambió de estado.',
        leida: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        link: '/quality-events/qe-2026-001',
      },
    ]
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:operario.notificacionesPendientes.title'))).toBeInTheDocument()
    expect(screen.getByText('El QE-2026-001 cambió de estado.')).toBeInTheDocument()
  })

  it('marks a notification as read and navigates when clicked', async () => {
    mockNotifications = [
      {
        id: 'notif-1',
        usuarioId: 'user-operario-001',
        tipo: 'ASIGNACION',
        entidadTipo: 'DOCUMENTO',
        entidadId: 'doc-001',
        entidadCodigo: 'POL-CD-001',
        mensaje: 'Se te asignó como revisor.',
        leida: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        link: '/quality-events/nuevo',
      },
    ]
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByText('Se te asignó como revisor.'))

    expect(markNotificationReadMutate).toHaveBeenCalledWith('notif-1')
    expect(screen.getByTestId('nuevo-reporte-page')).toBeInTheDocument()
  })

  it('renders an empty state when there are no notifications', () => {
    mockNotifications = []
    renderDashboard()
    expect(screen.getByText(i18n.t('dashboard:operario.notificacionesPendientes.empty'))).toBeInTheDocument()
  })
})
