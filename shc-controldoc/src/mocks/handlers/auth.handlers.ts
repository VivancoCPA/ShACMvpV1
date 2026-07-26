import { http, HttpResponse, delay } from 'msw'
import { authFixtures, getUsersStore, MOCK_RESET_TOKEN, type MockUser } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario, getRolEfectivo } from '../fixtures/empresas.fixtures'
import type { Empresa } from '../../features/empresas/types/empresa.types'
import type { User } from '../../types/auth.types'

const LATENCY = 400
// MSW's Service Worker can't set a real httpOnly cookie from a synthetic
// Response in the browser (see src/lib/mockSession.ts), so the mock refresh
// token travels as an explicit header instead of Set-Cookie/Cookie.
const REFRESH_HEADER = 'x-mock-refresh-token'
// Same rationale, for the empresa activa persisted across page reloads
// (see src/lib/mockSession.ts, persistActiveEmpresaId/readActiveEmpresaId).
const EMPRESA_ACTIVA_HEADER = 'x-mock-empresa-activa'

function ok<T>(data: T, status = 200, headers?: HeadersInit) {
  return HttpResponse.json({ success: true, data }, { status, headers })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, message }, { status })
}

function issueRefreshToken(userId: string): string {
  return `mock-refresh-token-${userId}-${Date.now()}`
}

function readRefreshUserId(request: Request): string | undefined {
  const token = request.headers.get(REFRESH_HEADER)
  const match = token ? /^mock-refresh-token-(.+)-\d{13}$/.exec(token) : null
  return match?.[1]
}

function readAccessUserId(request: Request): string | undefined {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  const match = token ? /^mock-access-token-(?:refreshed-)?(.+)-\d{13}$/.exec(token) : null
  return match?.[1]
}

interface ResolvedSession {
  user: User
  empresaActivaId: string | null
  empresasDisponibles: Empresa[]
}

interface SelectionRequired {
  requiresEmpresaSelection: true
  empresasDisponibles: Empresa[]
}

/**
 * Resuelve la empresa activa y el rol efectivo de `user` contra
 * `UsuarioEmpresa` (ver empresa-session capability):
 * - una sola empresa asignada → autoselección, `empresaId` se ignora si vino
 * - más de una y sin `empresaId` → selección pendiente
 * - `empresaId` presente → se valida contra las asignaciones activas
 */
