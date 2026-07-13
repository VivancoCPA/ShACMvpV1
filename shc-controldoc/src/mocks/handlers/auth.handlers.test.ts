import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import api from '../../lib/axios'
import { authHandlers } from './auth.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import type { User } from '../../types/auth.types'

const server = setupServer(...authHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
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
