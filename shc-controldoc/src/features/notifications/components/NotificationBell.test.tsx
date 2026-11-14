import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'
import { NotificationBell } from './NotificationBell'
import type { Notificacion } from '../../../types/notification.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: 'es-PE' },
  }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

let mockNotifications: Notificacion[] = []
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: mockNotifications }),
}))

const markReadMutate = vi.fn()
vi.mock('../hooks/useMarkNotificationRead', () => ({
  useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
}))

const markAllReadMutate = vi.fn()
vi.mock('../hooks/useMarkAllNotificationsRead', () => ({
  useMarkAllNotificationsRead: () => ({ mutate: markAllReadMutate, isPending: false }),
}))

function makeNotificacion(overrides: Partial<Notificacion> = {}): Notificacion {
  return {
    id: 'notif-1',
    usuarioId: 'user-operario-001',
    empresaId: 'empresa-001',
    tipo: 'CAMBIO_ESTADO',
    entidadTipo: 'QE',
    entidadId: 'qe-2026-001',
    entidadCodigo: 'QE-2026-001',
    mensaje: 'El QE-2026-001 cambió de estado.',
    leida: false,
    createdAt: new Date().toISOString(),
    link: '/quality-events/qe-2026-001',
    ...overrides,
  }
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <NotificationBell />
      <Link to="/otra-ruta">otra ruta</Link>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications = []
})

describe('NotificationBell — badge', () => {
  it('hides the badge when there are no unread notifications', () => {
    mockNotifications = [makeNotificacion({ leida: true })]
    renderBell()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('shows the unread count', () => {
    mockNotifications = [
      makeNotificacion({ id: 'n1', leida: false }),
      makeNotificacion({ id: 'n2', leida: false }),
      makeNotificacion({ id: 'n3', leida: true }),
    ]
    renderBell()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('NotificationBell — dropdown', () => {
  it('opens the dropdown on click and lists notifications', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()

    expect(screen.queryByText('title')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('El QE-2026-001 cambió de estado.')).toBeInTheDocument()
  })

  it('closes the dropdown on a second click', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()

    const bellButton = screen.getByLabelText('bell.ariaLabel')
    fireEvent.click(bellButton)
    expect(screen.getByText('title')).toBeInTheDocument()
    fireEvent.click(bellButton)
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })
})

describe('NotificationBell — interactions', () => {
  it('marks as read and navigates when a notification is clicked', () => {
    mockNotifications = [makeNotificacion({ id: 'n1', link: '/quality-events/qe-2026-0042' })]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    fireEvent.click(screen.getByText('El QE-2026-001 cambió de estado.'))

    expect(markReadMutate).toHaveBeenCalledWith('n1')
    expect(navigateMock).toHaveBeenCalledWith('/quality-events/qe-2026-0042')
  })

  it('calls mark-all-as-read when the button is clicked', () => {
    mockNotifications = [makeNotificacion({ leida: false })]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    fireEvent.click(screen.getByText('markAllRead'))

    expect(markAllReadMutate).toHaveBeenCalled()
  })

  it('does not hide the mark-all-read control when there are zero unread notifications', () => {
    mockNotifications = [makeNotificacion({ leida: true })]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))

    const button = screen.getByText('markAllRead').closest('button')
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })
})

describe('NotificationBell — cierre del panel (pendientes-qe-asignacion-y-menus)', () => {
  it('se cierra al hacer clic en el body', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    expect(screen.getByText('title')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })

  it('no se cierra al hacer clic dentro del panel', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))

    fireEvent.mouseDown(screen.getByText('title'))
    expect(screen.getByText('title')).toBeInTheDocument()
  })

  it('se cierra con Escape y devuelve el foco a la campana', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()
    const bell = screen.getByLabelText('bell.ariaLabel')
    fireEvent.click(bell)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('title')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('se cierra al hacer clic en una notificación', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    fireEvent.click(screen.getByText('El QE-2026-001 cambió de estado.'))

    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })

  it('se cierra al cambiar de ruta', () => {
    mockNotifications = [makeNotificacion()]
    renderBell()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))

    fireEvent.click(screen.getByText('otra ruta'))
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })

  it('expone aria-expanded, aria-haspopup y aria-controls', () => {
    renderBell()
    const bell = screen.getByLabelText('bell.ariaLabel')
    expect(bell).toHaveAttribute('aria-haspopup', 'dialog')
    expect(bell).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(bell)
    expect(bell).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog')).toHaveAttribute('id', bell.getAttribute('aria-controls'))
  })
})
