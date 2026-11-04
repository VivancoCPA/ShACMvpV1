import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import api from './axios'
import { useAuthStore } from '../stores/authStore'

// pin-olvidado-pista design.md D2: un 401 por credencial incorrecta (PIN_INCORRECTO,
// CONTRASENA_INCORRECTA) no refresca la sesión ni reenvía la petición.

let refreshCalls = 0
let signCalls = 0
let setPinCalls = 0
let protegidoCalls = 0

const server = setupServer(
  http.post('/api/auth/refresh', () => {
    refreshCalls++
    return HttpResponse.json({ success: true, data: { accessToken: 'token-nuevo' } })
  }),
  http.post('/api/documents/:id/sign', () => {
    signCalls++
    return HttpResponse.json(
      { success: false, data: null, message: 'PIN incorrecto', errorCode: 'PIN_INCORRECTO' },
      { status: 401 },
    )
  }),
  http.post('/api/auth/set-pin', () => {
    setPinCalls++
    return HttpResponse.json(
      { success: false, data: null, message: 'Contraseña actual incorrecta', errorCode: 'CONTRASENA_INCORRECTA' },
      { status: 401 },
    )
  }),
  http.get('/api/protegido', ({ request }) => {
    protegidoCalls++
    return request.headers.get('authorization') === 'Bearer token-nuevo'
      ? HttpResponse.json({ success: true, data: 'ok' })
      : HttpResponse.json({ success: false, message: 'expirado' }, { status: 401 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  refreshCalls = 0
  signCalls = 0
  setPinCalls = 0
  protegidoCalls = 0
  useAuthStore.setState({ isAuthenticated: false, accessToken: null, user: null, sessionEndReason: null })
})

function loginLocal() {
  useAuthStore.setState({ isAuthenticated: true, accessToken: 'token-viejo', sessionEndReason: null })
}

describe('lib/axios — 401 por credencial incorrecta', () => {
  it('un 401 PIN_INCORRECTO no refresca y la petición se envía una sola vez', async () => {
    loginLocal()

    await expect(api.post('/api/documents/doc-1/sign', { pin: '0000' })).rejects.toMatchObject({
      response: { status: 401, data: { errorCode: 'PIN_INCORRECTO' } },
    })

    expect(refreshCalls).toBe(0)
    expect(signCalls).toBe(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe('token-viejo')
  })

  it('un 401 CONTRASENA_INCORRECTA no refresca y la petición se envía una sola vez', async () => {
    loginLocal()

    await expect(api.post('/api/auth/set-pin', { password: 'x', pin: '1234' })).rejects.toMatchObject({
      response: { status: 401, data: { errorCode: 'CONTRASENA_INCORRECTA' } },
    })

    expect(refreshCalls).toBe(0)
    expect(setPinCalls).toBe(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('un 401 sin errorCode sigue refrescando y reintentando una vez', async () => {
    loginLocal()

    const response = await api.get('/api/protegido')

    expect(response.data).toBe('ok')
    expect(refreshCalls).toBe(1)
    expect(protegidoCalls).toBe(2)
  })
})
