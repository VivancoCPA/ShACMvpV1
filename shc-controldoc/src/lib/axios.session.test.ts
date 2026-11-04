import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import api from './axios'
import { useAuthStore } from '../stores/authStore'

// sesion-timeout-inactividad design.md D12: el interceptor no reintenta ante un cierre por
// política, y el refresh es single-flight.

let refreshCalls = 0
let refreshResponse: () => Response = () =>
  HttpResponse.json({ success: true, data: { accessToken: 'token-nuevo' } })

const server = setupServer(
  http.post('/api/auth/refresh', () => {
    refreshCalls++
    return refreshResponse()
  }),
  http.get('/api/protegido', ({ request }) =>
    request.headers.get('authorization') === 'Bearer token-nuevo'
      ? HttpResponse.json({ success: true, data: 'ok' })
      : HttpResponse.json({ success: false, message: 'expirado' }, { status: 401 }),
  ),
  http.post('/api/auth/actividad', () =>
    HttpResponse.json(
      { success: false, message: 'Tu sesión se cerró por inactividad', errorCode: 'SESION_INACTIVA' },
      { status: 401 },
    ),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  refreshCalls = 0
  refreshResponse = () => HttpResponse.json({ success: true, data: { accessToken: 'token-nuevo' } })
  useAuthStore.setState({ isAuthenticated: false, accessToken: null, user: null, sessionEndReason: null })
})

function loginLocal() {
  useAuthStore.setState({ isAuthenticated: true, accessToken: 'token-viejo', sessionEndReason: null })
}

describe('lib/axios — interceptor de sesión', () => {
  it('dos 401 simultáneos comparten un único /refresh', async () => {
    loginLocal()

    const [a, b] = await Promise.all([api.get('/api/protegido'), api.get('/api/protegido')])

    expect(a.data).toBe('ok')
    expect(b.data).toBe('ok')
    expect(refreshCalls).toBe(1)
  })

  it('un 401 SESION_MAXIMA_ALCANZADA del refresh cierra la sesión sin reintentar', async () => {
    loginLocal()
    refreshResponse = () =>
      HttpResponse.json(
        { success: false, message: 'Tu sesión alcanzó la duración máxima', errorCode: 'SESION_MAXIMA_ALCANZADA' },
        { status: 401 },
      )

    await expect(api.get('/api/protegido')).rejects.toBeDefined()

    expect(refreshCalls).toBe(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().sessionEndReason).toBe('SESION_MAXIMA')
  })

  it('un 401 SESION_INACTIVA de cualquier endpoint cierra la sesión sin intentar refresh', async () => {
    loginLocal()

    await expect(api.post('/api/auth/actividad')).rejects.toBeDefined()

    expect(refreshCalls).toBe(0)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().sessionEndReason).toBe('INACTIVIDAD')
  })
})
