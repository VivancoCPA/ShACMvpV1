import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import axios, { isAxiosError } from 'axios'
import { accionesCorrectivasHandlers } from './acciones-correctivas.handlers'
import { dashboardHandlers } from './dashboard.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { useAuthStore } from '../../stores/authStore'
import { rangoMesActualLima } from '../../features/acciones-correctivas/utils/limaFechas'
import type { KpiResult } from '../../features/dashboard/types/kpi.types'
import type {
  ACListadoResponse,
  ACOrigen,
  AccionCorrectivaListadoItem,
} from '../../features/acciones-correctivas/types/accionesCorrectivasListado.types'

// modulo-acciones-correctivas: GET /api/acciones-correctivas, /export y /:id/origen en MSW.
const http = axios.create()
const server = setupServer(...accionesCorrectivasHandlers, ...dashboardHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

interface Envelope<T> {
  success: boolean
  data: T
  errorCode?: string
  message?: string
}

function authHeaders(email: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password, ...user } = mockUser
  void password
  const accessToken = `mock-access-token-${user.id}-${Date.now()}`
  useAuthStore.setState({ user, accessToken, isAuthenticated: true, empresaActivaId: 'empresa-001' })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
}

async function get<T>(url: string, email: string): Promise<{ status: number; body: Envelope<T> }> {
  try {
    const res = await http.get<Envelope<T>>(url, authHeaders(email))
    return { status: res.status, body: res.data }
  } catch (error) {
    if (isAxiosError(error) && error.response) return { status: error.response.status, body: error.response.data }
    throw error
  }
}

const listar = (q: string, email = 'jefe.calidad@shac.pe') => get<ACListadoResponse>(`/api/acciones-correctivas${q}`, email)

describe('acciones-correctivas.handlers — listado', () => {
  it('vencidas del listado es igual a KPI-08 para el JCA', async () => {
    const { body } = await listar('')
    const kpis = await get<KpiResult[]>('/api/dashboard/kpis', 'jefe.calidad@shac.pe')
    const kpi08 = kpis.body.data.find((k) => k.kpiId === 'KPI-08')
    expect(body.data.contadores.vencidas).toBe(kpi08?.valor)
  })

  it('los fixtures cubren los seis contadores y los tres orígenes', async () => {
    const { body } = await listar('?pageSize=100')
    const c = body.data.contadores
    expect(c.abiertas).toBeGreaterThan(0)
    expect(c.enEjecucion).toBeGreaterThan(0)
    expect(c.pendientesVerificacion).toBeGreaterThan(0)
    expect(c.porVencer).toBeGreaterThan(0)
    expect(c.vencidas).toBeGreaterThan(0)
    expect(c.cerradasPeriodo).toBeGreaterThan(0)
    const todas = (await get<AccionCorrectivaListadoItem[]>('/api/acciones-correctivas/export', 'jefe.calidad@shac.pe')).body.data
    expect(new Set(todas.map((a) => a.origenTipo))).toEqual(new Set(['QE', 'NC', 'INCIDENTE']))
  })

  it('cada contador es igual al total con su filtro y los filtros de estado no lo cambian', async () => {
    const base = (await listar('')).body.data.contadores
    const mes = rangoMesActualLima()
    const total = async (q: string) => (await listar(q)).body.data.pagination.totalItems

    expect(await total('?estado=PENDIENTE,EN_EJECUCION')).toBe(base.abiertas)
    expect(await total('?estado=EN_EJECUCION')).toBe(base.enEjecucion)
    expect(await total('?estado=PENDIENTE_VERIFICACION')).toBe(base.pendientesVerificacion)
    expect(await total('?porVencer=true')).toBe(base.porVencer)
    expect(await total('?vencida=true')).toBe(base.vencidas)
    expect(await total(`?estado=CERRADA&cerradaDesde=${mes.desde}&cerradaHasta=${mes.hasta}`)).toBe(base.cerradasPeriodo)

    expect((await listar('?vencida=true')).body.data.contadores).toEqual(base)
  })

  it('vencidas primero por defecto y paginación de 25', async () => {
    const { body } = await listar('?pageSize=100')
    const idxNoVencida = body.data.items.findIndex((a) => !a.vencida)
    expect(body.data.items.slice(idxNoVencida).every((a) => !a.vencida)).toBe(true)
    const pagina = (await listar('')).body.data
    expect(pagina.pagination.pageSize).toBe(25)
    expect(pagina.items.length).toBeLessThanOrEqual(25)
  })

  it('el OPERARIO solo ve las AC donde es responsable', async () => {
    const operario = authFixtures.find((u) => u.email === 'operario@shac.pe')!
    const { body } = await listar('?pageSize=100', 'operario@shac.pe')
    expect(body.data.items.every((a) => a.responsableId === operario.id)).toBe(true)
  })

  it('el SUPERVISOR ve las de sus áreas más las suyas', async () => {
    const sup = authFixtures.find((u) => u.email === 'supervisor@shac.pe')!
    const areas = sup.areaIds ?? []
    const { body } = await listar('?pageSize=100', 'supervisor@shac.pe')
    expect(body.data.items.every((a) => areas.includes(a.areaId) || a.responsableId === sup.id)).toBe(true)
    const jca = (await listar('?pageSize=100')).body.data.pagination.totalItems
    expect(body.data.pagination.totalItems).toBeLessThanOrEqual(jca)
  })

  it('roles de administración reciben 403 y parámetros inválidos 400', async () => {
    expect((await listar('', 'admin.empresa@shac.pe')).status).toBe(403)
    expect((await listar('', 'admin@shac.pe')).status).toBe(403)
    expect((await listar('?pageSize=500')).status).toBe(400)
    expect((await listar('?estado=VENCIDA')).status).toBe(400)
  })

  it('export sin paginar respeta filtros', async () => {
    const vencidas = (await listar('')).body.data.contadores.vencidas
    const { status, body } = await get<AccionCorrectivaListadoItem[]>(
      '/api/acciones-correctivas/export?vencida=true',
      'jefe.calidad@shac.pe',
    )
    expect(status).toBe(200)
    expect(body.data).toHaveLength(vencidas)
  })

  it('origen de una AC y 404 si no existe', async () => {
    const item = (await listar('?origenTipo=QE')).body.data.items[0]
    const { body } = await get<ACOrigen>(`/api/acciones-correctivas/${item.id}/origen`, 'operario@shac.pe')
    expect(body.data).toEqual({ origenTipo: 'QE', origenId: item.origenId })
    expect((await get<ACOrigen>('/api/acciones-correctivas/no-existe/origen', 'jefe.calidad@shac.pe')).status).toBe(404)
  })
})
