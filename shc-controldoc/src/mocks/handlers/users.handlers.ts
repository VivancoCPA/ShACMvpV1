import { http, HttpResponse, delay } from 'msw'
import { getUsersStore } from '../fixtures/auth.fixtures'
import type { MockUser } from '../fixtures/auth.fixtures'
import { getUsuarioEmpresaStore } from '../fixtures/empresas.fixtures'
import { getSessionUser } from './shared/session'
import { useAuthStore } from '../../stores/authStore'
import type { User, UserRole } from '../../types/auth.types'

const LATENCY = 400
const TEMP_PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, message }, { status })
}

/**
 * Sesión válida + usuario objetivo asignado a la empresa activa de esa
 * sesión — usado por toda operación por-id de este handler para que un
 * ADMINISTRADOR_EMPRESA nunca pueda dirigirse a un usuario de otra empresa
 * por id directo, aunque lo conozca (me-f4-admin-empresas).
 */
function requireUsuarioDeEmpresaActiva(
  usuarioId: string,
  request: Request,
): { empresaActivaId: string } | { error: ReturnType<typeof err> } {
  const sessionUser = getSessionUser(request)
  if (!sessionUser) return { error: err('Sesión expirada', 401) }
  const empresaActivaId = useAuthStore.getState().empresaActivaId
  if (!empresaActivaId) return { error: err('Sesión sin empresa activa', 401) }
  const pertenece = getUsuarioEmpresaStore().some(
    (ue) => ue.usuarioId === usuarioId && ue.empresaId === empresaActivaId,
  )
  if (!pertenece) return { error: err('Usuario no encontrado', 404) }
  return { empresaActivaId }
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
  areaId?: string
  areaIds?: string[]
  avatarBase64?: string
}

interface UpdateUserBody {
  nombre?: string
  apellido?: string
  email?: string
  rol?: UserRole
  areaId?: string
  areaIds?: string[]
  avatarBase64?: string
}

