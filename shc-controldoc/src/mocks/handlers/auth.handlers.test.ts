import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { authHandlers } from './auth.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import type { User } from '../../types/auth.types'

const server = setupServer(...authHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  const jefeDocs = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
  if (jefeDocs) jefeDocs.activo = true
})
afterAll(() => server.close())

interface LoginResponse {
  accessToken: string
  mockRefreshToken: string
  user: User
}

describe('auth.handlers — POST /api/auth/login', () => {
  it('actualiza lastLogin del usuario y lo incluye en la respuesta', async () => {
    const fixture = authFixtures.find((u) => u.email === 'operario@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: operario@shac.pe')
    fixture.lastLogin = undefined

    const res = await api.post<LoginResponse>('/api/auth/login', {
      email: fixture.email,
      password: fixture.password,
    })

    expect(res.status).toBe(200)
    expect(res.data.user.lastLogin).toBeDefined()
    expect(fixture.lastLogin).toBe(res.data.user.lastLogin)
    expect(new Date(fixture.lastLogin as string).toString()).not.toBe('Invalid Date')
  })
})

describe('auth.handlers — POST /api/auth/login rechaza usuarios inactivos (RN-USR-002)', () => {
  it('rechaza el login de un usuario con activo: false con un mensaje distinto de credenciales inválidas', async () => {
    const fixture = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: jefe.docs@shac.pe')
    fixture.activo = false

    let caught: unknown
    try {
      await api.post('/api/auth/login', { email: fixture.email, password: fixture.password })
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(403)
    expect((caught.response?.data as { message?: string }).message).toBe(
      'Usuario deshabilitado, contacte al administrador',
    )
    expect((caught.response?.data as { message?: string }).message).not.toBe('Credenciales inválidas')
  })

  it('permite el login de un usuario con activo: true con credenciales correctas', async () => {
    const fixture = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: jefe.docs@shac.pe')
    fixture.activo = true

    const res = await api.post<LoginResponse>('/api/auth/login', {
      email: fixture.email,
      password: fixture.password,
    })

    expect(res.status).toBe(200)
    expect(res.data.accessToken).toBeDefined()
  })
})
