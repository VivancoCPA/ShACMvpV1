import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications = []
})

describe('NotificationBell — badge', () => {
  it('hides the badge when there are no unread notifications', () => {
    mockNotifications = [makeNotificacion({ leida: true })]
    render(<NotificationBell />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('shows the unread count', () => {
    mockNotifications = [
      makeNotificacion({ id: 'n1', leida: false }),
      makeNotificacion({ id: 'n2', leida: false }),
      makeNotificacion({ id: 'n3', leida: true }),
    ]
    render(<NotificationBell />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('NotificationBell — dropdown', () => {
  it('opens the dropdown on click and lists notifications', () => {
    mockNotifications = [makeNotificacion()]
    render(<NotificationBell />)

    expect(screen.queryByText('title')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('El QE-2026-001 cambió de estado.')).toBeInTheDocument()
  })

  it('closes the dropdown on a second click', () => {
    mockNotifications = [makeNotificacion()]
    render(<NotificationBell />)

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
    render(<NotificationBell />)
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    fireEvent.click(screen.getByText('El QE-2026-001 cambió de estado.'))

    expect(markReadMutate).toHaveBeenCalledWith('n1')
    expect(navigateMock).toHaveBeenCalledWith('/quality-events/qe-2026-0042')
  })

  it('calls mark-all-as-read when the button is clicked', () => {
    mockNotifications = [makeNotificacion({ leida: false })]
    render(<NotificationBell />)
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))
    fireEvent.click(screen.getByText('markAllRead'))

    expect(markAllReadMutate).toHaveBeenCalled()
  })

  it('does not hide the mark-all-read control when there are zero unread notifications', () => {
    mockNotifications = [makeNotificacion({ leida: true })]
    render(<NotificationBell />)
    fireEvent.click(screen.getByLabelText('bell.ariaLabel'))

    const button = screen.getByText('markAllRead').closest('button')
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })
})
