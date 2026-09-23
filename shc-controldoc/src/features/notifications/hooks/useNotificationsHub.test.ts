// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNotificationsHub } from './useNotificationsHub'
import type { NotificationToastHandle } from './useNotificationToast'

const startMock = vi.fn().mockResolvedValue(undefined)
const stopMock = vi.fn().mockResolvedValue(undefined)
const onMock = vi.fn()
const createConnectionMock = vi.fn(() => ({ on: onMock, start: startMock, stop: stopMock }))
vi.mock('../../../lib/notificationsHub', () => ({
  createNotificationsHubConnection: () => createConnectionMock(),
}))

let mockIsAuthenticated = true
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}))

function makeToastHandle(): NotificationToastHandle {
  return { markSeen: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAuthenticated = true
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useNotificationsHub', () => {
  it('does not attempt to connect when VITE_API_BASE_URL is unset (e.g. plain MSW dev, no real backend)', () => {
    // Regresión: sin este guard, HubConnectionBuilder.build() revienta de forma síncrona con una
    // URL vacía y tira abajo el árbol de React (visto en los tests de acceso por rol, que montan
    // NotificationBell -> useNotificationsHub con VITE_API_BASE_URL sin definir en el entorno de
    // test — el mismo valor que trae .env.development para desarrollo puro contra MSW).
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(() => renderHook(() => useNotificationsHub(makeToastHandle()))).not.toThrow()
    expect(createConnectionMock).not.toHaveBeenCalled()
  })

  it('does not attempt to connect when not authenticated, even with a real backend configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.shac.example')
    mockIsAuthenticated = false
    renderHook(() => useNotificationsHub(makeToastHandle()))
    expect(createConnectionMock).not.toHaveBeenCalled()
  })

  it('connects when authenticated with a real backend configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.shac.example')
    renderHook(() => useNotificationsHub(makeToastHandle()))
    expect(createConnectionMock).toHaveBeenCalledTimes(1)
    expect(onMock).toHaveBeenCalledWith('notificacionNueva', expect.any(Function))
    expect(startMock).toHaveBeenCalledTimes(1)
  })
})
