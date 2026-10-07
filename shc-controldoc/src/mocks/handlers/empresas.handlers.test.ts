import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { empresasHandlers } from './empresas.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { useAuthStore } from '../../stores/authStore'

// Solo cubre PATCH /api/empresas/:id/usuarios/:usuarioId/reset-pin (pin-firma-ui) — el resto
// de empresas.handlers.ts no tenía un archivo de test MSW dedicado antes de este change.

const server = setupServer(...empresasHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null })
  const fixture = authFixtures.find((u) => u.id === 'user-supervisor-001')
  if (fixture) fixture.pin = undefined
})

function authAsSuperadmin() {
  const superadmin = authFixtures.find((u) => u.email === 'superadmin@shac.pe')
  if (!superadmin) throw new Error('Fixture no encontrado: superadmin@shac.pe')
  const accessToken = `mock-access-token-${superadmin.id}-${Date.now()}`
  useAuthStore.setState({
    user: { ...superadmin, rol: 'SUPERADMIN' },
    accessToken,
    isAuthenticated: true,
  })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
}

describe('empresas.handlers — PATCH /api/empresas/:id/usuarios/:usuarioId/reset-pin', () => {
  it('limpia el PIN de un usuario con asignación activa', async () => {
    const fixture = authFixtures.find((u) => u.id === 'user-supervisor-001')
    if (!fixture) throw new Error('Fixture no encontrado: user-supervisor-001')
    fixture.pin = '1234'
    const headers = authAsSuperadmin()

    const res = await api.patch(
      '/api/empresas/empresa-001/usuarios/user-supervisor-001/reset-pin',
      undefined,
      headers,
    )

    expect(res.status).toBe(200)
    expect(fixture.pin).toBeUndefined()
  })

  it('rechaza con 403 a un usuario que no es SUPERADMIN', async () => {
    const other = authFixtures.find((u) => u.email === 'operario@shac.pe')
    if (!other) throw new Error('Fixture no encontrado: operario@shac.pe')
    const accessToken = `mock-access-token-${other.id}-${Date.now()}`
    useAuthStore.setState({ user: other, accessToken, isAuthenticated: true })

    let caught: unknown
    try {
      await api.patch('/api/empresas/empresa-001/usuarios/user-supervisor-001/reset-pin', undefined, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(403)
  })

  it('rechaza con 404 si el usuario no tiene asignación en esa empresa', async () => {
    const headers = authAsSuperadmin()

    let caught: unknown
    try {
      await api.patch('/api/empresas/empresa-999/usuarios/user-supervisor-001/reset-pin', undefined, headers)
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(404)
  })
})
