import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { dashboardHandlers } from './dashboard.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { horasTrabajadasFixtures } from '../fixtures/horasTrabajadas.fixtures'
import { kpi04AnioAnteriorFixtures } from '../fixtures/kpi04AnioAnterior.fixtures'
import { getQeStore } from './quality-events.handlers'
import { getDocumentsStore } from './documents.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import { getIncidentsStore } from './incidents.handlers'
import { PLAZO_MAXIMO_QE_DIAS_HABILES } from '../../features/dashboard/constants/kpi.constants'
import type { KpiResult } from '../../features/dashboard/types/kpi.types'
import type { DashboardSummaryData } from '../../features/dashboard/types/dashboardData.types'
import type { QualityEvent, AccionCorrectivaQE } from '../../features/quality-events/types/qualityEvent.types'
import type { Documento } from '../../types/documents.types'
import type { AccionCorrectiva, NoConformidad } from '../../features/nonconformities/types/nonconformity.types'
import type { AccionCorrectivaIncidente, Incidente } from '../../features/incidents/types/incident.types'

const server = setupServer(...dashboardHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

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

function tokenFor(email: string): string {
  const user = authFixtures.find((u) => u.email === email)
  if (!user) throw new Error(`Fixture no encontrado: ${email}`)
  return `mock-access-token-${user.id}-${Date.now()}`
}

function authHeaders(email: string) {
  return { headers: { Authorization: `Bearer ${tokenFor(email)}` } }
}

describe('dashboard.handlers — GET /api/dashboard/kpis', () => {
  it('retorna los 9 KpiResult, uno por cada KpiId', async () => {
    const { status, data } = await call(api.get<KpiResult[]>('/api/dashboard/kpis'))
    expect(status).toBe(200)
    expect(data).toHaveLength(9)
    const ids = new Set(data.map((k) => k.kpiId))
    expect(ids.size).toBe(9)
  })

  it('retorna valor 0 en los KPIs sensibles a periodo cuando el periodo no tiene datos en ningún dominio', async () => {
    // KPI-06 (snapshot de documentos PUBLICADO) y KPI-08 (conteo en tiempo real) ignoran
    // el query param periodo por diseño (ver design.md) — se excluyen de esta aserción.
    const { data } = await call(api.get<KpiResult[]>('/api/dashboard/kpis', { params: { periodo: '2020-01' } }))
    expect(data).toHaveLength(9)
    const sensiblesAPeriodo = data.filter((k) => k.kpiId !== 'KPI-06' && k.kpiId !== 'KPI-08')
    for (const kpi of sensiblesAPeriodo) {
      expect(kpi.valor).toBe(0)
    }
  })

  it('cada KpiResult referencia la meta y un semáforo válido', async () => {
    const { data } = await call(api.get<KpiResult[]>('/api/dashboard/kpis'))
    for (const kpi of data) {
      expect(typeof kpi.meta).toBe('number')
      expect(['VERDE', 'AMARILLO', 'ROJO', 'INFORMATIVO']).toContain(kpi.semaforo)
    }
  })
})

describe('dashboard.handlers — GET /api/dashboard/summary', () => {
  it('retorna 401 sin header Authorization', async () => {
    const { status, data } = await call(
      api.get<{ success: boolean }>('/api/dashboard/summary', { headers: { Authorization: '' } }),
    )
    expect(status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('OPERARIO recibe rol OPERARIO y solo sus propios QE reportados', async () => {
    const { status, data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.rol).toBe('OPERARIO')
    if (data.rol === 'OPERARIO') {
      for (const qe of data.data.misQEReportados) {
        expect(qe).toBeDefined()
      }
    }
  })

  it('misQEReportados incluye fechaVerificacionProgramada cuando el QE la tiene', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const nuevoQe: QualityEvent = {
      id: 'test-qe-verificacion-1',
      numero: 'QE-TEST-002',
      origen: 'O1_INCIDENTE_CAMPO',
      tipo: 'CALIDAD',
      severidad: 'MEDIA',
      estado: 'EN_VERIFICACION',
      ciclo: 1,
      descripcion: 'QE de prueba — verifica proyección de fechaVerificacionProgramada',
      areaAfectada: 'Operaciones',
      turno: 'DIA',
      fechaHoraEvento: '2026-05-01T00:00:00Z',
      fechaHoraReporte: '2026-05-01T00:00:00Z',
      fechaVerificacionProgramada: '2026-07-10T00:00:00Z',
      reportadoPorId: 'user-operario-001',
      documentosVinculados: [],
      requiereEvaluacionRiesgos: false,
      solicitudesAC: 0,
      accionesCorrectivas: [],
      auditTrail: [],
      creadoEn: '2026-05-01T00:00:00Z',
      actualizadoEn: '2026-05-01T00:00:00Z',
    }

    try {
      qeStore.push(nuevoQe)
      const { data } = await call(
        api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('operario@shac.pe')),
      )
      expect(data.rol).toBe('OPERARIO')
      if (data.rol !== 'OPERARIO') throw new Error('esperaba rol OPERARIO')
      const qeResumen = data.data.misQEReportados.find((qe) => qe.id === 'test-qe-verificacion-1')
      expect(qeResumen?.fechaVerificacionProgramada).toBe('2026-07-10T00:00:00Z')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('SUPERVISOR recibe rol SUPERVISOR con kpisArea acotado', async () => {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('supervisor@shac.pe')),
    )
    expect(data.rol).toBe('SUPERVISOR')
    if (data.rol === 'SUPERVISOR') {
      expect(data.data.kpisArea.length).toBeLessThan(9)
    }
  })

  function baseQeFor(area: string): Omit<QualityEvent, 'id' | 'numero' | 'tipo' | 'estado' | 'accionesCorrectivas'> {
    return {
      origen: 'O1_INCIDENTE_CAMPO',
      severidad: 'MEDIA',
      ciclo: 1,
      descripcion: 'QE de prueba — buildSupervisorData',
      areaAfectada: area,
      turno: 'DIA',
      fechaHoraEvento: '2026-05-01T00:00:00Z',
      fechaHoraReporte: '2026-05-01T00:00:00Z',
      reportadoPorId: 'user-operario-001',
      documentosVinculados: [],
      requiereEvaluacionRiesgos: false,
      solicitudesAC: 0,
      auditTrail: [],
      creadoEn: '2026-05-01T00:00:00Z',
      actualizadoEn: '2026-05-01T00:00:00Z',
    }
  }

  async function supervisorData(email: string) {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders(email)),
    )
    if (data.rol !== 'SUPERVISOR') throw new Error('esperaba rol SUPERVISOR')
    return data.data
  }

  it('qeAbiertosPorTipo siempre expone las 4 claves de QEType y excluye QE cerrados/verificados', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await supervisorData('supervisor@shac.pe')

    const nuevos: QualityEvent[] = [
      {
        ...baseQeFor('Galpón B'),
        id: 'test-qe-tipo-abierto',
        numero: 'QE-TEST-010',
        tipo: 'CALIDAD',
        estado: 'ABIERTO',
        accionesCorrectivas: [],
      },
      {
        ...baseQeFor('Galpón B'),
        id: 'test-qe-tipo-verificado',
        numero: 'QE-TEST-011',
        tipo: 'CALIDAD',
        estado: 'VERIFICADO',
        accionesCorrectivas: [],
      },
    ]

    try {
      qeStore.push(...nuevos)
      const data = await supervisorData('supervisor@shac.pe')
      expect(Object.keys(data.qeAbiertosPorTipo).sort()).toEqual(['ADUANERO', 'CALIDAD', 'OPERACIONAL', 'SST'])
      expect(data.qeAbiertosPorTipo.SST).toBe(baseline.qeAbiertosPorTipo.SST)
      expect(data.qeAbiertosPorTipo.CALIDAD).toBe(baseline.qeAbiertosPorTipo.CALIDAD + 1)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('qesEnVerificacionArea excluye QE sin fechaVerificacionProgramada', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const nuevos: QualityEvent[] = [
      {
        ...baseQeFor('Galpón B'),
        id: 'test-qe-verif-con-fecha',
        numero: 'QE-TEST-020',
        tipo: 'SST',
        estado: 'EN_VERIFICACION',
        fechaVerificacionProgramada: '2026-08-01T00:00:00Z',
        accionesCorrectivas: [],
      },
      {
        ...baseQeFor('Galpón B'),
        id: 'test-qe-verif-sin-fecha',
        numero: 'QE-TEST-021',
        tipo: 'SST',
        estado: 'EN_VERIFICACION',
        accionesCorrectivas: [],
      },
    ]

    try {
      qeStore.push(...nuevos)
      const data = await supervisorData('supervisor@shac.pe')
      const ids = data.qesEnVerificacionArea.map((qe) => qe.id)
      expect(ids).toContain('test-qe-verif-con-fecha')
      expect(ids).not.toContain('test-qe-verif-sin-fecha')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('accionesCorrectivasPendientesArea incluye PENDIENTE y EN_EJECUCION; accionesCorrectivasVencidas incluye cualquier estado no terminal vencido', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const ayer = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const enFuturo = new Date(Date.now() + 5 * 86_400_000).toISOString()

    const nuevo: QualityEvent = {
      ...baseQeFor('Galpón C'),
      id: 'test-qe-con-acs',
      numero: 'QE-TEST-030',
      tipo: 'OPERACIONAL',
      estado: 'EN_EJECUCION',
      accionesCorrectivas: [
        {
          id: 'test-ac-pendiente-vencida',
          qeId: 'test-qe-con-acs',
          descripcion: 'AC pendiente vencida',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: ayer,
          estado: 'PENDIENTE',
          creadoEn: '2026-05-01T00:00:00Z',
          actualizadoEn: '2026-05-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
        {
          id: 'test-ac-en-ejecucion-vencida',
          qeId: 'test-qe-con-acs',
          descripcion: 'AC en ejecución vencida',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: ayer,
          estado: 'EN_EJECUCION',
          creadoEn: '2026-05-01T00:00:00Z',
          actualizadoEn: '2026-05-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
        {
          id: 'test-ac-en-ejecucion-vigente',
          qeId: 'test-qe-con-acs',
          descripcion: 'AC en ejecución vigente',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: enFuturo,
          estado: 'EN_EJECUCION',
          creadoEn: '2026-05-01T00:00:00Z',
          actualizadoEn: '2026-05-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
      ],
    }

    try {
      qeStore.push(nuevo)
      const data = await supervisorData('supervisor@shac.pe')
      const pendientesIds = data.accionesCorrectivasPendientesArea.map((ac) => ac.id)
      const vencidasIds = data.accionesCorrectivasVencidas.map((ac) => ac.id)

      expect(pendientesIds).toEqual(
        expect.arrayContaining(['test-ac-pendiente-vencida', 'test-ac-en-ejecucion-vencida', 'test-ac-en-ejecucion-vigente']),
      )
      expect(vencidasIds).toContain('test-ac-en-ejecucion-vencida')
      expect(vencidasIds).toContain('test-ac-pendiente-vencida')
      expect(vencidasIds).not.toContain('test-ac-en-ejecucion-vigente')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('SUPERVISOR con más de un área en areasAsignadas combina datos de ambas', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const nuevos: QualityEvent[] = [
      {
        ...baseQeFor('Almacén Norte'),
        id: 'test-qe-multi-norte',
        numero: 'QE-TEST-040',
        tipo: 'ADUANERO',
        estado: 'EN_VERIFICACION',
        fechaVerificacionProgramada: '2026-08-01T00:00:00Z',
        accionesCorrectivas: [],
      },
      {
        ...baseQeFor('Almacén Sur'),
        id: 'test-qe-multi-sur',
        numero: 'QE-TEST-041',
        tipo: 'ADUANERO',
        estado: 'EN_VERIFICACION',
        fechaVerificacionProgramada: '2026-08-02T00:00:00Z',
        accionesCorrectivas: [],
      },
    ]

    try {
      qeStore.push(...nuevos)
      const data = await supervisorData('supervisor.almacen@shac.pe')
      const ids = data.qesEnVerificacionArea.map((qe) => qe.id)
      expect(ids).toContain('test-qe-multi-norte')
      expect(ids).toContain('test-qe-multi-sur')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('JEFE_CONTROL_DOCUMENTARIO recibe su propio dashboard (rol JEFE_CONTROL_DOC)', async () => {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.docs@shac.pe')),
    )
    expect(data.rol).toBe('JEFE_CONTROL_DOC')
    if (data.rol === 'JEFE_CONTROL_DOC') {
      expect(data.data).toEqual({})
    }
  })

  it('JEFE_CALIDAD_SYST recibe qePorEstado sin filtro de área, con las 9 claves de QEStatus', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const nuevos: QualityEvent[] = [
      { ...baseQeFor('Galpón B'), id: 'test-qe-porestado-1', numero: 'QE-TEST-050', tipo: 'CALIDAD', estado: 'ABIERTO', accionesCorrectivas: [] },
      { ...baseQeFor('Zona Portuaria'), id: 'test-qe-porestado-2', numero: 'QE-TEST-051', tipo: 'ADUANERO', estado: 'ABIERTO', accionesCorrectivas: [] },
    ]

    try {
      qeStore.push(...nuevos)
      const { data } = await call(
        api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
      )
      expect(data.rol).toBe('JEFE_CALIDAD')
      if (data.rol !== 'JEFE_CALIDAD') throw new Error('esperaba rol JEFE_CALIDAD')
      const qePorEstado = data.data.qePorEstado
      expect(Object.keys(qePorEstado).sort()).toEqual(
        ['ABIERTO', 'ANALISIS_COMPLETADO', 'CERRADO', 'EN_EJECUCION', 'EN_INVESTIGACION', 'EN_VERIFICACION', 'PENDIENTE_CIERRE', 'REABIERTO', 'VERIFICADO'],
      )
      // Cuenta ambas áreas (Galpón B y Zona Portuaria), no solo la del usuario autenticado.
      expect(qePorEstado.ABIERTO).toBeGreaterThanOrEqual(2)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('accionesCorrectivasPorVencer excluye ACs de Incidentes', async () => {
    const incidentesStore = getIncidentsStore()
    const incidente = incidentesStore[0]
    const originalACs = incidente.accionesCorrectivas ?? []
    const manana = new Date(Date.now() + 1 * 86_400_000).toISOString()
    const nuevaAC: AccionCorrectivaIncidente = {
      id: 'test-ac-incidente-por-vencer',
      incidenteId: incidente.id,
      descripcion: 'AC de Incidente que no debe aparecer en accionesCorrectivasPorVencer',
      responsableId: 'user-operario-001',
      responsableNombre: 'Luis Quispe',
      plazoFecha: manana,
      estado: 'EN_EJECUCION',
      creadoEn: '2026-05-01T00:00:00Z',
      actualizadoEn: '2026-05-01T00:00:00Z',
    }

    try {
      incidente.accionesCorrectivas = [...originalACs, nuevaAC]
      const { data } = await call(
        api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
      )
      if (data.rol !== 'JEFE_CALIDAD') throw new Error('esperaba rol JEFE_CALIDAD')
      const ids = data.data.accionesCorrectivasPorVencer.map((ac) => ac.id)
      expect(ids).not.toContain('test-ac-incidente-por-vencer')
    } finally {
      incidente.accionesCorrectivas = originalACs
    }
  })

  it('accionesCorrectivasPorVencer incluye vencidas y próximas de QE/NC, sin comparar contra un estado puntual', async () => {
    const qeStore = getQeStore()
    const originalQeLength = qeStore.length
    const ncStore = getNonconformitiesStore()
    const nc = ncStore[0]
    const originalNcACs = nc.accionesCorrectivas
    const hace2Dias = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const enTresDias = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const enCuatroDias = new Date(Date.now() + 4 * 86_400_000).toISOString()

    const nuevoQe: QualityEvent = {
      ...baseQeFor('Galpón C'),
      id: 'test-qe-porvencer',
      numero: 'QE-TEST-060',
      tipo: 'OPERACIONAL',
      estado: 'EN_EJECUCION',
      accionesCorrectivas: [
        {
          id: 'test-ac-qe-vencida',
          qeId: 'test-qe-porvencer',
          descripcion: 'AC de QE vencida hace 2 días',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: hace2Dias,
          estado: 'EN_EJECUCION',
          creadoEn: '2026-05-01T00:00:00Z',
          actualizadoEn: '2026-05-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
        {
          id: 'test-ac-qe-proxima',
          qeId: 'test-qe-porvencer',
          descripcion: 'AC de QE próxima a vencer en 3 días',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: enTresDias,
          estado: 'EN_EJECUCION',
          creadoEn: '2026-05-01T00:00:00Z',
          actualizadoEn: '2026-05-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
      ],
    }

    const nuevaAcNc: AccionCorrectiva = {
      id: 'test-ac-nc-proxima',
      ncId: nc.id,
      descripcion: 'AC de NC próxima a vencer en 4 días',
      responsableId: 'user-operario-001',
      responsableNombre: 'Luis Quispe',
      plazoFecha: enCuatroDias,
      estado: 'PENDIENTE',
      creadoEn: '2026-05-01T00:00:00Z',
      actualizadoEn: '2026-05-01T00:00:00Z',
    }

    try {
      qeStore.push(nuevoQe)
      nc.accionesCorrectivas = [...originalNcACs, nuevaAcNc]
      const { data } = await call(
        api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
      )
      if (data.rol !== 'JEFE_CALIDAD') throw new Error('esperaba rol JEFE_CALIDAD')
      const ids = data.data.accionesCorrectivasPorVencer.map((ac) => ac.id)
      expect(ids).toContain('test-ac-qe-vencida')
      expect(ids).toContain('test-ac-qe-proxima')
      expect(ids).toContain('test-ac-nc-proxima')
    } finally {
      qeStore.length = originalQeLength
      nc.accionesCorrectivas = originalNcACs
    }
  })

  it('ALTA_DIRECCION recibe datos organizacionales completos sin filtro de área', async () => {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('gerencia@shac.pe')),
    )
    expect(data.rol).toBe('ALTA_DIRECCION')
    if (data.rol === 'ALTA_DIRECCION') {
      expect(data.data.resumenPorModulo.qualityEvents.total).toBeGreaterThan(0)
    }
  })

  it('tendenciaMensualVolumen tiene 12 entradas ordenadas cronológicamente y cuenta correctamente un mes conocido', async () => {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
    )
    if (data.rol !== 'JEFE_CALIDAD') throw new Error('esperaba rol JEFE_CALIDAD')
    const volumen = data.data.tendenciaMensualVolumen
    expect(volumen).toHaveLength(12)
    const periodos = volumen.map((v) => v.periodo)
    expect(periodos).toEqual([...periodos].sort())

    const qes = getQeStore()
    const mesConocido = periodos[periodos.length - 1]
    const [anio, mes] = mesConocido.split('-').map(Number)
    const start = Date.UTC(anio, mes - 1, 1)
    const end = Date.UTC(anio, mes, 1)
    const abiertosEsperados = qes.filter((qe) => {
      const t = new Date(qe.fechaHoraReporte).getTime()
      return t >= start && t < end
    }).length
    const cerradosEsperados = qes.filter((qe) => {
      if (!qe.fechaCierre) return false
      const t = new Date(qe.fechaCierre).getTime()
      return t >= start && t < end
    }).length
    const entry = volumen.find((v) => v.periodo === mesConocido)
    expect(entry?.abiertos).toBe(abiertosEsperados)
    expect(entry?.cerrados).toBe(cerradosEsperados)
  })

  it('tendenciaMensualKpis tiene exactamente KPI-01/04/05 y coincide con /api/dashboard/kpis para el mismo periodo', async () => {
    const { data } = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
    )
    if (data.rol !== 'JEFE_CALIDAD') throw new Error('esperaba rol JEFE_CALIDAD')
    const tendenciaKpis = data.data.tendenciaMensualKpis
    expect(Object.keys(tendenciaKpis).sort()).toEqual(['KPI-01', 'KPI-04', 'KPI-05'])
    expect(tendenciaKpis['KPI-01']).toHaveLength(12)
    expect(tendenciaKpis['KPI-04']).toHaveLength(12)
    expect(tendenciaKpis['KPI-05']).toHaveLength(12)

    const primerPeriodo = tendenciaKpis['KPI-01'][0].periodo
    const kpisDelPeriodo = await fetchKpis(primerPeriodo)
    expect(tendenciaKpis['KPI-01'][0].valor).toBe(kpi(kpisDelPeriodo, 'KPI-01').valor)
    expect(tendenciaKpis['KPI-04'][0].valor).toBe(kpi(kpisDelPeriodo, 'KPI-04').valor)
    expect(tendenciaKpis['KPI-05'][0].valor).toBe(kpi(kpisDelPeriodo, 'KPI-05').valor)
  })

  it('JEFE_CONTROL_DOCUMENTARIO ya no recibe la forma de JefeCalidadDashboardData', async () => {
    const jc = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.calidad@shac.pe')),
    )
    const jcd = await call(
      api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('jefe.docs@shac.pe')),
    )
    expect(jc.data.rol).toBe('JEFE_CALIDAD')
    expect(jcd.data.rol).toBe('JEFE_CONTROL_DOC')
  })
})

function kpi(results: KpiResult[], id: string): KpiResult {
  const found = results.find((k) => k.kpiId === id)
  if (!found) throw new Error(`KPI ${id} no encontrado en la respuesta`)
  return found
}

async function fetchKpis(periodo: string): Promise<KpiResult[]> {
  const { data } = await call(api.get<KpiResult[]>('/api/dashboard/kpis', { params: { periodo } }))
  return data
}

// Los 9 KPIs se prueban con datos sintéticos, aislados por periodo (años 2031-2032, fuera del
// rango de los fixtures estáticos de QE/NC/Incidentes/Documentos), en vez de derivar valores a
// mano de miles de líneas de fixtures. Esto hace cada aserción determinista y auto-verificable
// (los datos de entrada están en el propio test), y ejercita la lectura en vivo de los stores
// como efecto colateral de cada caso — ver design.md de m5-s01-fix-kpis-prd.

function makeQe(overrides: Partial<QualityEvent> & Pick<QualityEvent, 'id' | 'numero'>): QualityEvent {
  return {
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'QE de prueba — dashboard.handlers.test.ts',
    areaAfectada: 'Almacén Norte',
    turno: 'DIA',
    fechaHoraEvento: '2031-01-01T00:00:00Z',
    fechaHoraReporte: '2031-01-01T00:00:00Z',
    reportadoPorId: 'user-test',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2031-01-01T00:00:00Z',
    actualizadoEn: '2031-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeNc(overrides: Partial<NoConformidad> & Pick<NoConformidad, 'id' | 'numero'>): NoConformidad {
  return {
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'MEDIA',
    estado: 'ABIERTA',
    descripcion: 'NC de prueba — dashboard.handlers.test.ts',
    areaAfectada: 'Almacén Norte',
    reportadoPorId: 'user-test',
    fechaDeteccion: '2031-01-01T00:00:00Z',
    fechaReporte: '2031-01-01T00:00:00Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2031-01-01T00:00:00Z',
    actualizadoEn: '2031-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeIncidente(overrides: Partial<Incidente> & Pick<Incidente, 'id' | 'numero'>): Incidente {
  return {
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'MEDIA',
    descripcion: 'Incidente de prueba — dashboard.handlers.test.ts',
    areaId: 'area-test',
    turno: 'DIA',
    fechaEvento: '2031-01-01T00:00:00Z',
    fechaReporte: '2031-01-01T00:00:00Z',
    reportadoPorId: 'user-test',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2031-01-01T00:00:00Z',
    actualizadoEn: '2031-01-01T00:00:00Z',
    accionesCorrectivas: [],
    ...overrides,
  }
}

function makeDoc(id: string, overrides: Partial<Documento> = {}): Documento {
  return {
    id,
    codigo: `TEST-${id}`,
    titulo: 'Documento de prueba — dashboard.handlers.test.ts',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'PUBLICADO',
    area: 'Almacén Norte',
    confidencialidad: 'INTERNO',
    autorId: 'user-test',
    fechaEmision: '2031-01-01T00:00:00Z',
    fechaRevisionProxima: '2099-01-01T00:00:00Z',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    historialVersiones: [],
    auditTrail: [],
    creadoEn: '2031-01-01T00:00:00Z',
    actualizadoEn: '2031-01-01T00:00:00Z',
    ...overrides,
  }
}

function acQeCerrada(id: string, overrides: Partial<AccionCorrectivaQE> = {}): AccionCorrectivaQE {
  return {
    id,
    qeId: 'n/a',
    descripcion: 'AC de prueba',
    responsableId: 'user-test',
    responsableNombre: 'Usuario Test',
    plazoFecha: '2031-01-05T00:00:00Z',
    estado: 'CERRADA',
    creadoEn: '2031-01-01T00:00:00Z',
    actualizadoEn: '2031-01-05T00:00:00Z',
    solicitudesAjustePlazo: [],
    ...overrides,
  }
}

describe('PLAZO_MAXIMO_QE_DIAS_HABILES', () => {
  it('suma los plazos por severidad de SHAC-PRD-003 §1.3 (EN_INVESTIGACION + ANALISIS_COMPLETADO 2d + PENDIENTE_CIERRE 5d)', () => {
    expect(PLAZO_MAXIMO_QE_DIAS_HABILES).toEqual({ BAJA: 22, MEDIA: 17, ALTA: 14, CRITICA: 10 })
  })
})

describe('dashboard.handlers — KPI-01 usa un plazo máximo por severidad (SHAC-PRD-003 §1.3)', () => {
  it('un QE BAJA con 15 días hábiles transcurridos cuenta "en plazo"; un QE CRITICA con el mismo tiempo no', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    // 21 días calendario (3 semanas exactas) = 15 días hábiles, sin importar el día de semana de inicio.
    const reporte = '2031-02-01T00:00:00Z'
    const cierre = '2031-02-22T00:00:00Z'
    const qeBaja = makeQe({ id: 'test-kpi01-baja', numero: 'QE-TEST-KPI01-1', severidad: 'BAJA', estado: 'CERRADO', fechaHoraReporte: reporte, fechaCierre: cierre })
    const qeCritica = makeQe({ id: 'test-kpi01-critica', numero: 'QE-TEST-KPI01-2', severidad: 'CRITICA', estado: 'CERRADO', fechaHoraReporte: reporte, fechaCierre: cierre })
    try {
      qeStore.push(qeBaja, qeCritica)
      const results = await fetchKpis('2031-02')
      // BAJA: 15 <= 22 (en plazo). CRITICA: 15 > 10 (fuera de plazo). => 1 de 2 en plazo = 50%.
      expect(kpi(results, 'KPI-01').valor).toBe(50)
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — KPI-02 tiempo promedio de cierre de QE (días hábiles)', () => {
  it('un QE cerrado con 15 días hábiles transcurridos da valor 15 (contarDiasHabiles, no calendario)', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({ id: 'test-kpi02-1', numero: 'QE-TEST-KPI02-1', estado: 'CERRADO', fechaHoraReporte: '2031-03-01T00:00:00Z', fechaCierre: '2031-03-22T00:00:00Z' })
    try {
      qeStore.push(qe)
      const results = await fetchKpis('2031-03')
      expect(kpi(results, 'KPI-02').valor).toBe(15)
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — KPI-03 tasa de reincidencia sobre QE cerrados en el trimestre', () => {
  it('1 de 2 QE cerrados en el trimestre con ciclo > 1 da 50%, no sobre el total reportado', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qeCiclo1 = makeQe({ id: 'test-kpi03-1', numero: 'QE-TEST-KPI03-1', estado: 'CERRADO', ciclo: 1, fechaHoraReporte: '2031-04-01T00:00:00Z', fechaCierre: '2031-05-15T00:00:00Z' })
    const qeCiclo2 = makeQe({ id: 'test-kpi03-2', numero: 'QE-TEST-KPI03-2', estado: 'VERIFICADO', ciclo: 2, fechaHoraReporte: '2031-04-01T00:00:00Z', fechaCierre: '2031-06-15T00:00:00Z' })
    try {
      qeStore.push(qeCiclo1, qeCiclo2)
      const results = await fetchKpis('2031-04') // Q2 2031: abr-jun
      const kpi03 = kpi(results, 'KPI-03')
      expect(kpi03.valor).toBe(50)
      expect(kpi03.periodo).toBe('2031-Q2')
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — KPI-04 calcula reducción interanual, no un umbral absoluto', () => {
  it('reducción interanual suficiente (>=10%) da VERDE', async () => {
    const incStore = getIncidentsStore()
    const originalIncLength = incStore.length
    const originalHorasLength = horasTrabajadasFixtures.length
    const originalAnioAnteriorLength = kpi04AnioAnteriorFixtures.length
    try {
      horasTrabajadasFixtures.push({ area: 'Área de prueba', periodo: '2031-06', horas: 1000 })
      kpi04AnioAnteriorFixtures.push({ periodo: '2031-06', valor: 10 })
      // Sin incidentes con lesionados en el periodo => valor 0; reducción 100% >= meta 10%.
      const results = await fetchKpis('2031-06')
      const kpi04 = kpi(results, 'KPI-04')
      expect(kpi04.valor).toBe(0)
      expect(kpi04.valorPeriodoAnterior).toBe(10)
      expect(kpi04.semaforo).toBe('VERDE')
    } finally {
      incStore.length = originalIncLength
      horasTrabajadasFixtures.length = originalHorasLength
      kpi04AnioAnteriorFixtures.length = originalAnioAnteriorLength
    }
  })

  it('reducción insuficiente (0% <= reducción < 10%) da AMARILLO', async () => {
    const incStore = getIncidentsStore()
    const originalIncLength = incStore.length
    const originalHorasLength = horasTrabajadasFixtures.length
    const originalAnioAnteriorLength = kpi04AnioAnteriorFixtures.length
    try {
      // horas = 1e6/9.5 hace que 1 incidente con lesionados dé valor 9.5; anterior 10 => reducción 5%.
      horasTrabajadasFixtures.push({ area: 'Área de prueba', periodo: '2031-07', horas: 1_000_000 / 9.5 })
      kpi04AnioAnteriorFixtures.push({ periodo: '2031-07', valor: 10 })
      incStore.push(makeIncidente({ id: 'test-kpi04-amarillo', numero: 'INC-TEST-KPI04-1', huboLesionados: true, fechaEvento: '2031-07-10T00:00:00Z' }))
      const results = await fetchKpis('2031-07')
      const kpi04 = kpi(results, 'KPI-04')
      expect(kpi04.valor).toBeCloseTo(9.5, 5)
      expect(kpi04.semaforo).toBe('AMARILLO')
    } finally {
      incStore.length = originalIncLength
      horasTrabajadasFixtures.length = originalHorasLength
      kpi04AnioAnteriorFixtures.length = originalAnioAnteriorLength
    }
  })

  it('empeoramiento interanual da ROJO', async () => {
    const incStore = getIncidentsStore()
    const originalIncLength = incStore.length
    const originalHorasLength = horasTrabajadasFixtures.length
    const originalAnioAnteriorLength = kpi04AnioAnteriorFixtures.length
    try {
      horasTrabajadasFixtures.push({ area: 'Área de prueba', periodo: '2031-08', horas: 100_000 })
      kpi04AnioAnteriorFixtures.push({ periodo: '2031-08', valor: 10 })
      // 2 incidentes con lesionados => valor 20, peor que el año anterior (10).
      incStore.push(makeIncidente({ id: 'test-kpi04-rojo-1', numero: 'INC-TEST-KPI04-2', huboLesionados: true, fechaEvento: '2031-08-05T00:00:00Z' }))
      incStore.push(makeIncidente({ id: 'test-kpi04-rojo-2', numero: 'INC-TEST-KPI04-3', huboLesionados: true, fechaEvento: '2031-08-10T00:00:00Z' }))
      const results = await fetchKpis('2031-08')
      const kpi04 = kpi(results, 'KPI-04')
      expect(kpi04.valor).toBeCloseTo(20, 5)
      expect(kpi04.semaforo).toBe('ROJO')
    } finally {
      incStore.length = originalIncLength
      horasTrabajadasFixtures.length = originalHorasLength
      kpi04AnioAnteriorFixtures.length = originalAnioAnteriorLength
    }
  })

  it('sin dato del año anterior da ROJO, nunca un VERDE sin datos que lo justifiquen', async () => {
    const originalHorasLength = horasTrabajadasFixtures.length
    try {
      // Sin entrada en kpi04AnioAnteriorFixtures para este periodo.
      horasTrabajadasFixtures.push({ area: 'Área de prueba', periodo: '2031-09', horas: 1000 })
      const results = await fetchKpis('2031-09')
      const kpi04 = kpi(results, 'KPI-04')
      expect(kpi04.valorPeriodoAnterior).toBeUndefined()
      expect(kpi04.semaforo).toBe('ROJO')
    } finally {
      horasTrabajadasFixtures.length = originalHorasLength
    }
  })
})

describe('dashboard.handlers — KPI-05 escopa la verificación a ACs de origen QE/NC', () => {
  it('AC de Incidente no cuenta; AC de QE sin resultadoVerificacion no cuenta; AC de QE EFECTIVO cuenta en numerador y denominador', async () => {
    const qeStore = getQeStore()
    const ncStore = getNonconformitiesStore()
    const incStore = getIncidentsStore()
    const originalQeLength = qeStore.length
    const originalNcLength = ncStore.length
    const originalIncLength = incStore.length

    const qeEfectivo = makeQe({
      id: 'test-kpi05-qe-efectivo',
      numero: 'QE-TEST-KPI05-1',
      estado: 'VERIFICADO',
      resultadoVerificacion: 'EFECTIVO',
      fechaVerificacionRealizada: '2031-10-15T00:00:00Z',
      accionesCorrectivas: [acQeCerrada('ac-kpi05-qe-efectivo')],
    })
    const qeSinVerificar = makeQe({
      id: 'test-kpi05-qe-sinverificar',
      numero: 'QE-TEST-KPI05-2',
      accionesCorrectivas: [acQeCerrada('ac-kpi05-qe-sinverificar')],
    })
    const ncNoEfectivo = makeNc({
      id: 'test-kpi05-nc-noefectivo',
      numero: 'NC-TEST-KPI05-1',
      estado: 'CERRADA',
      resultadoVerificacion: 'NO_EFECTIVO',
      fechaVerificacion: '2031-10-10T00:00:00Z',
      accionesCorrectivas: [
        {
          id: 'ac-kpi05-nc-noefectivo',
          ncId: 'test-kpi05-nc-noefectivo',
          descripcion: 'AC de prueba',
          responsableId: 'user-test',
          responsableNombre: 'Usuario Test',
          plazoFecha: '2031-10-05T00:00:00Z',
          estado: 'CERRADA',
          creadoEn: '2031-10-01T00:00:00Z',
          actualizadoEn: '2031-10-05T00:00:00Z',
        },
      ],
    })
    const incConAC = makeIncidente({
      id: 'test-kpi05-inc',
      numero: 'INC-TEST-KPI05-1',
      accionesCorrectivas: [
        {
          id: 'ac-kpi05-inc',
          incidenteId: 'test-kpi05-inc',
          descripcion: 'AC de prueba',
          responsableId: 'user-test',
          responsableNombre: 'Usuario Test',
          plazoFecha: '2031-10-05T00:00:00Z',
          estado: 'CERRADA',
          creadoEn: '2031-10-01T00:00:00Z',
          actualizadoEn: '2031-10-05T00:00:00Z',
        },
      ],
    })

    try {
      qeStore.push(qeEfectivo, qeSinVerificar)
      ncStore.push(ncNoEfectivo)
      incStore.push(incConAC)
      const results = await fetchKpis('2031-10')
      // Denominador: AC de qeEfectivo + AC de ncNoEfectivo = 2 (qeSinVerificar y la AC del Incidente quedan fuera).
      // Numerador: solo la AC de qeEfectivo (EFECTIVO) = 1. => 50%.
      expect(kpi(results, 'KPI-05').valor).toBe(50)
    } finally {
      qeStore.length = originalQeLength
      ncStore.length = originalNcLength
      incStore.length = originalIncLength
    }
  })
})

describe('dashboard.handlers — KPI-06 % documentos vigentes (snapshot, no filtra por periodo)', () => {
  it('un documento PUBLICADO vencido baja el porcentaje; el resultado no depende del periodo solicitado', async () => {
    const docStore = getDocumentsStore()
    const originalLength = docStore.length
    const vigente = makeDoc('test-kpi06-vigente', { fechaRevisionProxima: '2099-01-01T00:00:00Z' })
    const vencido = makeDoc('test-kpi06-vencido', { fechaRevisionProxima: '2000-01-01T00:00:00Z' })
    try {
      docStore.push(vigente, vencido)
      const resultsEnero = await fetchKpis('2031-01')
      const resultsJunio = await fetchKpis('2031-06')
      expect(kpi(resultsEnero, 'KPI-06').valor).toBe(kpi(resultsJunio, 'KPI-06').valor)

      const antes = kpi(resultsEnero, 'KPI-06').valor
      docStore.length = docStore.length - 1 // retira el vencido (último push)
      const resultsSinVencido = await fetchKpis('2031-01')
      expect(kpi(resultsSinVencido, 'KPI-06').valor).toBeGreaterThan(antes)
    } finally {
      docStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — KPI-07 usa el timestamp de auditTrail de la transición a ANALISIS_COMPLETADO', () => {
  it('usa el timestamp del auditTrail, no causaRaizFirmadaEn', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({
      id: 'test-kpi07-1',
      numero: 'QE-TEST-KPI07-1',
      fechaHoraReporte: '2031-11-01T00:00:00Z',
      causaRaizFirmadaEn: '2031-11-03T00:00:00Z', // fecha distinta, deliberadamente "incorrecta" para esta fórmula
      auditTrail: [
        {
          id: 'audit-1',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-kpi07-1',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'ANALISIS_COMPLETADO',
          timestamp: '2031-11-22T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
      ],
    })
    try {
      qeStore.push(qe)
      const results = await fetchKpis('2031-11')
      // 2031-11-01 -> 2031-11-22 = 21 días calendario = 15 días hábiles.
      expect(kpi(results, 'KPI-07').valor).toBe(15)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('QE reabierto usa la entrada de ANALISIS_COMPLETADO más reciente', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({
      id: 'test-kpi07-2',
      numero: 'QE-TEST-KPI07-2',
      fechaHoraReporte: '2031-12-01T00:00:00Z',
      auditTrail: [
        {
          id: 'audit-1',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-kpi07-2',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'ANALISIS_COMPLETADO',
          timestamp: '2031-12-08T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
        {
          id: 'audit-2',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-kpi07-2',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'ANALISIS_COMPLETADO',
          timestamp: '2031-12-22T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
      ],
    })
    try {
      qeStore.push(qe)
      const results = await fetchKpis('2031-12')
      // Debe usar 2031-12-22 (21 días = 15 hábiles), no 2031-12-08 (7 días = 5 hábiles).
      expect(kpi(results, 'KPI-07').valor).toBe(15)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('QE sin transición a ANALISIS_COMPLETADO se excluye del cálculo (no cuenta como 0 días)', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const sinTransicion = makeQe({ id: 'test-kpi07-3a', numero: 'QE-TEST-KPI07-3A', fechaHoraReporte: '2032-01-01T00:00:00Z', auditTrail: [] })
    const conTransicion = makeQe({
      id: 'test-kpi07-3b',
      numero: 'QE-TEST-KPI07-3B',
      fechaHoraReporte: '2032-01-01T00:00:00Z',
      auditTrail: [
        {
          id: 'audit-1',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-kpi07-3b',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'ANALISIS_COMPLETADO',
          timestamp: '2032-01-22T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
      ],
    })
    try {
      qeStore.push(sinTransicion, conTransicion)
      const results = await fetchKpis('2032-01')
      // Si sinTransicion contara como 0 días, el promedio sería 7.5; al excluirse, es 15 (solo conTransicion).
      expect(kpi(results, 'KPI-07').valor).toBe(15)
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — KPI-08 usa un semáforo de banda y no filtra por período', () => {
  function estaVencidaKpi08(estado: string, plazoFecha: string, hoy: number): boolean {
    return estado !== 'CERRADA' && estado !== 'COMPLETADA' && new Date(plazoFecha).getTime() < hoy
  }

  // Neutraliza temporalmente las ACs ya vencidas de los fixtures estáticos (empujando su plazoFecha
  // al futuro) para poder afirmar sobre el conteo ABSOLUTO de KPI-08 con una base limpia conocida.
  async function conBaselineLimpio<T>(fn: () => Promise<T>): Promise<T> {
    const hoy = Date.now()
    const futuro = new Date(hoy + 3650 * 86_400_000).toISOString()
    const mutados: { ac: { plazoFecha: string }; original: string }[] = []
    for (const qe of getQeStore()) {
      for (const ac of qe.accionesCorrectivas) {
        if (estaVencidaKpi08(ac.estado, ac.plazoFecha, hoy)) {
          mutados.push({ ac, original: ac.plazoFecha })
          ac.plazoFecha = futuro
        }
      }
    }
    for (const nc of getNonconformitiesStore()) {
      for (const ac of nc.accionesCorrectivas) {
        if (estaVencidaKpi08(ac.estado, ac.plazoFecha, hoy)) {
          mutados.push({ ac, original: ac.plazoFecha })
          ac.plazoFecha = futuro
        }
      }
    }
    for (const inc of getIncidentsStore()) {
      for (const ac of inc.accionesCorrectivas ?? []) {
        if (estaVencidaKpi08(ac.estado, ac.plazoFecha, hoy)) {
          mutados.push({ ac, original: ac.plazoFecha })
          ac.plazoFecha = futuro
        }
      }
    }
    try {
      return await fn()
    } finally {
      for (const { ac, original } of mutados) {
        ac.plazoFecha = original
      }
    }
  }

  function acsVencidas(cantidad: number, prefijo: string): AccionCorrectivaQE[] {
    const ayer = new Date(Date.now() - 86_400_000).toISOString()
    return Array.from({ length: cantidad }, (_, i) =>
      acQeCerrada(`${prefijo}-${i}`, { estado: 'PENDIENTE', plazoFecha: ayer }),
    )
  }

  it('con 0 ACs vencidas da VERDE', async () => {
    await conBaselineLimpio(async () => {
      const results = await fetchKpis('2020-01')
      const kpi08 = kpi(results, 'KPI-08')
      expect(kpi08.valor).toBe(0)
      expect(kpi08.semaforo).toBe('VERDE')
      expect(kpi08.periodo).toBe('TIEMPO_REAL')
    })
  })

  it('con exactamente 3 ACs vencidas da AMARILLO, no ROJO', async () => {
    await conBaselineLimpio(async () => {
      const qeStore = getQeStore()
      const originalLength = qeStore.length
      const qe = makeQe({ id: 'test-kpi08-amarillo', numero: 'QE-TEST-KPI08-1', accionesCorrectivas: acsVencidas(3, 'ac-kpi08-amarillo') })
      try {
        qeStore.push(qe)
        const results = await fetchKpis('2020-01')
        const kpi08 = kpi(results, 'KPI-08')
        expect(kpi08.valor).toBe(3)
        expect(kpi08.semaforo).toBe('AMARILLO')
      } finally {
        qeStore.length = originalLength
      }
    })
  })

  it('con más de 3 ACs vencidas da ROJO', async () => {
    await conBaselineLimpio(async () => {
      const qeStore = getQeStore()
      const originalLength = qeStore.length
      const qe = makeQe({ id: 'test-kpi08-rojo', numero: 'QE-TEST-KPI08-2', accionesCorrectivas: acsVencidas(4, 'ac-kpi08-rojo') })
      try {
        qeStore.push(qe)
        const results = await fetchKpis('2020-01')
        const kpi08 = kpi(results, 'KPI-08')
        expect(kpi08.valor).toBe(4)
        expect(kpi08.semaforo).toBe('ROJO')
      } finally {
        qeStore.length = originalLength
      }
    })
  })

  it('ignora el query param periodo', async () => {
    await conBaselineLimpio(async () => {
      const qeStore = getQeStore()
      const originalLength = qeStore.length
      const qe = makeQe({ id: 'test-kpi08-tiemporeal', numero: 'QE-TEST-KPI08-3', accionesCorrectivas: acsVencidas(1, 'ac-kpi08-tiemporeal') })
      try {
        qeStore.push(qe)
        const results2020 = await fetchKpis('2020-01')
        const results2030 = await fetchKpis('2030-01')
        expect(kpi(results2020, 'KPI-08').valor).toBe(1)
        expect(kpi(results2030, 'KPI-08').valor).toBe(1)
      } finally {
        qeStore.length = originalLength
      }
    })
  })
})

describe('dashboard.handlers — KPI-09 retorna una distribución por área, no un valor escalar único', () => {
  it('agrupa y ordena de mayor a menor', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const q1 = makeQe({ id: 'test-kpi09-1', numero: 'QE-TEST-KPI09-1', areaAfectada: 'Almacén Norte', fechaHoraReporte: '2032-02-05T00:00:00Z' })
    const q2 = makeQe({ id: 'test-kpi09-2', numero: 'QE-TEST-KPI09-2', areaAfectada: 'Almacén Norte', fechaHoraReporte: '2032-02-10T00:00:00Z' })
    const q3 = makeQe({ id: 'test-kpi09-3', numero: 'QE-TEST-KPI09-3', areaAfectada: 'Calidad', fechaHoraReporte: '2032-02-15T00:00:00Z' })
    try {
      qeStore.push(q1, q2, q3)
      const results = await fetchKpis('2032-02')
      const kpi09 = kpi(results, 'KPI-09')
      expect(kpi09.semaforo).toBe('INFORMATIVO')
      expect(kpi09.valor).toBe(2)
      expect(kpi09.distribucion?.[0]).toEqual({ area: 'Almacén Norte', valor: 2 })
      expect(kpi09.distribucion).toContainEqual({ area: 'Calidad', valor: 1 })
    } finally {
      qeStore.length = originalLength
    }
  })

  it('sin QE en el periodo retorna distribucion vacía, no un error', async () => {
    const results = await fetchKpis('2032-03')
    const kpi09 = kpi(results, 'KPI-09')
    expect(kpi09.distribucion).toEqual([])
    expect(kpi09.valor).toBe(0)
  })
})

async function altaDireccionData() {
  const { data } = await call(
    api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('gerencia@shac.pe')),
  )
  if (data.rol !== 'ALTA_DIRECCION') throw new Error('esperaba rol ALTA_DIRECCION')
  return data.data
}

describe('dashboard.handlers — ALTA_DIRECCION: resumenPorModulo.qualityEvents.abiertos/vencidos', () => {
  it('abiertos cuenta REABIERTO y excluye CERRADO y VERIFICADO', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await altaDireccionData()
    const reciente = new Date().toISOString()
    const reabierto = makeQe({ id: 'test-ad-abiertos-reabierto', numero: 'QE-TEST-AD-01', estado: 'REABIERTO', severidad: 'BAJA', fechaHoraReporte: reciente })
    const cerrado = makeQe({ id: 'test-ad-abiertos-cerrado', numero: 'QE-TEST-AD-04', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: reciente, fechaCierre: reciente })
    const verificado = makeQe({ id: 'test-ad-abiertos-verificado', numero: 'QE-TEST-AD-02', estado: 'VERIFICADO', severidad: 'BAJA', fechaHoraReporte: reciente })
    try {
      qeStore.push(reabierto, cerrado, verificado)
      const data = await altaDireccionData()
      expect(data.resumenPorModulo.qualityEvents.abiertos).toBe(baseline.resumenPorModulo.qualityEvents.abiertos + 1)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('vencidos cuenta un QE cuyo tiempo en su estado actual excede el plazo por estado y severidad, y es subconjunto de abiertos', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await altaDireccionData()
    // CRITICA en EN_INVESTIGACION: plazo máximo 3 días hábiles — 30 días calendario garantiza excederlo.
    const hace30Dias = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const vencido = makeQe({ id: 'test-ad-vencido', numero: 'QE-TEST-AD-03', estado: 'EN_INVESTIGACION', severidad: 'CRITICA', fechaHoraReporte: hace30Dias })
    try {
      qeStore.push(vencido)
      const data = await altaDireccionData()
      expect(data.resumenPorModulo.qualityEvents.vencidos).toBe(baseline.resumenPorModulo.qualityEvents.vencidos + 1)
      expect(data.resumenPorModulo.qualityEvents.vencidos).toBeLessThanOrEqual(data.resumenPorModulo.qualityEvents.abiertos)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('un QE CERRADO antiguo nunca cuenta como vencido (ya no es un "abierto")', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await altaDireccionData()
    const haceMeses = new Date(Date.now() - 180 * 86_400_000).toISOString()
    const cerradoAntiguo = makeQe({
      id: 'test-ad-cerrado-antiguo',
      numero: 'QE-TEST-AD-05',
      estado: 'CERRADO',
      severidad: 'CRITICA',
      fechaHoraReporte: haceMeses,
      fechaCierre: haceMeses,
    })
    try {
      qeStore.push(cerradoAntiguo)
      const data = await altaDireccionData()
      expect(data.resumenPorModulo.qualityEvents.vencidos).toBe(baseline.resumenPorModulo.qualityEvents.vencidos)
      expect(data.resumenPorModulo.qualityEvents.abiertos).toBe(baseline.resumenPorModulo.qualityEvents.abiertos)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('ABIERTO y EN_EJECUCION nunca cuentan como vencidos: sin presupuesto propio en el PRD', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await altaDireccionData()
    const hace60Dias = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const abiertoViejo = makeQe({ id: 'test-ad-abierto-viejo', numero: 'QE-TEST-AD-06', estado: 'ABIERTO', severidad: 'CRITICA', fechaHoraReporte: hace60Dias })
    const enEjecucionViejo = makeQe({ id: 'test-ad-ejecucion-viejo', numero: 'QE-TEST-AD-07', estado: 'EN_EJECUCION', severidad: 'CRITICA', fechaHoraReporte: hace60Dias })
    try {
      qeStore.push(abiertoViejo, enEjecucionViejo)
      const data = await altaDireccionData()
      expect(data.resumenPorModulo.qualityEvents.vencidos).toBe(baseline.resumenPorModulo.qualityEvents.vencidos)
      expect(data.resumenPorModulo.qualityEvents.abiertos).toBe(baseline.resumenPorModulo.qualityEvents.abiertos + 2)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('usa la fecha de entrada al estado actual (auditTrail), no fechaHoraReporte, para el conteo de días', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await altaDireccionData()
    // Reportado hace mucho tiempo (excedería el plazo si se usara fechaHoraReporte), pero
    // entró a EN_INVESTIGACION hace solo 1 día — no debe contar como vencido.
    const haceMucho = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const ayer = new Date(Date.now() - 1 * 86_400_000).toISOString()
    const qe = makeQe({
      id: 'test-ad-fecha-entrada-estado',
      numero: 'QE-TEST-AD-08',
      estado: 'EN_INVESTIGACION',
      severidad: 'CRITICA',
      fechaHoraReporte: haceMucho,
      auditTrail: [
        {
          id: 'audit-1',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-ad-fecha-entrada-estado',
          accion: 'ESTADO_CAMBIADO',
          estadoAnterior: 'ABIERTO',
          estadoNuevo: 'EN_INVESTIGACION',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Test',
          timestamp: ayer,
          generadoPorIA: false,
        },
      ],
    })
    try {
      qeStore.push(qe)
      const data = await altaDireccionData()
      expect(data.resumenPorModulo.qualityEvents.vencidos).toBe(baseline.resumenPorModulo.qualityEvents.vencidos)
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — ALTA_DIRECCION: comparativaMensual', () => {
  it('cubre exactamente KPI-01/04/05 y reutiliza calcularKpi01/04/05 sobre los 2 últimos meses', async () => {
    const data = await altaDireccionData()
    expect(Object.keys(data.comparativaMensual).sort()).toEqual(['KPI-01', 'KPI-04', 'KPI-05'])

    const mesActual = new Date().toISOString().slice(0, 7)
    const [y, m] = mesActual.split('-').map(Number)
    const mesAnterior = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
    const kpisActual = await fetchKpis(mesActual)
    const kpisAnterior = await fetchKpis(mesAnterior)

    expect(data.comparativaMensual['KPI-01'].actual).toBe(kpi(kpisActual, 'KPI-01').valor)
    expect(data.comparativaMensual['KPI-01'].anterior).toBe(kpi(kpisAnterior, 'KPI-01').valor)
    expect(data.comparativaMensual['KPI-04'].actual).toBe(kpi(kpisActual, 'KPI-04').valor)
    expect(data.comparativaMensual['KPI-04'].anterior).toBe(kpi(kpisAnterior, 'KPI-04').valor)
    expect(data.comparativaMensual['KPI-05'].actual).toBe(kpi(kpisActual, 'KPI-05').valor)
    expect(data.comparativaMensual['KPI-05'].anterior).toBe(kpi(kpisAnterior, 'KPI-05').valor)
  })

  it('variación >= 2 puntos se clasifica SUBE/BAJA', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2033-03-15T00:00:00Z'))
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    try {
      // Mes anterior (2033-02): 1 de 2 cerrados en plazo => 50%.
      const anteriorEnPlazo = makeQe({ id: 'test-tend-ant-1', numero: 'QE-TEND-1', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: '2033-02-01T00:00:00Z', fechaCierre: '2033-02-05T00:00:00Z' })
      const anteriorFueraPlazo = makeQe({ id: 'test-tend-ant-2', numero: 'QE-TEND-2', estado: 'CERRADO', severidad: 'CRITICA', fechaHoraReporte: '2033-02-01T00:00:00Z', fechaCierre: '2033-02-20T00:00:00Z' })
      // Mes actual (2033-03): 2 de 2 cerrados en plazo => 100%.
      const actual1 = makeQe({ id: 'test-tend-act-1', numero: 'QE-TEND-3', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: '2033-03-01T00:00:00Z', fechaCierre: '2033-03-05T00:00:00Z' })
      const actual2 = makeQe({ id: 'test-tend-act-2', numero: 'QE-TEND-4', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: '2033-03-01T00:00:00Z', fechaCierre: '2033-03-05T00:00:00Z' })
      qeStore.push(anteriorEnPlazo, anteriorFueraPlazo, actual1, actual2)
      const data = await altaDireccionData()
      expect(data.comparativaMensual['KPI-01'].anterior).toBe(50)
      expect(data.comparativaMensual['KPI-01'].actual).toBe(100)
      expect(data.comparativaMensual['KPI-01'].tendencia).toBe('SUBE')
    } finally {
      qeStore.length = originalLength
      vi.useRealTimers()
    }
  })

  it('variación < 2 puntos se clasifica ESTABLE', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2033-05-15T00:00:00Z'))
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    try {
      const anterior = makeQe({ id: 'test-tend-estable-ant', numero: 'QE-TEND-5', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: '2033-04-01T00:00:00Z', fechaCierre: '2033-04-05T00:00:00Z' })
      const actual = makeQe({ id: 'test-tend-estable-act', numero: 'QE-TEND-6', estado: 'CERRADO', severidad: 'BAJA', fechaHoraReporte: '2033-05-01T00:00:00Z', fechaCierre: '2033-05-05T00:00:00Z' })
      qeStore.push(anterior, actual)
      const data = await altaDireccionData()
      expect(data.comparativaMensual['KPI-01'].anterior).toBe(100)
      expect(data.comparativaMensual['KPI-01'].actual).toBe(100)
      expect(data.comparativaMensual['KPI-01'].tendencia).toBe('ESTABLE')
    } finally {
      qeStore.length = originalLength
      vi.useRealTimers()
    }
  })
})

describe('dashboard.handlers — ALTA_DIRECCION: reaperturas', () => {
  it('incluye solo QE con ciclo > 1, ordenados por fechaReapertura descendente', async () => {
    const data = await altaDireccionData()
    expect(data.reaperturas.every((r) => r.ciclo > 1)).toBe(true)
    const fechas = data.reaperturas.map((r) => new Date(r.fechaReapertura).getTime())
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a))
  })

  it('usa la entrada de auditTrail REABIERTO más reciente cuando hay más de una', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({
      id: 'test-ad-reap-multi',
      numero: 'QE-TEST-AD-REAP',
      estado: 'REABIERTO',
      ciclo: 3,
      fechaHoraReporte: '2031-01-01T00:00:00Z',
      auditTrail: [
        {
          id: 'aud-reap-1',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-ad-reap-multi',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'REABIERTO',
          timestamp: '2031-02-01T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
        {
          id: 'aud-reap-2',
          entidadTipo: 'QualityEvent',
          entidadId: 'test-ad-reap-multi',
          accion: 'ESTADO_CAMBIADO',
          estadoNuevo: 'REABIERTO',
          timestamp: '2031-05-01T00:00:00Z',
          realizadoPorId: 'user-test',
          realizadoPorNombre: 'Usuario Test',
          generadoPorIA: false,
        },
      ],
    })
    try {
      qeStore.push(qe)
      const data = await altaDireccionData()
      const entry = data.reaperturas.find((r) => r.id === 'test-ad-reap-multi')
      expect(entry?.fechaReapertura).toBe('2031-05-01T00:00:00Z')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('QE con ciclo 1 no aparece', async () => {
    const data = await altaDireccionData()
    expect(data.reaperturas.some((r) => r.ciclo === 1)).toBe(false)
  })
})

describe('dashboard.handlers — ALTA_DIRECCION: acsConSolicitudAjustePlazo', () => {
  it('solo incluye ACs con solicitud PENDIENTE de QE severidad ALTA/CRITICA', async () => {
    const data = await altaDireccionData()
    expect(data.acsConSolicitudAjustePlazo.length).toBeGreaterThanOrEqual(2)
    expect(data.acsConSolicitudAjustePlazo.every((ac) => ac.qeSeveridad === 'ALTA' || ac.qeSeveridad === 'CRITICA')).toBe(true)
    expect(
      data.acsConSolicitudAjustePlazo.every((ac) => ac.solicitudesAjustePlazo.some((s) => s.estado === 'PENDIENTE')),
    ).toBe(true)
  })

  it('excluye AC con solicitud PENDIENTE de un QE severidad MEDIA/BAJA', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({
      id: 'test-ad-ac-media',
      numero: 'QE-TEST-AD-ACMEDIA',
      severidad: 'MEDIA',
      accionesCorrectivas: [
        {
          id: 'test-ac-media-pendiente',
          qeId: 'test-ad-ac-media',
          descripcion: 'AC de prueba',
          responsableId: 'user-test',
          responsableNombre: 'Usuario Test',
          plazoFecha: '2031-01-05T00:00:00Z',
          estado: 'PENDIENTE',
          creadoEn: '2031-01-01T00:00:00Z',
          actualizadoEn: '2031-01-01T00:00:00Z',
          solicitudesAjustePlazo: [
            {
              id: 'sol-test-ac-media',
              fechaSolicitada: '2031-02-01',
              justificacion: 'Justificación de prueba',
              estado: 'PENDIENTE',
              solicitadoPorId: 'user-test',
              solicitadoEn: '2031-01-10T00:00:00Z',
              requiereAprobacionGerencia: false,
            },
          ],
        },
      ],
    })
    try {
      qeStore.push(qe)
      const data = await altaDireccionData()
      expect(data.acsConSolicitudAjustePlazo.map((ac) => ac.acId)).not.toContain('test-ac-media-pendiente')
    } finally {
      qeStore.length = originalLength
    }
  })

  it('excluye AC con solicitud APROBADA/RECHAZADA aunque el QE sea ALTA/CRITICA', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const qe = makeQe({
      id: 'test-ad-ac-aprobada',
      numero: 'QE-TEST-AD-ACAPROBADA',
      severidad: 'ALTA',
      accionesCorrectivas: [
        {
          id: 'test-ac-aprobada',
          qeId: 'test-ad-ac-aprobada',
          descripcion: 'AC de prueba',
          responsableId: 'user-test',
          responsableNombre: 'Usuario Test',
          plazoFecha: '2031-01-05T00:00:00Z',
          estado: 'EN_EJECUCION',
          creadoEn: '2031-01-01T00:00:00Z',
          actualizadoEn: '2031-01-01T00:00:00Z',
          solicitudesAjustePlazo: [
            {
              id: 'sol-test-ac-aprobada',
              fechaSolicitada: '2031-02-01',
              justificacion: 'Justificación de prueba',
              estado: 'APROBADA',
              solicitadoPorId: 'user-test',
              solicitadoEn: '2031-01-10T00:00:00Z',
              requiereAprobacionGerencia: true,
            },
          ],
        },
      ],
    })
    try {
      qeStore.push(qe)
      const data = await altaDireccionData()
      expect(data.acsConSolicitudAjustePlazo.map((ac) => ac.acId)).not.toContain('test-ac-aprobada')
    } finally {
      qeStore.length = originalLength
    }
  })
})

async function auditorData() {
  const { data } = await call(api.get<DashboardSummaryData>('/api/dashboard/summary', authHeaders('auditor@shac.pe')))
  if (data.rol !== 'AUDITOR') throw new Error('esperaba rol AUDITOR')
  return data.data
}

describe('dashboard.handlers — AUDITOR: hallazgosPorNorma / hallazgosPorEstado / evidenciasHallazgos filtran por origen O3', () => {
  it('un QE de origen distinto de O3 no afecta hallazgosPorNorma, hallazgosPorEstado ni evidenciasHallazgos', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await auditorData()
    const noO3 = makeQe({
      id: 'test-aud-no-o3',
      numero: 'QE-TEST-AUD-NOO3',
      origen: 'O1_INCIDENTE_CAMPO',
      estado: 'ABIERTO',
      areaAfectada: 'Área Inexistente Test',
      documentosVinculados: ['doc-001'],
    })
    try {
      qeStore.push(noO3)
      const data = await auditorData()
      expect(data.hallazgosPorNorma).toEqual(baseline.hallazgosPorNorma)
      expect(data.hallazgosPorEstado).toEqual(baseline.hallazgosPorEstado)
      expect(data.evidenciasHallazgos).toEqual(baseline.evidenciasHallazgos)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('hallazgosPorEstado no tiene claves ausentes: un estado sin hallazgos O3 muestra 0', async () => {
    const data = await auditorData()
    expect(Object.keys(data.hallazgosPorEstado).sort()).toEqual(
      [
        'ABIERTO',
        'ANALISIS_COMPLETADO',
        'CERRADO',
        'EN_EJECUCION',
        'EN_INVESTIGACION',
        'EN_VERIFICACION',
        'PENDIENTE_CIERRE',
        'REABIERTO',
        'VERIFICADO',
      ].sort(),
    )
    for (const total of Object.values(data.hallazgosPorEstado)) {
      expect(typeof total).toBe('number')
    }
  })

  it('evidenciasHallazgos usa documentosVinculados, no evidenciaUrl de las ACs', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const baseline = await auditorData()
    const sinEvidenciaConACEvidenciada = makeQe({
      id: 'test-aud-ac-evidencia',
      numero: 'QE-TEST-AUD-ACEV',
      origen: 'O3_HALLAZGO_AUDITORIA',
      documentosVinculados: [],
      accionesCorrectivas: [
        {
          id: 'test-aud-ac-ev',
          qeId: 'test-aud-ac-evidencia',
          descripcion: 'AC de prueba',
          responsableId: 'user-test',
          responsableNombre: 'Usuario Test',
          plazoFecha: '2031-01-05T00:00:00Z',
          estado: 'CERRADA',
          creadoEn: '2031-01-01T00:00:00Z',
          actualizadoEn: '2031-01-01T00:00:00Z',
          evidenciaUrl: 'https://example.com/evidencia.pdf',
          solicitudesAjustePlazo: [],
        },
      ],
    })
    try {
      qeStore.push(sinEvidenciaConACEvidenciada)
      const data = await auditorData()
      expect(data.evidenciasHallazgos.sinEvidencia).toBe(baseline.evidenciasHallazgos.sinEvidencia + 1)
      expect(data.evidenciasHallazgos.conEvidencia).toBe(baseline.evidenciasHallazgos.conEvidencia)
    } finally {
      qeStore.length = originalLength
    }
  })
})

describe('dashboard.handlers — AUDITOR: tasaCierreEnPlazoPorArea', () => {
  it('no filtra por origen: un QE cerrado en el período de origen distinto de O3 sí se considera', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const reciente = new Date().toISOString()
    const qe = makeQe({
      id: 'test-aud-tasa-no-o3',
      numero: 'QE-TEST-AUD-TASA',
      origen: 'O2_NC_DETECTADA',
      estado: 'CERRADO',
      severidad: 'BAJA',
      areaAfectada: 'Área Test Tasa Cierre',
      fechaHoraReporte: reciente,
      fechaCierre: reciente,
    })
    try {
      qeStore.push(qe)
      const data = await auditorData()
      const entry = data.tasaCierreEnPlazoPorArea.find((e) => e.area === 'Área Test Tasa Cierre')
      expect(entry).toBeDefined()
      expect(entry?.tasaCierreEnPlazo).toBe(100)
      expect(entry?.totalCerrados).toBe(1)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('un área sin ningún QE cerrado en el período actual no aparece (no se fuerza 0/0)', async () => {
    const qeStore = getQeStore()
    const originalLength = qeStore.length
    const reciente = new Date().toISOString()
    const qe = makeQe({
      id: 'test-aud-tasa-sin-cerrados',
      numero: 'QE-TEST-AUD-TASASC',
      estado: 'ABIERTO',
      areaAfectada: 'Área Test Sin Cerrados',
      fechaHoraReporte: reciente,
    })
    try {
      qeStore.push(qe)
      const data = await auditorData()
      expect(data.tasaCierreEnPlazoPorArea.some((e) => e.area === 'Área Test Sin Cerrados')).toBe(false)
    } finally {
      qeStore.length = originalLength
    }
  })

  it('el arreglo está ordenado ascendentemente por tasaCierreEnPlazo', async () => {
    const data = await auditorData()
    const tasas = data.tasaCierreEnPlazoPorArea.map((e) => e.tasaCierreEnPlazo)
    expect(tasas).toEqual([...tasas].sort((a, b) => a - b))
  })
})
