import { http, HttpResponse, delay } from 'msw'
import { authFixtures, MOCK_RESET_TOKEN } from '../fixtures/auth.fixtures'

const LATENCY = 400

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, message }, { status })
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email?: string; password?: string }
    const user = authFixtures.find(
      (u) => u.email === body.email && u.password === body.password,
    )
    if (!user) {
      return err('Credenciales inválidas', 401)
    }
    const { password: _pw, ...userWithoutPassword } = user
    return ok({
      accessToken: `mock-access-token-${user.id}-${Date.now()}`,
      user: userWithoutPassword,
    })
  }),

  http.post('/api/auth/logout', async () => {
    await delay(LATENCY)
    return ok(null)
  }),

  http.post('/api/auth/refresh', async () => {
    await delay(LATENCY)
    return ok({ accessToken: `mock-access-token-refreshed-${Date.now()}` })
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
]
