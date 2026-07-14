import { http, HttpResponse, delay } from 'msw'
import { getUsersStore } from '../fixtures/auth.fixtures'
import type { MockUser } from '../fixtures/auth.fixtures'
import type { User, UserRole } from '../../types/auth.types'

const LATENCY = 400
const TEMP_PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, message }, { status })
}

function generateTemporaryPassword(): string {
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += TEMP_PASSWORD_CHARS[Math.floor(Math.random() * TEMP_PASSWORD_CHARS.length)]
  }
  return password
}

// GET /api/users es la única excepción (ver su handler abajo): expone `password`
// a propósito porque es dato interno del mock, nunca del backend real. El resto
// de endpoints (alta/edición/baja/reset) nunca devuelve `password` en el usuario.
function stripPassword(mockUser: MockUser): User {
  const { password: _pw, ...rest } = mockUser
  return rest
}

interface CreateUserBody {
  nombre?: string
  apellido?: string
  email?: string
  rol?: UserRole
  area?: string
  areasAsignadas?: string[]
  avatarBase64?: string
}

interface UpdateUserBody {
  nombre?: string
  apellido?: string
  email?: string
  rol?: UserRole
  area?: string
  areasAsignadas?: string[]
  avatarBase64?: string
}

export const userHandlers = [
  // GET /api/users — listado con filtros opcionales rol/activo
  http.get('/api/users', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const rol = url.searchParams.get('rol')
    const activoParam = url.searchParams.get('activo')

    let result = getUsersStore()
    if (rol !== null) result = result.filter((u) => u.rol === rol)
    if (activoParam !== null) result = result.filter((u) => u.activo === (activoParam === 'true'))

    return ok(result)
  }),

  // POST /api/users — alta (RN-USR-005)
  http.post('/api/users', async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as CreateUserBody

    const store = getUsersStore()
    const emailDuplicado = store.some((u) => u.email === body.email)
    if (emailDuplicado) {
      return err('El email ya está en uso', 409)
    }

    const now = new Date().toISOString()
    const temporaryPassword = generateTemporaryPassword()

    const newUser: MockUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nombre: body.nombre ?? '',
      apellido: body.apellido ?? '',
      email: body.email ?? '',
      password: temporaryPassword,
      rol: body.rol ?? 'OPERARIO',
      activo: true,
      createdAt: now,
      avatarUrl: undefined,
      ...(body.area ? { area: body.area } : {}),
      ...(body.areasAsignadas ? { areasAsignadas: body.areasAsignadas } : {}),
    }
    if (body.avatarBase64) {
      // MockUser.avatarUrl está tipado `undefined` (semilla fija sin avatar); el CRUD real
      // de esta spec es el primer productor de avatarUrl, de ahí el cast puntual.
      ;(newUser as unknown as { avatarUrl?: string }).avatarUrl = body.avatarBase64
    }

    store.push(newUser)

    return ok({ ...stripPassword(newUser), temporaryPassword }, 201)
  }),

  // PATCH /api/users/:id — edición (RN-USR-006)
  http.patch('/api/users/:id', async ({ params, request }) => {
    await delay(LATENCY)
    const store = getUsersStore()
    const idx = store.findIndex((u) => u.id === params.id)
    if (idx === -1) return err('Usuario no encontrado', 404)

    const body = (await request.json()) as UpdateUserBody

    if (body.email !== undefined) {
      const emailDuplicado = store.some((u) => u.id !== params.id && u.email === body.email)
      if (emailDuplicado) {
        return err('El email ya está en uso', 409)
      }
    }

    const current = store[idx]
    const updated: MockUser = {
      ...current,
      ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
      ...(body.apellido !== undefined ? { apellido: body.apellido } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.rol !== undefined ? { rol: body.rol } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.areasAsignadas !== undefined ? { areasAsignadas: body.areasAsignadas } : {}),
      ...(body.avatarBase64 !== undefined
        ? ({ avatarUrl: body.avatarBase64 } as unknown as { avatarUrl: undefined })
        : {}),
    }
    store[idx] = updated

    return ok(stripPassword(updated))
  }),

  // PATCH /api/users/:id/toggle-active — baja/reactivación (RN-USR-001, RN-USR-003)
  http.patch('/api/users/:id/toggle-active', async ({ params }) => {
    await delay(LATENCY)
    const store = getUsersStore()
    const idx = store.findIndex((u) => u.id === params.id)
    if (idx === -1) return err('Usuario no encontrado', 404)

    const updated: MockUser = { ...store[idx], activo: !store[idx].activo }
    store[idx] = updated

    return ok(stripPassword(updated))
  }),

  // POST /api/users/:id/reset-password — reset por admin (RN-USR-004)
  http.post('/api/users/:id/reset-password', async ({ params }) => {
    await delay(LATENCY)
    const store = getUsersStore()
    const idx = store.findIndex((u) => u.id === params.id)
    if (idx === -1) return err('Usuario no encontrado', 404)

    const temporaryPassword = generateTemporaryPassword()
    store[idx] = { ...store[idx], password: temporaryPassword }

    return ok({ temporaryPassword })
  }),
]