export const userHandlers = [
  // GET /api/users — listado con filtros opcionales rol/activo, scoped a la empresa
  // activa de la sesión (me-f4-admin-empresas — gap descubierto en implementación:
  // antes de esto el endpoint devolvía usuarios de todas las empresas sin filtrar).
  // SUPERADMIN es la única excepción: no tiene empresa activa por diseño (ver
  // empresa-session) y necesita ver todos los usuarios del sistema para buscar
  // a quién asignar a una empresa (empresa-user-assignment).
  http.get('/api/users', async ({ request }) => {
    await delay(LATENCY)
    const sessionUser = getSessionUser(request)
    if (!sessionUser) return err('Sesión expirada', 401)

    let usuarioIdsVisibles: Set<string> | null = null
    let empresaActivaId: string | null = null
    if (sessionUser.rol !== 'SUPERADMIN') {
      empresaActivaId = useAuthStore.getState().empresaActivaId
      if (!empresaActivaId) return err('Sesión sin empresa activa', 401)
      usuarioIdsVisibles = new Set(
        getUsuarioEmpresaStore()
          .filter((ue) => ue.empresaId === empresaActivaId)
          .map((ue) => ue.usuarioId),
      )
    }

    const url = new URL(request.url)
    const rol = url.searchParams.get('rol')
    const activoParam = url.searchParams.get('activo')

    let result = getUsersStore().filter((u) => !usuarioIdsVisibles || usuarioIdsVisibles.has(u.id))

    // RN-EMP-002: el rol vive en `UsuarioEmpresa`, no en `Usuario` — cada
    // usuario listado debe mostrar el rol que tiene en la empresa activa de
    // esta sesión, nunca un campo de rol global (que puede haber quedado
    // desalineado si el usuario tiene un rol distinto en otra empresa).
    if (empresaActivaId !== null) {
      const empresaActivaIdSnapshot = empresaActivaId
      result = result.map((u) => {
        const rolEnEmpresa = getUsuarioEmpresaStore().find(
          (ue) => ue.usuarioId === u.id && ue.empresaId === empresaActivaIdSnapshot,
        )?.rol
        return rolEnEmpresa ? { ...u, rol: rolEnEmpresa } : u
      })
    }

    if (rol !== null) result = result.filter((u) => u.rol === rol)
    if (activoParam !== null) result = result.filter((u) => u.activo === (activoParam === 'true'))

    return ok(result)
  }),

  // POST /api/users — alta (RN-USR-005), asignada a la empresa activa de quien crea
  http.post('/api/users', async ({ request }) => {
    await delay(LATENCY)
    const sessionUser = getSessionUser(request)
    if (!sessionUser) return err('Sesión expirada', 401)
    const empresaActivaId = useAuthStore.getState().empresaActivaId
    if (!empresaActivaId) return err('Sesión sin empresa activa', 401)

    const body = (await request.json()) as CreateUserBody

    const store = getUsersStore()
    const usuarioExistente = store.find((u) => u.email === body.email)
    if (usuarioExistente) {
      // RN-EMP-006: alta cross-empresa de un usuario ya existente está
      // reservada a SUPERADMIN (vía asignación en /admin/empresas/:id/usuarios).
      // Si el email pertenece a un usuario que ya está en ESTA empresa, es un
      // duplicado normal; si solo existe en otra(s) empresa(s), el mensaje debe
      // explicar por qué el alta fue rechazada en vez de un 409 genérico.
      const yaEnEstaEmpresa = getUsuarioEmpresaStore().some(
        (ue) => ue.usuarioId === usuarioExistente.id && ue.empresaId === empresaActivaId,
      )
      if (yaEnEstaEmpresa) {
        return err('El email ya está en uso', 409)
      }
      return err(
        'Este usuario ya está registrado en otra empresa. Para asignarlo también a esta empresa, contacta a un Superadmin.',
        409,
      )
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
      ...(body.areaId ? { areaId: body.areaId } : {}),
      ...(body.areaIds ? { areaIds: body.areaIds } : {}),
    }
    if (body.avatarBase64) {
      // MockUser.avatarUrl está tipado `undefined` (semilla fija sin avatar); el CRUD real
      // de esta spec es el primer productor de avatarUrl, de ahí el cast puntual.
      ;(newUser as unknown as { avatarUrl?: string }).avatarUrl = body.avatarBase64
    }

    store.push(newUser)

    // Un usuario recién creado necesita al menos una fila UsuarioEmpresa
    // activa para poder loguearse (empresa-session, me-f2-sesion-rbac-login)
    // — sin esto, POST /api/auth/login lo rechazaría por "sin empresa
    // asignada". Se asigna a la empresa activa de quien lo crea (antes de
    // me-f4-admin-empresas se hardcodeaba a 'empresa-001' siempre — bug
    // descubierto en implementación, ver design.md de esta fase).
    getUsuarioEmpresaStore().push({
      usuarioId: newUser.id,
      empresaId: empresaActivaId,
      rol: newUser.rol,
      estado: 'ACTIVO',
      fechaAsignacion: now,
    })

    return ok({ ...stripPassword(newUser), temporaryPassword }, 201)
  }),

  // PATCH /api/users/:id — edición (RN-USR-006), solo si pertenece a la empresa activa
  http.patch('/api/users/:id', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireUsuarioDeEmpresaActiva(params.id as string, request)
    if ('error' in auth) return auth.error
    const { empresaActivaId } = auth

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
      // rol deliberadamente NO se toca aquí: `Usuario.rol` es un campo global
      // compartido por todas las empresas del usuario, mientras que el rol
      // efectivo (RN-EMP-002) vive exclusivamente en `UsuarioEmpresa.rol` por
      // empresa — escribirlo aquí filtraba el rol editado en una empresa hacia
      // el rol mostrado/leído en las demás (bug reportado: cambiar el rol en
      // Empresa 1 se reflejaba en Empresa 2).
      ...(body.areaId !== undefined ? { areaId: body.areaId } : {}),
      ...(body.areaIds !== undefined ? { areaIds: body.areaIds } : {}),
      ...(body.avatarBase64 !== undefined
        ? ({ avatarUrl: body.avatarBase64 } as unknown as { avatarUrl: undefined })
        : {}),
    }
    store[idx] = updated

    // Único lugar donde se persiste el cambio de rol: la fila UsuarioEmpresa
    // de la empresa activa de quien edita. Un ADMINISTRADOR_EMPRESA nunca
    // puede alterar el rol de este usuario en OTRA empresa a la que también
    // esté asignado (esa es responsabilidad exclusiva de SUPERADMIN, RN-EMP-006).
    let rolEfectivo = current.rol
    if (body.rol !== undefined) {
      getUsuarioEmpresaStore()
        .filter((ue) => ue.usuarioId === updated.id && ue.empresaId === empresaActivaId)
        .forEach((ue) => {
          ue.rol = body.rol as UserRole
        })
      rolEfectivo = body.rol
    }

    return ok({ ...stripPassword(updated), rol: rolEfectivo })
  }),

  // PATCH /api/users/:id/toggle-active — baja/reactivación (RN-USR-001, RN-USR-003)
  http.patch('/api/users/:id/toggle-active', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireUsuarioDeEmpresaActiva(params.id as string, request)
    if ('error' in auth) return auth.error

    const store = getUsersStore()
    const idx = store.findIndex((u) => u.id === params.id)
    if (idx === -1) return err('Usuario no encontrado', 404)

    const updated: MockUser = { ...store[idx], activo: !store[idx].activo }
    store[idx] = updated

    return ok(stripPassword(updated))
  }),

  // POST /api/users/:id/reset-password — reset por admin (RN-USR-004)
  http.post('/api/users/:id/reset-password', async ({ params, request }) => {
    await delay(LATENCY)
    const auth = requireUsuarioDeEmpresaActiva(params.id as string, request)
    if ('error' in auth) return auth.error

    const store = getUsersStore()
    const idx = store.findIndex((u) => u.id === params.id)
    if (idx === -1) return err('Usuario no encontrado', 404)

    const temporaryPassword = generateTemporaryPassword()
    store[idx] = { ...store[idx], password: temporaryPassword }

    return ok({ temporaryPassword })
  }),
]
