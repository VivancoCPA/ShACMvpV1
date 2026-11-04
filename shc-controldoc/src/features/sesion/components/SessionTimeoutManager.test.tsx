// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { SessionTimeoutManager, WARNING_MS } from './SessionTimeoutManager'
import { useAuthStore } from '../../../stores/authStore'
import { resetActivity } from '../../../lib/sessionActivity'
import type { EstadoSesion } from '../types/sesion.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.seconds !== undefined ? `${key}:${opts.seconds}` : key),
  }),
}))

const endSession = vi.fn<(reason: unknown, options: unknown) => Promise<void>>(() => Promise.resolve())
vi.mock('../../../lib/sessionEnd', () => ({
  endSession: (reason: unknown, options: unknown) => endSession(reason, options),
}))

const mutateAsync = vi.fn(() => Promise.resolve({}))
let estado: EstadoSesion
vi.mock('../hooks/useSesion', () => ({
  usePoliticaSesion: () => ({ data: estado }),
  useRegistrarActividad: () => ({ mutateAsync, isPending: false }),
}))

const refreshToken = vi.fn(() => Promise.resolve())

const INACTIVIDAD_MIN = 5

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
  resetActivity(Date.now())
  estado = {
    inactividadMinutos: INACTIVIDAD_MIN,
    sesionMaximaHoras: 12,
    sesionIniciadaEn: new Date(Date.now()).toISOString(),
    ultimaActividadEn: null,
  }
  useAuthStore.setState({ isAuthenticated: true, refreshToken })
  endSession.mockClear()
  mutateAsync.mockClear()
  refreshToken.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useAuthStore.setState({ isAuthenticated: false })
})

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('SessionTimeoutManager', () => {
  it('muestra el aviso 60 s antes del cierre por inactividad', () => {
    render(<SessionTimeoutManager />)

    advance(INACTIVIDAD_MIN * 60_000 - WARNING_MS - 1_000)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    advance(2_000)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/warning.message:\d+/)).toBeInTheDocument()
  })

  it('"Seguir conectado" registra actividad, refresca y reinicia el contador', async () => {
    render(<SessionTimeoutManager />)
    advance(INACTIVIDAD_MIN * 60_000 - 30_000)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'warning.stayConnected' }))
    })

    expect(mutateAsync).toHaveBeenCalled()
    expect(refreshToken).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    // El contador vuelve a la inactividad completa: a los 3 min no hay aviso ni cierre.
    advance(3 * 60_000)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(endSession).not.toHaveBeenCalled()
  })

  it('sin interacción cierra la sesión por inactividad', () => {
    render(<SessionTimeoutManager />)

    advance(INACTIVIDAD_MIN * 60_000 + 1_000)

    expect(endSession).toHaveBeenCalledWith('INACTIVIDAD', undefined)
  })

  it('la actividad pasiva no cierra el aviso ya abierto', () => {
    render(<SessionTimeoutManager />)
    advance(INACTIVIDAD_MIN * 60_000 - 30_000)

    fireEvent.mouseMove(window)
    advance(1_000)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('la interacción real antes del aviso reinicia el contador y reporta al servidor', () => {
    render(<SessionTimeoutManager />)
    advance(3 * 60_000)

    fireEvent.keyDown(window, { key: 'a' })
    advance(3 * 60_000)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(endSession).not.toHaveBeenCalled()
    expect(mutateAsync).toHaveBeenCalledTimes(1)
  })

  it('reporta actividad al servidor como máximo una vez por minuto (con envío trailing)', () => {
    render(<SessionTimeoutManager />)

    // Interacción continua durante 3 minutos (un evento cada 6 s, por encima del throttle local).
    for (let elapsed = 0; elapsed < 3 * 60_000; elapsed += 6_000) {
      fireEvent.mouseMove(window)
      advance(6_000)
    }
    advance(60_000)

    expect(mutateAsync.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(mutateAsync.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('la actividad en otra pestaña evita el cierre', () => {
    render(<SessionTimeoutManager />)

    for (let i = 0; i < 3; i++) {
      advance(3 * 60_000)
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'shac_last_activity', newValue: String(Date.now()) }),
        )
      })
    }

    expect(endSession).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('un cierre de sesión en otra pestaña cierra esta sin volver a avisar', () => {
    render(<SessionTimeoutManager />)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'shac_session_logout',
          newValue: JSON.stringify({ reason: 'INACTIVIDAD', at: Date.now() }),
        }),
      )
    })

    expect(endSession).toHaveBeenCalledWith('INACTIVIDAD', { notifyServer: false, broadcast: false })
  })

  it('cierra por duración máxima aunque haya actividad', () => {
    estado = { ...estado, sesionMaximaHoras: 1, sesionIniciadaEn: new Date(Date.now() - 59 * 60_000).toISOString() }
    render(<SessionTimeoutManager />)

    fireEvent.click(window)
    advance(61_000)

    expect(endSession).toHaveBeenCalledWith('SESION_MAXIMA', undefined)
  })
})
