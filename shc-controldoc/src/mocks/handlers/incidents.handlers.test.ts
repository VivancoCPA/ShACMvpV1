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
  const { password, ...user } = mockUser
  void password // se descarta: el usuario en sesión nunca lleva la contraseña
  const accessToken = `mock-access-token-${user.id}-${Date.now()}`
  const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
  const empresaActivaId = empresaId ?? empresasDisponibles[0]?.id ?? null
  useAuthStore.setState({ user, accessToken, isAuthenticated: true, empresaActivaId, empresasDisponibles })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
}

// incidentes-qe-estado-alertas (D4): la única transición manual que queda es anular un incidente
// ABIERTO sin QE; el resto del ciclo lo gobierna el QE vinculado (ver quality-events.handlers).
function pushIncidenteAnulable(overrides: Partial<Incidente> = {}): Incidente {
  // Copia de inc-005 (reportadoPorId user-005, cuenta real resoluble) en ABIERTO y sin QE.
  const base = getIncidentsStore().find((i) => i.id === 'inc-005')!
  const inc: Incidente = { ...base, id: 'inc-anulable', estado: 'ABIERTO', qeId: undefined, auditTrail: [], ...overrides }
  getIncidentsStore().push(inc)
  return inc
}

describe('incidents.handlers — PATCH /api/incidents/:id/status notification emission', () => {
  it('notifies the reporter on a valid annulment', async () => {
    pushIncidenteAnulable()
    const { status, data } = await call(
      api.patch<Incidente>('/api/incidents/inc-anulable/status', { estado: 'ANULADO' }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('ANULADO')
    expect(data.auditTrail.at(-1)).toMatchObject({ accion: 'ESTADO_CAMBIADO', estadoAnterior: 'ABIERTO', estadoNuevo: 'ANULADO' })

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-anulable' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('does not notify the acting user when they perform their own annulment', async () => {
    // luis.paredes@shac.pe → id user-005, same as the incident's reportadoPorId
    pushIncidenteAnulable()
    const { status } = await call(
      api.patch<Incidente>('/api/incidents/inc-anulable/status', { estado: 'ANULADO' }, authHeaders('luis.paredes@shac.pe')),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find((n) => n.usuarioId === 'user-005' && n.entidadId === 'inc-anulable')
    expect(notif).toBeUndefined()
  })
})

describe('incidents.handlers — estado y vínculo gobernados por el QE (incidentes-qe-estado-alertas)', () => {
  it('rejects a manual advance with 422 ESTADO_GOBERNADO_POR_QE', async () => {
    pushIncidenteAnulable()
    const { status, data } = await call(
      api.patch<{ errorCode: string }>(
        '/api/incidents/inc-anulable/status',
        { estado: 'EN_INVESTIGACION' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(422)
    expect(data.errorCode).toBe('ESTADO_GOBERNADO_POR_QE')
    expect(getIncidentsStore().find((i) => i.id === 'inc-anulable')!.estado).toBe('ABIERTO')
  })

  it('rejects annulling an incident that has a linked QE', async () => {
    pushIncidenteAnulable({ qeId: 'qe-x' })
    const { status, data } = await call(
      api.patch<{ errorCode: string }>('/api/incidents/inc-anulable/status', { estado: 'ANULADO' }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(422)
    expect(data.errorCode).toBe('ESTADO_GOBERNADO_POR_QE')
  })

  it('rejects PATCH /:id with a different qeId (QE_VINCULO_GESTIONADO_POR_QE)', async () => {
    pushIncidenteAnulable()
    const { status, data } = await call(
      api.patch<{ errorCode: string }>('/api/incidents/inc-anulable', { qeId: 'qe-x' }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(422)
    expect(data.errorCode).toBe('QE_VINCULO_GESTIONADO_POR_QE')
    expect(getIncidentsStore().find((i) => i.id === 'inc-anulable')!.qeId).toBeUndefined()
  })

  it('ignores PATCH /:id with the same qeId it already has', async () => {
    pushIncidenteAnulable({ qeId: 'qe-x' })
    const { status } = await call(
      api.patch('/api/incidents/inc-anulable', { qeId: 'qe-x', condicionesEntorno: ['PISO'] }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)
    expect(getIncidentsStore().find((i) => i.id === 'inc-anulable')!.qeId).toBe('qe-x')
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

describe('incidents.handlers — paridad de nombres y ubicación con el backend (fix-incidentes-detalle-nombres-ubicacion)', () => {
  const nuevoIncidente = {
    tipo: 'CUASI_ACCIDENTE',
    descripcion: 'Incidente de prueba para ubicación en el plano',
    areaId: 'area-007',
    turno: 'DIA',
    fechaEvento: new Date().toISOString(),
    huboLesionados: false,
    localId: 'loc-001',
  }

  it('detalle y listado traen reportadoPorNombre, localNombre y zonaNombre', async () => {
    const headers = authHeaders('jefe.calidad@shac.pe')
    const detalle = await call(api.get<Incidente>('/api/incidents/inc-001', headers))
    expect(detalle.status).toBe(200)
    expect(detalle.data.reportadoPorNombre).toBeTruthy()
    expect(detalle.data.reportadoPorNombre).not.toBe('user-001')
    expect(detalle.data.localNombre).toBe('Almacén Principal')
    expect(detalle.data.zonaNombre).toBe('Zona de Recepción')

    const listado = await call(api.get<{ items: Incidente[] }>('/api/incidents?pageSize=100', headers))
    const item = listado.data.items.find((i) => i.id === 'inc-001')
    expect(item?.reportadoPorNombre).toBe(detalle.data.reportadoPorNombre)
    expect(item?.localNombre).toBe('Almacén Principal')
  })

  it('POST con ubicacionX/ubicacionY devuelve ubicacion anidada y el nombre de quien reporta', async () => {
    const { status, data } = await call(
      api.post<Incidente>('/api/incidents', { ...nuevoIncidente, ubicacionX: 20, ubicacionY: 70 }, authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(201)
    expect(data.ubicacion).toEqual({ x: 20, y: 70 })

    const detalle = await call(api.get<Incidente>(`/api/incidents/${data.id}`, authHeaders('operario@shac.pe')))
    expect(detalle.data.reportadoPorNombre).toBe('Luis Quispe')
  })

  it('POST ignora body.ubicacion (contrato del backend real)', async () => {
    const { data } = await call(
      api.post<Incidente>('/api/incidents', { ...nuevoIncidente, ubicacion: { x: 1, y: 2 } }, authHeaders('operario@shac.pe')),
    )
    expect(data.ubicacion).toBeUndefined()
  })

  it('PATCH con ubicacionX/ubicacionY actualiza la ubicación sin guardar los campos planos', async () => {
    const { data } = await call(
      api.patch<Incidente & { ubicacionX?: number }>(
        '/api/incidents/inc-001',
        { ubicacionX: 33, ubicacionY: 44 },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(data.ubicacion).toEqual({ x: 33, y: 44 })
    expect(data.ubicacionX).toBeUndefined()
    expect(getIncidentsStore().find((i) => i.id === 'inc-001')?.ubicacion).toEqual({ x: 33, y: 44 })
  })
})
