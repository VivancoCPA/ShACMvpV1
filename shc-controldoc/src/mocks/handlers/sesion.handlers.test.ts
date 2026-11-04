import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import axios, { isAxiosError } from 'axios'
import { authHandlers } from './auth.handlers'
import { sesionHandlers } from './sesion.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getConfiguracionesSeguridadStore, resetSesionStores } from '../fixtures/sesion.fixtures'
import { useAuthStore } from '../../stores/authStore'

// Cliente axios "crudo" (sin los interceptores de lib/axios.ts) para inspeccionar las respuestas
// de los handlers tal cual, incluidos los 401 con errorCode.
const http = axios.create()

const server = setupServer(...authHandlers, ...sesionHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  vi.useRealTimers()
  resetSesionStores()
  useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, empresaActivaId: null })
})

async function login(email: string) {
  const fixture = authFixtures.find((u) => u.email === email)
  if (!fixture) throw new Error(`Fixture no encontrado: ${email}`)
  const res = await http.post('/api/auth/login', { email, password: fixture.password, empresaId: 'empresa-001' })
  const data = res.data.data as {
    accessToken: string
    mockRefreshToken: string
    user: import('../../types/auth.types').User
    empresaActivaId: string
  }
  useAuthStore.setState({
    user: data.user,
    accessToken: data.accessToken,
    isAuthenticated: true,
    empresaActivaId: data.empresaActivaId,
  })
  return data
}

function sessionHeaders(refreshToken: string, empresaId = 'empresa-001') {
  return { 'X-Mock-Refresh-Token': refreshToken, 'X-Mock-Empresa-Activa': empresaId }
}

async function expect401(promise: Promise<unknown>, errorCode?: string) {
  try {
    await promise
    throw new Error('se esperaba 401')
  } catch (error) {
    expect(isAxiosError(error) && error.response?.status).toBe(401)
    if (errorCode && isAxiosError(error)) expect(error.response?.data.errorCode).toBe(errorCode)
  }
}

describe('sesion.handlers — aplicación de la política', () => {
  it('refresh con inactividad vencida responde 401 SESION_INACTIVA', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { mockRefreshToken } = await login('operario@shac.pe')
    getConfiguracionesSeguridadStore().set('empresa-001', {
      inactividadMinutos: 5,
      sesionMaximaHoras: null,
      actualizadoPorId: 'x',
      actualizadoPorNombre: 'x',
      actualizadoEn: new Date().toISOString(),
    })
    vi.setSystemTime(Date.now() + 6 * 60_000)

    await expect401(
      http.post('/api/auth/refresh', undefined, { headers: sessionHeaders(mockRefreshToken) }),
      'SESION_INACTIVA',
    )
  })

  it('la rotación conserva el inicio y la sesión máxima vence aunque haya actividad', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { mockRefreshToken } = await login('operario@shac.pe')
    getConfiguracionesSeguridadStore().set('empresa-001', {
      inactividadMinutos: null,
      sesionMaximaHoras: 1,
      actualizadoPorId: 'x',
      actualizadoPorNombre: 'x',
      actualizadoEn: new Date().toISOString(),
    })

    // Actividad + rotación cada 20 min durante 1 h: nunca se pasa la inactividad (30 min).
    let token = mockRefreshToken
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + 20 * 60_000)
      await http.post('/api/auth/actividad', undefined, { headers: sessionHeaders(token) })
      const res = await http.post('/api/auth/refresh', undefined, { headers: sessionHeaders(token) })
      token = res.data.data.mockRefreshToken as string
    }
    vi.setSystemTime(Date.now() + 2 * 60_000)

    await expect401(
      http.post('/api/auth/refresh', undefined, { headers: sessionHeaders(token) }),
      'SESION_MAXIMA_ALCANZADA',
    )
  })

  it('el token rotado queda revocado', async () => {
    const { mockRefreshToken } = await login('operario@shac.pe')
    await http.post('/api/auth/refresh', undefined, { headers: sessionHeaders(mockRefreshToken) })

    await expect401(http.post('/api/auth/refresh', undefined, { headers: sessionHeaders(mockRefreshToken) }))
  })

  it('politica-sesion devuelve la política efectiva y el inicio de la sesión', async () => {
    const { mockRefreshToken, accessToken } = await login('operario@shac.pe')

    const res = await http.get('/api/auth/politica-sesion', {
      headers: { ...sessionHeaders(mockRefreshToken), Authorization: `Bearer ${accessToken}` },
    })

    expect(res.data.data.inactividadMinutos).toBe(30)
    expect(res.data.data.sesionMaximaHoras).toBe(12)
    expect(res.data.data.sesionIniciadaEn).not.toBeNull()
  })
})

describe('sesion.handlers — configuración', () => {
  it('ADMINISTRADOR_EMPRESA de otra empresa recibe 404', async () => {
    const { accessToken } = await login('admin.empresa@shac.pe')

    try {
      await http.put(
        '/api/empresas/empresa-002/seguridad-sesion',
        { inactividadMinutos: 10, sesionMaximaHoras: null },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      throw new Error('se esperaba 404')
    } catch (error) {
      expect(isAxiosError(error) && error.response?.status).toBe(404)
    }
  })

  it('OPERARIO recibe 403', async () => {
    const { accessToken } = await login('operario@shac.pe')

    try {
      await http.get('/api/empresas/empresa-001/seguridad-sesion', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      throw new Error('se esperaba 403')
    } catch (error) {
      expect(isAxiosError(error) && error.response?.status).toBe(403)
    }
  })

  it('valida rango y sesión máxima ≥ inactividad', async () => {
    const { accessToken } = await login('admin.empresa@shac.pe')

    try {
      await http.put(
        '/api/empresas/empresa-001/seguridad-sesion',
        { inactividadMinutos: 120, sesionMaximaHoras: 1 },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      throw new Error('se esperaba 400')
    } catch (error) {
      expect(isAxiosError(error) && error.response?.status).toBe(400)
      if (isAxiosError(error)) {
        expect((error.response?.data.errors as string[]).some((e) => e.startsWith('sesionMaximaHoras:'))).toBe(true)
      }
    }
  })

  it('el administrador guarda la configuración de su empresa', async () => {
    const { accessToken, user } = await login('admin.empresa@shac.pe')

    const res = await http.put(
      '/api/empresas/empresa-001/seguridad-sesion',
      { inactividadMinutos: 5, sesionMaximaHoras: null },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    expect(res.data.data.efectiva.inactividadMinutos).toBe(5)
    expect(res.data.data.actualizadoPorId).toBe(user.id)
  })
})
