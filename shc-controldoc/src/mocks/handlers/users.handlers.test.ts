import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { userHandlers } from './users.handlers'
import { authHandlers } from './auth.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import type { User } from '../../types/auth.types'

const server = setupServer(...userHandlers, ...authHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  // Revierte cualquier alta hecha en un test para no filtrar estado entre pruebas.
  const seedIds = new Set(
    ['user-operario-001', 'user-supervisor-001', 'user-supervisor-002', 'user-jefecalidad-001',
     'user-jefedocs-001', 'user-auditor-001', 'user-autor-001', 'user-004', 'user-005',
     'user-gerencia-001', 'user-admin-001'],
  )
  for (let i = authFixtures.length - 1; i >= 0; i--) {
    if (!seedIds.has(authFixtures[i].id)) authFixtures.splice(i, 1)
  }
  const jefeDocs = authFixtures.find((u) => u.id === 'user-jefedocs-001')
  if (jefeDocs) {
    jefeDocs.activo = true
    jefeDocs.password = 'Shac2025!'
    jefeDocs.email = 'jefe.docs@shac.pe'
  }
})
afterAll(() => server.close())

interface ErrorBody {
  message: string
}

async function call<T>(promise: Promise<{ data: T; status: number }>) {
  try {
    const res = await promise
    return { status: res.status, data: res.data }
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return { status: error.response.status, data: error.response.data as T }
    }
    throw error
  }
}

describe('users.handlers — GET /api/users', () => {
  it('retorna todos los usuarios sin filtros, activos e inactivos', async () => {
    const res = await api.get<User[]>('/api/users')
    expect(res.status).toBe(200)
    expect(res.data.length).toBeGreaterThanOrEqual(authFixtures.length)
  })

  it('filtra por rol', async () => {
    const res = await api.get<User[]>('/api/users', { params: { rol: 'SUPERVISOR' } })
    expect(res.data.every((u) => u.rol === 'SUPERVISOR')).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('filtra por estado activo', async () => {
    const res = await api.get<User[]>('/api/users', { params: { activo: true } })
    expect(res.data.every((u) => u.activo === true)).toBe(true)
  })
})

describe('users.handlers — POST /api/users (RN-USR-005)', () => {
  it('crea un usuario y retorna temporaryPassword de 8 caracteres alfanuméricos', async () => {
    const res = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Test',
      apellido: 'Nuevo',
      email: 'test.nuevo@shac.pe',
      rol: 'OPERARIO',
    })

    expect(res.status).toBe(201)
    expect(res.data.temporaryPassword).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(res.data.activo).toBe(true)

    const listado = await api.get<User[]>('/api/users')
    expect(listado.data.some((u) => u.email === 'test.nuevo@shac.pe')).toBe(true)
  })

  it('rechaza alta con email duplicado (usuario activo) con 409 y no agrega usuario', async () => {
    const before = (await api.get<User[]>('/api/users')).data.length

    const result = await call(
      api.post<ErrorBody>('/api/users', {
        nombre: 'Duplicado',
        apellido: 'Test',
        email: 'operario@shac.pe',
        rol: 'OPERARIO',
      }),
    )

    expect(result.status).toBe(409)
    const after = (await api.get<User[]>('/api/users')).data.length
    expect(after).toBe(before)
  })

  it('rechaza alta con email duplicado de un usuario inactivo', async () => {
    const created = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Baja',
      apellido: 'Prueba',
      email: 'baja.prueba@shac.pe',
      rol: 'OPERARIO',
    })
    await api.patch(`/api/users/${created.data.id}/toggle-active`)

    const result = await call(
      api.post<ErrorBody>('/api/users', {
        nombre: 'Otro',
        apellido: 'Usuario',
        email: 'baja.prueba@shac.pe',
        rol: 'OPERARIO',
      }),
    )

    expect(result.status).toBe(409)
  })
})

describe('users.handlers — PATCH /api/users/:id (RN-USR-006)', () => {
  it('actualiza rol y area sin tocar password ni activo', async () => {
    const created = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Editar',
      apellido: 'Yo',
      email: 'editar.yo@shac.pe',
      rol: 'OPERARIO',
    })

    const updated = await api.patch<User>(`/api/users/${created.data.id}`, {
      email: 'editar.yo@shac.pe',
      rol: 'SUPERVISOR',
      area: 'Operaciones',
      areasAsignadas: ['Galpón B'],
    })

    expect(updated.data.rol).toBe('SUPERVISOR')
    expect(updated.data.area).toBe('Operaciones')
    expect(updated.data.activo).toBe(true)

    // El login sigue funcionando con la contraseña temporal original (no fue tocada)
    const loginRes = await api.post<{ accessToken: string }>('/api/auth/login', {
      email: 'editar.yo@shac.pe',
      password: created.data.temporaryPassword,
    })
    expect(loginRes.status).toBe(200)
  })
})

describe('users.handlers — PATCH /api/users/:id/toggle-active (RN-USR-001, RN-USR-003)', () => {
  it('da de baja sin eliminar el registro, y bloquea el login inmediatamente', async () => {
    const created = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Baja',
      apellido: 'Directa',
      email: 'baja.directa@shac.pe',
      rol: 'OPERARIO',
    })

    const toggled = await api.patch<User>(`/api/users/${created.data.id}/toggle-active`)
    expect(toggled.data.activo).toBe(false)
    expect(toggled.data.id).toBe(created.data.id)

    const listado = await api.get<User[]>('/api/users')
    expect(listado.data.find((u) => u.id === created.data.id)?.activo).toBe(false)

    const loginResult = await call(
      api.post<ErrorBody>('/api/auth/login', {
        email: 'baja.directa@shac.pe',
        password: created.data.temporaryPassword,
      }),
    )
    expect(loginResult.status).toBe(403)
  })

  it('reactivar restaura acceso sin resetear la contraseña', async () => {
    const created = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Reactivar',
      apellido: 'Prueba',
      email: 'reactivar.prueba@shac.pe',
      rol: 'OPERARIO',
    })
    await api.patch(`/api/users/${created.data.id}/toggle-active`)
    const reactivated = await api.patch<User>(`/api/users/${created.data.id}/toggle-active`)
    expect(reactivated.data.activo).toBe(true)

    const loginRes = await api.post<{ accessToken: string }>('/api/auth/login', {
      email: 'reactivar.prueba@shac.pe',
      password: created.data.temporaryPassword,
    })
    expect(loginRes.status).toBe(200)
  })
})

describe('users.handlers — POST /api/users/:id/reset-password (RN-USR-004)', () => {
  it('permite login inmediato con la nueva contraseña e invalida la anterior', async () => {
    const created = await api.post<User & { temporaryPassword: string }>('/api/users', {
      nombre: 'Reset',
      apellido: 'Password',
      email: 'reset.password@shac.pe',
      rol: 'OPERARIO',
    })

    const reset = await api.post<{ temporaryPassword: string }>(
      `/api/users/${created.data.id}/reset-password`,
    )
    expect(reset.data.temporaryPassword).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(reset.data.temporaryPassword).not.toBe(created.data.temporaryPassword)

    const newLogin = await api.post<{ accessToken: string }>('/api/auth/login', {
      email: 'reset.password@shac.pe',
      password: reset.data.temporaryPassword,
    })
    expect(newLogin.status).toBe(200)

    const oldLoginResult = await call(
      api.post<ErrorBody>('/api/auth/login', {
        email: 'reset.password@shac.pe',
        password: created.data.temporaryPassword,
      }),
    )
    expect(oldLoginResult.status).toBe(401)
  })
})
