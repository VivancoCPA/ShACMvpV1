import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { incidentHandlers, resetStore, getIncidentsStore } from './incidents.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../fixtures/empresas.fixtures'
import { useAuthStore } from '../../stores/authStore'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { Incidente } from '../../features/incidents/types/incident.types'

const server = setupServer(...incidentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetStore()
  resetNotificationsStore()
})

interface Result<T> {
  status: number
  data: T
}

async function call<T>(promise: Promise<{ data: T; status: number }>): Promise<Result<T>> {
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

// `getSessionUser` (empresa-session, me-f2-sesion-rbac-login) resuelve el
// usuario actuante desde la sesión activa en memoria, no solo del Bearer
// token — este helper pobla `authStore` además de construir el token, para
// que los handlers de dominio reconozcan al usuario de cada fixture.
// `empresaActivaId` se resuelve igual que lo haría un login real (primera
// empresa ACTIVO de `UsuarioEmpresa`) — los handlers de Incidentes ahora
// filtran/asignan por empresa activa de sesión (me-f3-scoping-modulos).
function authHeaders(email: string, empresaId?: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password: _password, ...user } = mockUser
  const accessToken = `mock-access-token-${user.id}-${Date.now()}`
  const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
  const empresaActivaId = empresaId ?? empresasDisponibles[0]?.id ?? null
  useAuthStore.setState({ user, accessToken, isAuthenticated: true, empresaActivaId, empresasDisponibles })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
}

describe('incidents.handlers — PATCH /api/incidents/:id/status notification emission', () => {
  it('notifies the reporter on a valid transition', async () => {
    // inc-005's fixture reportadoPorId is user-005, a real resolvable account
    const { status } = await call(
      api.patch<Incidente>(
        '/api/incidents/inc-005/status',
        { estado: 'PENDIENTE_CIERRE' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-005' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('does not notify the acting user when they perform their own transition', async () => {
    // luis.paredes@shac.pe → id user-005, same as inc-005's reportadoPorId
    const { status } = await call(
      api.patch<Incidente>(
        '/api/incidents/inc-005/status',
        { estado: 'PENDIENTE_CIERRE' },
        authHeaders('luis.paredes@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-005')
    expect(notif).toBeUndefined()
  })
})

describe('incidents.handlers — empresa isolation (me-f3-scoping-modulos)', () => {
  it('list excludes incidents from another empresa', async () => {
    const { status, data } = await call(
      api.get<{ items: { id: string; empresaId: string }[] }>(
        '/api/incidents',
        authHeaders('jefe.calidad@shac.pe'), // empresa-001
      ),
    )
    expect(status).toBe(200)
    expect(data.items.some((i) => i.empresaId === 'empresa-002')).toBe(false)
  })

  it('detail returns 404 for an incident belonging to another empresa', async () => {
    // inc-e2-001 belongs to empresa-002; acting session is empresa-001
    const { status } = await call(
      api.get('/api/incidents/inc-e2-001', authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('status transition on another empresa incident is rejected as not found', async () => {
    // inc-e2-002 (empresa-002, EN_INVESTIGACION) — acting session is empresa-001
    const { status } = await call(
      api.patch(
        '/api/incidents/inc-e2-002/status',
        { estado: 'ANALISIS_COMPLETADO' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(404)
    expect(getIncidentsStore().find((i) => i.id === 'inc-e2-002')!.estado).toBe('EN_INVESTIGACION')
  })

  it('delete on another empresa incident is rejected as not found', async () => {
    // inc-e2-001 (empresa-002, ABIERTO) — acting session is empresa-001
    const { status } = await call(
      api.delete('/api/incidents/inc-e2-001', authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(404)
    expect(getIncidentsStore().find((i) => i.id === 'inc-e2-001')!.deletedAt).toBeUndefined()
  })

  it('created incident carries the active empresa and an independent numero sequence', async () => {
    const { status, data } = await call(
      api.post<{ empresaId: string; numero: string }>(
        '/api/incidents',
        {
          tipo: 'CUASI_ACCIDENTE',
          descripcion: 'Incidente de prueba para aislamiento multiempresa',
          areaId: 'area-007',
          turno: 'DIA',
          fechaEvento: new Date().toISOString(),
          huboLesionados: false,
        },
        authHeaders('jefe.calidad@ilo.pe'), // empresa-002
      ),
    )
    expect(status).toBe(201)
    expect(data.empresaId).toBe('empresa-002')
    // Only 4 empresa-002 fixtures (inc-e2-001..004) exist — this is the 5th.
    expect(data.numero).toBe(`INC-${new Date().getFullYear()}-005`)
  })

  it('create is rejected with 401 when the session has no active empresa', async () => {
    const headers = authHeaders('jefe.calidad@shac.pe')
    useAuthStore.setState({ empresaActivaId: null })
    const { status } = await call(
      api.post(
        '/api/incidents',
        {
          tipo: 'CUASI_ACCIDENTE',
          descripcion: 'Incidente sin empresa activa en sesión',
          areaId: 'area-007',
          turno: 'DIA',
          fechaEvento: new Date().toISOString(),
          huboLesionados: false,
        },
        headers,
      ),
    )
    expect(status).toBe(401)
  })
})
