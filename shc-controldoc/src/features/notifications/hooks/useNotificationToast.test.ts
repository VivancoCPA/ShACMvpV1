// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNotificationToast } from './useNotificationToast'
import type { Notificacion } from '../../../types/notification.types'

const toastMock = vi.fn()
vi.mock('sonner', () => ({ toast: (...args: unknown[]) => toastMock(...args) }))

let mockNotifications: Notificacion[] = []
vi.mock('./useNotifications', () => ({
  useNotifications: () => ({ data: mockNotifications }),
}))

let mockUser: { id: string } | null = { id: 'user-operario-001' }
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) => selector({ user: mockUser }),
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
    createdAt: '2026-01-01T00:00:00.000Z',
    link: '/quality-events/qe-2026-001',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications = []
  mockUser = { id: 'user-operario-001' }
})

describe('useNotificationToast', () => {
  it('does not toast for notifications already present on the first render', () => {
    mockNotifications = [makeNotificacion()]
    renderHook(() => useNotificationToast())
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('fires a toast when a new notification appears for the current user', () => {
    mockNotifications = [makeNotificacion({ id: 'n1', createdAt: '2026-01-01T00:00:00.000Z' })]
    const { rerender } = renderHook(() => useNotificationToast())
    expect(toastMock).not.toHaveBeenCalled()

    mockNotifications = [
      ...mockNotifications,
      makeNotificacion({ id: 'n2', createdAt: '2026-01-01T00:05:00.000Z', mensaje: 'Nueva notificación.' }),
    ]
    rerender()

    expect(toastMock).toHaveBeenCalledWith('Nueva notificación.')
  })

  it('does not toast for a notification belonging to a different user', () => {
    mockNotifications = [makeNotificacion({ id: 'n1', createdAt: '2026-01-01T00:00:00.000Z' })]
    const { rerender } = renderHook(() => useNotificationToast())

    mockNotifications = [
      ...mockNotifications,
      makeNotificacion({
        id: 'n2',
        usuarioId: 'user-other-999',
        createdAt: '2026-01-01T00:05:00.000Z',
        mensaje: 'Notificación de otro usuario.',
      }),
    ]
    rerender()

    expect(toastMock).not.toHaveBeenCalled()
  })
})
