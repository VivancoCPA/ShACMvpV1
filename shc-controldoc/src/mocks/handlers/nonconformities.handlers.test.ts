import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { nonconformityHandlers, resetStore, getNonconformitiesStore } from './nonconformities.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../fixtures/empresas.fixtures'
import { useAuthStore } from '../../stores/authStore'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { NoConformidad } from '../../features/nonconformities/types/nonconformity.types'

const server = setupServer(...nonconformityHandlers)

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
// empresa ACTIVO de `UsuarioEmpresa`) — los handlers de No Conformidades
// ahora filtran/asignan por empresa activa de sesión (me-f3-scoping-modulos).
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

describe('nonconformities.handlers — PATCH /api/nonconformities/:id notification emission', () => {
  it('notifies the reporter when estado changes', async () => {
    // nc-002's fixture reportadoPorId is user-004, a real resolvable account
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { estado: 'ANALISIS_COMPLETADO' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-004' && n.entidadId === 'nc-002' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('creates no CAMBIO_ESTADO notification when estado is not among the changed fields', async () => {
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { causaRaiz: 'Falta de procedimiento' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.entidadId === 'nc-002' && n.tipo === 'CAMBIO_ESTADO')
    expect(notif).toBeUndefined()
  })

  it('does not notify the acting user when they change their own NC estado', async () => {
    // ana.torres@shac.pe → id user-004, same as nc-002's reportadoPorId
    const { status } = await call(
      api.patch<NoConformidad>(
        '/api/nonconformities/nc-002',
        { estado: 'ANALISIS_COMPLETADO' },
        authHeaders('ana.torres@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.usuarioId === 'user-004' && n.entidadId === 'nc-002')
    expect(notif).toBeUndefined()
  })
})

describe('nonconformities.handlers — empresa isolation (me-f3-scoping-modulos)', () => {
  it('list excludes NCs from another empresa', async () => {
    const { status, data } = await call(
      api.get<{ items: { id: string; empresaId: string }[] }>(
        '/api/nonconformities',
        authHeaders('jefe.calidad@shac.pe'), // empresa-001
      ),
    )
    expect(status).toBe(200)
    expect(data.items.some((nc) => nc.empresaId === 'empresa-002')).toBe(false)
  })

  it('detail returns 404 for an NC belonging to another empresa', async () => {
    // nc-e2-001 belongs to empresa-002; acting session is empresa-001
    const { status } = await call(
      api.get('/api/nonconformities/nc-e2-001', authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('edit on another empresa NC is rejected as not found', async () => {
    // nc-e2-002 (empresa-002, EN_INVESTIGACION) — acting session is empresa-001
    const { status } = await call(
      api.patch(
        '/api/nonconformities/nc-e2-002',
        { causaRaiz: 'Intento cross-empresa' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(404)
    expect(getNonconformitiesStore().find((nc) => nc.id === 'nc-e2-002')!.causaRaiz).toBeUndefined()
  })

  it('anular on another empresa NC is rejected as not found', async () => {
    // nc-e2-001 (empresa-002, ABIERTA) — acting session is empresa-001
    const { status } = await call(
      api.post(
        '/api/nonconformities/nc-e2-001/anular',
        { justificacion: 'Intento cross-empresa' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(404)
    expect(getNonconformitiesStore().find((nc) => nc.id === 'nc-e2-001')!.estado).toBe('ABIERTA')
  })

  it('created NC carries the active empresa and an independent numero sequence', async () => {
    const { status, data } = await call(
      api.post<{ empresaId: string; numero: string }>(
        '/api/nonconformities',
        {
          origen: 'INSPECCION_INTERNA',
          tipo: 'PROCESO',
          severidad: 'MEDIA',
          areaId: 'area-001',
          descripcion: 'NC de prueba para aislamiento multiempresa',
          fechaDeteccion: new Date().toISOString(),
          fechaCierre: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          dominio: 'ADUANERO',
          titulo: 'NC de aislamiento',
        },
        authHeaders('jefe.calidad@ilo.pe'), // empresa-002
      ),
    )
    expect(status).toBe(201)
    expect(data.empresaId).toBe('empresa-002')
    // Only nc-e2-004 (NC-ADU-...-E2-001) is empresa-002/ADUANERO in fixtures — this is the 2nd.
    expect(data.numero).toBe(`NC-ADU-${new Date().getFullYear()}-002`)
  })

  it('does not flag a matching NC from another empresa as a duplicate (RN-NC-005)', async () => {
    // First, create a real NC in empresa-002 (recent creadoEn) that would otherwise match.
    const empresa002Headers = authHeaders('jefe.calidad@ilo.pe')
    const created = await call(
      api.post<{ id: string }>(
        '/api/nonconformities',
        {
          origen: 'INSPECCION_INTERNA',
          tipo: 'PROCESO',
          severidad: 'MEDIA',
          areaId: 'area-005',
          descripcion: 'NC original en empresa-002 para probar falso positivo',
          fechaDeteccion: new Date().toISOString(),
          fechaCierre: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          dominio: 'CALIDAD',
          titulo: 'NC original empresa-002',
        },
        empresa002Headers,
      ),
    )
    expect(created.status).toBe(201)

    // Now create a matching dominio+areaId NC from empresa-001 — must NOT warn.
    const { status, data } = await call(
      api.post<{ warning?: string }>(
        '/api/nonconformities',
        {
          origen: 'INSPECCION_INTERNA',
          tipo: 'PROCESO',
          severidad: 'MEDIA',
          areaId: 'area-005',
          descripcion: 'NC coincidente en empresa-001, no debe marcarse duplicada',
          fechaDeteccion: new Date().toISOString(),
          fechaCierre: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          dominio: 'CALIDAD',
          titulo: 'NC empresa-001',
        },
        authHeaders('jefe.calidad@shac.pe'), // empresa-001
      ),
    )
    expect(status).toBe(201)
    expect(data.warning).toBeUndefined()
  })

  it('create is rejected with 401 when the session has no active empresa', async () => {
    const headers = authHeaders('jefe.calidad@shac.pe')
    useAuthStore.setState({ empresaActivaId: null })
    const { status } = await call(
      api.post(
        '/api/nonconformities',
        {
          origen: 'INSPECCION_INTERNA',
          tipo: 'PROCESO',
          severidad: 'MEDIA',
          areaId: 'area-001',
          descripcion: 'NC sin empresa activa en sesión',
          fechaDeteccion: new Date().toISOString(),
          fechaCierre: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          dominio: 'CALIDAD',
          titulo: 'NC sin empresa',
        },
        headers,
      ),
    )
    expect(status).toBe(401)
  })
})
