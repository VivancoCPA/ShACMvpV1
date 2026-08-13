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
    expect(new Date(fixture.lastLogin as unknown as string).toString()).not.toBe('Invalid Date')
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = { data: any }

describe('auth.handlers — resolución de empresa activa en login (empresa-session)', () => {
  it('usuario mono-empresa resuelve sesión completa sin pedir empresaId', async () => {
    const fixture = authFixtures.find((u) => u.email === 'operario@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: operario@shac.pe')

    const res: AnyResponse = await api.post('/api/auth/login', {
      email: fixture.email,
      password: fixture.password,
    })

    expect(res.data.empresaActivaId).toBe('empresa-001')
    expect(res.data.user.rol).toBe('OPERARIO')
    expect(res.data.empresasDisponibles).toHaveLength(1)
  })

  it('usuario multi-empresa sin empresaId recibe requiresEmpresaSelection, no una sesión', async () => {
    const fixture = authFixtures.find((u) => u.email === 'supervisor@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: supervisor@shac.pe')

    const res: AnyResponse = await api.post('/api/auth/login', {
      email: fixture.email,
      password: fixture.password,
    })

    expect(res.data.requiresEmpresaSelection).toBe(true)
    expect(res.data.user).toBeUndefined()
    expect(res.data.accessToken).toBeUndefined()
    expect(
      (res.data.empresasDisponibles as Array<{ id: string }>).map((e) => e.id).sort(),
    ).toEqual(['empresa-001', 'empresa-002'])
  })

  it('usuario multi-empresa con empresaId resuelve el rol correspondiente a esa empresa', async () => {
    const fixture = authFixtures.find((u) => u.email === 'supervisor@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: supervisor@shac.pe')

    const res: AnyResponse = await api.post('/api/auth/login', {
      email: fixture.email,
      password: fixture.password,
      empresaId: 'empresa-002',
    })

    expect(res.data.empresaActivaId).toBe('empresa-002')
    expect(res.data.user.rol).toBe('JEFE_CALIDAD_SYST')
  })

  it('rechaza un empresaId no asignado al usuario', async () => {
    const fixture = authFixtures.find((u) => u.email === 'supervisor@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: supervisor@shac.pe')

    let caught: unknown
    try {
      await api.post('/api/auth/login', {
        email: fixture.email,
        password: fixture.password,
        empresaId: 'empresa-999',
      })
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(403)
  })
})

describe('auth.handlers — POST /api/auth/refresh resuelve el rol por empresa activa', () => {
  it('usa el header X-Mock-Empresa-Activa para resolver el rol efectivo', async () => {
    const refreshToken = `mock-refresh-token-user-supervisor-001-${Date.now()}`

    const res: AnyResponse = await api.post('/api/auth/refresh', undefined, {
      headers: { 'X-Mock-Refresh-Token': refreshToken, 'X-Mock-Empresa-Activa': 'empresa-002' },
    })

    expect(res.data.empresaActivaId).toBe('empresa-002')
    expect(res.data.user.rol).toBe('JEFE_CALIDAD_SYST')
  })

  it('sin header de empresa activa, usa la primera empresa asignada como fallback', async () => {
    const refreshToken = `mock-refresh-token-user-supervisor-001-${Date.now()}`

    const res: AnyResponse = await api.post('/api/auth/refresh', undefined, {
      headers: { 'X-Mock-Refresh-Token': refreshToken },
    })

    expect(res.data.empresaActivaId).toBe('empresa-001')
    expect(res.data.user.rol).toBe('SUPERVISOR')
  })
})

describe('auth.handlers — POST /api/auth/switch-empresa', () => {
  it('cambia el rol efectivo a la empresa elegida sin requerir credenciales', async () => {
    const accessToken = `mock-access-token-user-supervisor-001-${Date.now()}`

    const res: AnyResponse = await api.post(
      '/api/auth/switch-empresa',
      { empresaId: 'empresa-002' },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    expect(res.data.empresaActivaId).toBe('empresa-002')
    expect(res.data.user.rol).toBe('JEFE_CALIDAD_SYST')
    expect(res.data.accessToken).toBeDefined()
  })

  it('rechaza el cambio a una empresa no asignada al usuario', async () => {
    const accessToken = `mock-access-token-user-supervisor-001-${Date.now()}`

    let caught: unknown
    try {
      await api.post(
        '/api/auth/switch-empresa',
        { empresaId: 'empresa-999' },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(403)
  })

  it('rechaza sin un token de acceso válido', async () => {
    let caught: unknown
    try {
      await api.post('/api/auth/switch-empresa', { empresaId: 'empresa-001' })
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(401)
  })
})