function resolveSession(
  user: MockUser,
  empresaId?: string,
): ResolvedSession | SelectionRequired | { error: string } {
  if (user.esSuperadminMultiempresa) {
    const { password: _pw, ...userWithoutPassword } = user
    return {
      user: { ...userWithoutPassword, rol: 'SUPERADMIN' },
      empresaActivaId: null,
      empresasDisponibles: [],
    }
  }

  const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
  if (empresasDisponibles.length === 0) {
    return { error: 'El usuario no tiene ninguna empresa asignada' }
  }

  const resolvedEmpresaId =
    empresasDisponibles.length === 1 ? empresasDisponibles[0].id : empresaId
  if (!resolvedEmpresaId) {
    return { requiresEmpresaSelection: true, empresasDisponibles }
  }

  const rol = getRolEfectivo(user.id, resolvedEmpresaId)
  if (!rol) {
    return { error: 'La empresa indicada no está asignada a este usuario' }
  }

  const { password: _pw, ...userWithoutPassword } = user
  return {
    user: { ...userWithoutPassword, rol },
    empresaActivaId: resolvedEmpresaId,
    empresasDisponibles,
  }
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email?: string; password?: string; empresaId?: string }
    const user = getUsersStore().find(
      (u) => u.email === body.email && u.password === body.password,
    )
    if (!user) {
      return err('Credenciales inválidas', 401)
    }
    if (!user.activo) {
      return err('Usuario deshabilitado, contacte al administrador', 403)
    }

    const resolved = resolveSession(user, body.empresaId)
    if ('error' in resolved) {
      return err(resolved.error, 403)
    }
    if ('requiresEmpresaSelection' in resolved) {
      return ok(resolved)
    }

    // `resolved.user` es una copia tomada en `resolveSession` — actualizar
    // `lastLogin` ahí también, no solo en el fixture crudo, o la respuesta
    // seguiría devolviendo el valor stale de antes de este login.
    user.lastLogin = new Date().toISOString()
    resolved.user.lastLogin = user.lastLogin
    return ok({
      accessToken: `mock-access-token-${user.id}-${Date.now()}`,
      mockRefreshToken: issueRefreshToken(user.id),
      user: resolved.user,
      empresaActivaId: resolved.empresaActivaId,
      empresasDisponibles: resolved.empresasDisponibles,
    })
  }),

  http.post('/api/auth/logout', async () => {
    await delay(LATENCY)
    return ok(null)
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    await delay(LATENCY)
    const userId = readRefreshUserId(request)
    const user = userId ? authFixtures.find((u) => u.id === userId) : undefined
    if (!user) {
      return err('Sesión expirada', 401)
    }

    if (user.esSuperadminMultiempresa) {
      const { password: _pw, ...userWithoutPassword } = user
      return ok({
        accessToken: `mock-access-token-refreshed-${user.id}-${Date.now()}`,
        mockRefreshToken: issueRefreshToken(user.id),
        user: { ...userWithoutPassword, rol: 'SUPERADMIN' },
        empresaActivaId: null,
        empresasDisponibles: [],
      })
    }

    const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
    const empresaActivaHeader = request.headers.get(EMPRESA_ACTIVA_HEADER) ?? undefined
    const empresaActivaId =
      empresaActivaHeader && empresasDisponibles.some((e) => e.id === empresaActivaHeader)
        ? empresaActivaHeader
        : empresasDisponibles[0]?.id
    if (!empresaActivaId) {
      return err('El usuario no tiene ninguna empresa asignada', 401)
    }
    const rol = getRolEfectivo(user.id, empresaActivaId)
    if (!rol) {
      return err('Sesión expirada', 401)
    }

    const { password: _pw, ...userWithoutPassword } = user
    return ok({
      accessToken: `mock-access-token-refreshed-${user.id}-${Date.now()}`,
      mockRefreshToken: issueRefreshToken(user.id),
      user: { ...userWithoutPassword, rol },
      empresaActivaId,
      empresasDisponibles,
    })
  }),

  http.post('/api/auth/switch-empresa', async ({ request }) => {
    await delay(LATENCY)
    const userId = readAccessUserId(request)
    const user = userId ? authFixtures.find((u) => u.id === userId) : undefined
    if (!user) {
      return err('Sesión expirada', 401)
    }
    if (user.esSuperadminMultiempresa) {
      return err('Superadmin no cambia de empresa', 403)
    }

    const body = (await request.json()) as { empresaId?: string }
    if (!body.empresaId) {
      return err('empresaId es requerido', 400)
    }

    const resolved = resolveSession(user, body.empresaId)
    if ('error' in resolved) {
      return err(resolved.error, 403)
    }
    if ('requiresEmpresaSelection' in resolved) {
      // No debería ocurrir: se pasó empresaId explícito, pero por si acaso
      // no matchea ninguna asignación, se trata como empresa inválida.
      return err('La empresa indicada no está asignada a este usuario', 403)
    }

    return ok({
      accessToken: `mock-access-token-${user.id}-${Date.now()}`,
      user: resolved.user,
      empresaActivaId: resolved.empresaActivaId,
      empresasDisponibles: resolved.empresasDisponibles,
    })
  }),

  // Always returns 200 regardless of whether email exists — security: prevents user enumeration
  http.post('/api/auth/forgot-password', async () => {
    await delay(LATENCY)
    return ok(null)
  }),

  http.post('/api/auth/reset-password', async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { token?: string; password?: string }
    if (body.token !== MOCK_RESET_TOKEN) {
      return err('Token inválido o expirado', 400)
    }
    return ok(null)
  }),

  http.post('/api/auth/change-password', async ({ request }) => {
    await delay(LATENCY)
    const userId = readAccessUserId(request)
    const user = userId ? authFixtures.find((u) => u.id === userId) : undefined
    if (!user) {
      return err('Sesión expirada', 401)
    }
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
    if (body.currentPassword !== user.password) {
      return err('Contraseña actual incorrecta', 401)
    }
    user.password = body.newPassword ?? user.password
    return ok(null)
  }),
]
