import { http, HttpResponse, delay } from 'msw'
import { authFixtures, getUsersStore, MOCK_RESET_TOKEN } from '../fixtures/auth.fixtures'

const LATENCY = 400
// MSW's Service Worker can't set a real httpOnly cookie from a synthetic
// Response in the browser (see src/lib/mockSession.ts), so the mock refresh
// token travels as an explicit header instead of Set-Cookie/Cookie.
const REFRESH_HEADER = 'x-mock-refresh-token'

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

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email?: string; password?: string }
    const user = getUsersStore().find(
      (u) => u.email === body.email && u.password === body.password,
    )
    if (!user) {
      return err('Credenciales inválidas', 401)
    }
    if (!user.activo) {
      return err('Usuario deshabilitado, contacte al administrador', 403)
    }
    user.lastLogin = new Date().toISOString()
    const { password: _pw, ...userWithoutPassword } = user
    return ok({
      accessToken: `mock-access-token-${user.id}-${Date.now()}`,
      mockRefreshToken: issueRefreshToken(user.id),
      user: userWithoutPassword,
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
    const { password: _pw, ...userWithoutPassword } = user
    return ok({
      accessToken: `mock-access-token-refreshed-${user.id}-${Date.now()}`,
      mockRefreshToken: issueRefreshToken(user.id),
      user: userWithoutPassword,
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
