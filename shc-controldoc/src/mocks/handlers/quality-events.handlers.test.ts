import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { qualityEventHandlers, getQeStore, resetStore } from './quality-events.handlers'
import { incidentHandlers, getIncidentsStore, resetStore as resetIncidentsStore } from './incidents.handlers'
import { nonconformityHandlers, getNonconformitiesStore, resetStore as resetNonconformitiesStore } from './nonconformities.handlers'
import { useAuthStore } from '../../stores/authStore'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { QualityEvent } from '../../features/quality-events/types/qualityEvent.types'
import type { Incidente } from '../../features/incidents/types/incident.types'
import type { NoConformidad } from '../../features/nonconformities/types/nonconformity.types'

const server = setupServer(...qualityEventHandlers, ...incidentHandlers, ...nonconformityHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetStore()
  resetIncidentsStore()
  resetNonconformitiesStore()
  resetNotificationsStore()
})

function baseIncidente(overrides: Partial<Incidente>): Incidente {
  const now = '2026-01-01T00:00:00Z'
  return {
    id: 'inc-test-001',
    numero: 'INC-TEST-001',
    tipo: 'INCIDENTE',
    estado: 'EN_INVESTIGACION',
    severidad: 'MEDIA',
    descripcion: 'Incidente de prueba con descripción suficientemente larga',
    areaId: 'area-001',
    turno: 'DIA',
    fechaEvento: now,
    fechaReporte: now,
    reportadoPorId: 'user-operario-001',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: now,
    actualizadoEn: now,
    ...overrides,
  }
}

function baseNC(overrides: Partial<NoConformidad>): NoConformidad {
  const now = '2026-01-01T00:00:00Z'
  return {
    id: 'nc-test-001',
    numero: 'NC-CAL-2026-001',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'MEDIA',
    estado: 'ABIERTA',
    descripcion: 'No conformidad de prueba con descripción suficientemente larga',
    areaId: 'area-001',
    reportadoPorId: 'user-operario-001',
    fechaDeteccion: now,
    fechaReporte: now,
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: now,
    actualizadoEn: now,
    ...overrides,
  }
}

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

function setCurrentUser(id: string, rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD_SYST' | 'ALTA_DIRECCION' | 'AUDITOR_INTERNO') {
  useAuthStore.setState({
    user: { id, nombre: 'Test', apellido: 'User', email: `${id}@shac.internal`, rol },
    isAuthenticated: true,
    accessToken: 'token',
  })
}

function baseQE(overrides: Partial<QualityEvent>): QualityEvent {
  const now = '2026-01-01T00:00:00Z'
  return {
    id: 'qe-test-001',
    numero: 'QE-TEST-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'MEDIA',
    estado: 'EN_EJECUCION',
    ciclo: 1,
    descripcion: 'Descripción de prueba',
    areaId: 'Almacén Norte',
    turno: 'DIA',
    fechaHoraEvento: now,
    fechaHoraReporte: now,
    reportadoPorId: 'user-operario-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: now,
    actualizadoEn: now,
    ...overrides,
  }
}

describe('quality-events.handlers — AC sub-resource notifications', () => {
  it('notifies the responsable when a new AC is created', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getQeStore().push(baseQE({ id: 'qe-test-ac-create', numero: 'QE-TEST-AC-CREATE' }))

    const { status } = await call(
      api.post('/api/quality-events/qe-test-ac-create/acciones-correctivas', {
        descripcion: 'AC de prueba',
        responsableId: 'user-operario-001',
        plazoFecha: '2026-08-01',
        prioridad: 'MEDIA',
      }),
    )
    expect(status).toBe(201)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-operario-001' && n.entidadId === 'qe-test-ac-create' && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeDefined()
  })

  it('notifies the new responsable and not the previous one on reassignment', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getQeStore().push(
      baseQE({
        id: 'qe-test-ac-reassign',
        numero: 'QE-TEST-AC-REASSIGN',
        accionesCorrectivas: [
          {
            id: 'ac-reassign-1',
            qeId: 'qe-test-ac-reassign',
            descripcion: 'AC de prueba',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: '2026-08-01',
            estado: 'PENDIENTE',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z',
            solicitudesAjustePlazo: [],
          },
        ],
      }),
    )

    const { status } = await call(
      api.patch('/api/quality-events/qe-test-ac-reassign/acciones-correctivas/ac-reassign-1', {
        responsableId: 'user-auditor-001',
      }),
    )
    expect(status).toBe(200)

    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-auditor-001' && n.entidadId === 'qe-test-ac-reassign' && n.tipo === 'ASIGNACION',
      ),
    ).toBeDefined()
    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-operario-001' && n.entidadId === 'qe-test-ac-reassign',
      ),
    ).toBeUndefined()
  })

  it('notifies JEFE_CALIDAD_SYST users, excluding the acting user, on auto-transition to PENDIENTE_CIERRE', async () => {
    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    getQeStore().push(
      baseQE({
        id: 'qe-test-auto-transition',
        numero: 'QE-TEST-AUTO',
        estado: 'EN_EJECUCION',
        accionesCorrectivas: [
          {
            id: 'ac-auto-1',
            qeId: 'qe-test-auto-transition',
            descripcion: 'Última AC pendiente',
            responsableId: 'user-operario-001',
            responsableNombre: 'Luis Quispe',
            plazoFecha: '2026-08-01',
            estado: 'EN_EJECUCION',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z',
            solicitudesAjustePlazo: [],
          },
        ],
      }),
    )

    const { status } = await call(
      api.patch('/api/quality-events/qe-test-auto-transition/acciones-correctivas/ac-auto-1/status', {
        estado: 'CERRADA',
        descripcionEvidencia: 'Evidencia de cierre',
      }),
    )
    expect(status).toBe(200)
    expect(getQeStore().find((q) => q.id === 'qe-test-auto-transition')?.estado).toBe('PENDIENTE_CIERRE')

    // user-jefecalidad-001 is the acting user — must NOT notify themselves.
    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-jefecalidad-001' && n.entidadId === 'qe-test-auto-transition',
      ),
    ).toBeUndefined()
    // user-005 is also JEFE_CALIDAD_SYST in the fixtures — must be notified.
    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-005' && n.entidadId === 'qe-test-auto-transition' && n.tipo === 'CAMBIO_ESTADO',
      ),
    ).toBeDefined()
  })
})

describe('quality-events.handlers — firmar-cierre notifications', () => {
  it('notifies the reporter, and Gerencia when severidad is CRITICA, on CERRADO transition', async () => {
    getQeStore().push(
      baseQE({
        id: 'qe-test-cierre',
        numero: 'QE-TEST-CIERRE',
        estado: 'PENDIENTE_CIERRE',
        severidad: 'CRITICA',
        reportadoPorId: 'user-operario-001',
        resultadoCierre: 'Cierre de prueba con más de cien caracteres para pasar la validación mínima requerida por el formulario.',
        cerradoPorId: 'user-jefecalidad-001',
      }),
    )

    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    const { status, data } = await call(
      api.patch<QualityEvent>('/api/quality-events/qe-test-cierre/firmar-cierre', {
        rol: 'SUPERVISOR',
        pin: '1234',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('CERRADO')

    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-operario-001' && n.entidadId === 'qe-test-cierre' && n.tipo === 'CAMBIO_ESTADO',
      ),
    ).toBeDefined()
    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-gerencia-001' && n.entidadId === 'qe-test-cierre' && n.tipo === 'CAMBIO_ESTADO',
      ),
    ).toBeDefined()
  })
})

describe('quality-events.handlers — forzar-vencimiento-verificacion notifications', () => {
  it('notifies the assigned auditor when forcing CERRADO → EN_VERIFICACION', async () => {
    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    getQeStore().push(baseQE({ id: 'qe-test-forzar-cerrado', numero: 'QE-TEST-FORZAR', estado: 'CERRADO' }))

    const { status, data } = await call(
      api.patch<QualityEvent>('/api/quality-events/qe-test-forzar-cerrado/forzar-vencimiento-verificacion', {
        auditorAsignadoId: 'user-auditor-001',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('EN_VERIFICACION')

    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-auditor-001' && n.entidadId === 'qe-test-forzar-cerrado' && n.tipo === 'ASIGNACION',
      ),
    ).toBeDefined()
  })

  it('notifies Gerencia, Jefe de Calidad, area Supervisor, and the reporter when forcing a EN_VERIFICACION vencimiento reapertura', async () => {
    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    getQeStore().push(
      baseQE({
        id: 'qe-test-forzar-verif',
        numero: 'QE-TEST-FORZAR-VERIF',
        estado: 'EN_VERIFICACION',
        areaId: 'area-010',
        reportadoPorId: 'user-operario-001',
      }),
    )

    const { status, data } = await call(
      api.patch<QualityEvent>('/api/quality-events/qe-test-forzar-verif/forzar-vencimiento-verificacion', {}),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('EN_INVESTIGACION')

    const notified = getNotificationsStore().filter((n) => n.entidadId === 'qe-test-forzar-verif')
    expect(notified.some((n) => n.usuarioId === 'user-gerencia-001')).toBe(true)
    // user-supervisor-001's areasAsignadas includes 'Galpón B'
    expect(notified.some((n) => n.usuarioId === 'user-supervisor-001')).toBe(true)
    expect(notified.some((n) => n.usuarioId === 'user-operario-001')).toBe(true)
  })
})

describe('quality-events.handlers — verificacion-eficacia notifications', () => {
  it('notifies the reporter on EFECTIVO verification', async () => {
    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    getQeStore().push(
      baseQE({
        id: 'qe-test-verif-efectivo',
        numero: 'QE-TEST-VERIF-OK',
        estado: 'EN_VERIFICACION',
        reportadoPorId: 'user-operario-001',
      }),
    )

    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-test-verif-efectivo/verificacion-eficacia', {
        resultado: 'EFECTIVO',
        evidencia: 'Sin recurrencias en 60 días',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('VERIFICADO')

    expect(
      getNotificationsStore().find(
        (n) => n.usuarioId === 'user-operario-001' && n.entidadId === 'qe-test-verif-efectivo' && n.tipo === 'CAMBIO_ESTADO',
      ),
    ).toBeDefined()
  })

  it('notifies Gerencia, Jefe de Calidad, area Supervisor, and the reporter on NO_EFECTIVO reapertura', async () => {
    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    getQeStore().push(
      baseQE({
        id: 'qe-test-verif-noefectivo',
        numero: 'QE-TEST-VERIF-KO',
        estado: 'EN_VERIFICACION',
        areaId: 'area-001',
        reportadoPorId: 'user-operario-001',
      }),
    )

    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-test-verif-noefectivo/verificacion-eficacia', {
        resultado: 'NO_EFECTIVO',
        evidencia: 'Recurrencia detectada',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('EN_INVESTIGACION')

    const notified = getNotificationsStore().filter((n) => n.entidadId === 'qe-test-verif-noefectivo')
    expect(notified.some((n) => n.usuarioId === 'user-gerencia-001')).toBe(true)
    // user-supervisor-002's areasAsignadas includes 'Almacén Norte'
    expect(notified.some((n) => n.usuarioId === 'user-supervisor-002')).toBe(true)
    expect(notified.some((n) => n.usuarioId === 'user-operario-001')).toBe(true)
  })
})

describe('quality-events.handlers — export-pdf', () => {
  it('appends an EXPORTACION_PDF audit entry and returns the updated QE', async () => {
    setCurrentUser('user-jc-001', 'JEFE_CALIDAD_SYST')
    getQeStore().push(baseQE({ id: 'qe-test-export', numero: 'QE-TEST-EXPORT' }))

    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-test-export/export-pdf'),
    )
    expect(status).toBe(200)
    expect(data.auditTrail).toHaveLength(1)
    expect(data.auditTrail[0]).toMatchObject({
      accion: 'EXPORTACION_PDF',
      realizadoPorId: 'user-jc-001',
      generadoPorIA: false,
    })
  })

  it('returns 404 for an unknown id', async () => {
    const { status, data } = await call(
      api.post<{ success: boolean }>('/api/quality-events/does-not-exist/export-pdf'),
    )
    expect(status).toBe(404)
    expect(data.success).toBe(false)
  })

  it('appends a new entry on each consecutive call', async () => {
    setCurrentUser('user-jc-001', 'JEFE_CALIDAD_SYST')
    getQeStore().push(baseQE({ id: 'qe-test-export-2', numero: 'QE-TEST-EXPORT-2' }))

    await call(api.post<QualityEvent>('/api/quality-events/qe-test-export-2/export-pdf'))
    const { data } = await call(api.post<QualityEvent>('/api/quality-events/qe-test-export-2/export-pdf'))

    const exportEntries = data.auditTrail.filter((e) => e.accion === 'EXPORTACION_PDF')
    expect(exportEntries).toHaveLength(2)
    expect(exportEntries[0].timestamp).toBeDefined()
    expect(exportEntries[1].timestamp).toBeDefined()
  })
})

describe('quality-events.handlers — RN-QE-001 vínculo único Incidente → QE (O1_INCIDENTE_CAMPO)', () => {
  const createPayload = (incidenteId: string) => ({
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba con más de diez caracteres',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T08:00',
    incidenteId,
  })

  it('creating a QE from an incident, then linking it back, updates incidente.qeId', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getIncidentsStore().push(baseIncidente({ id: 'inc-test-link', numero: 'INC-TEST-LINK' }))

    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events', createPayload('inc-test-link')),
    )
    expect(status).toBe(201)

    // Mirrors what QualityEventForm does on success: PATCH the incident with the new qeId.
    await call(api.patch('/api/incidents/inc-test-link', { qeId: data.id }))

    expect(getIncidentsStore().find((i) => i.id === 'inc-test-link')?.qeId).toBe(data.id)
  })

  it('rejects a second QE creation for an incident already linked to a QE', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-test-dup', numero: 'INC-TEST-DUP', qeId: 'qe-existing-001' }),
    )

    const { status, data } = await call(
      api.post<{ success: boolean; message: string }>('/api/quality-events', createPayload('inc-test-dup')),
    )

    expect(status).toBe(422)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Este incidente ya tiene un Quality Event vinculado')
  })

  it('allows creation when the incident has no qeId yet', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getIncidentsStore().push(baseIncidente({ id: 'inc-test-free', numero: 'INC-TEST-FREE' }))

    const { status } = await call(
      api.post<QualityEvent>('/api/quality-events', createPayload('inc-test-free')),
    )

    expect(status).toBe(201)
  })
})

describe('quality-events.handlers — RN-QE-013 vínculo único NC → QE (O2_NC_DETECTADA)', () => {
  const createPayload = (ncId: string) => ({
    origen: 'O2_NC_DETECTADA',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba con más de diez caracteres',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T08:00',
    ncId,
  })

  it('creating a QE from a NC, then linking it back, updates nc.qeGeneradoId', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getNonconformitiesStore().push(baseNC({ id: 'nc-test-link', numero: 'NC-CAL-2026-LINK' }))

    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events', createPayload('nc-test-link')),
    )
    expect(status).toBe(201)

    // Mirrors what QualityEventForm does on success: PATCH the NC with the new qeGeneradoId.
    await call(api.patch('/api/nonconformities/nc-test-link', { qeGeneradoId: data.id }))

    expect(getNonconformitiesStore().find((n) => n.id === 'nc-test-link')?.qeGeneradoId).toBe(data.id)
  })

  it('rejects a second QE creation for a NC already linked to a QE', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-test-dup', numero: 'NC-CAL-2026-DUP', qeGeneradoId: 'qe-existing-001' }),
    )

    const { status, data } = await call(
      api.post<{ success: boolean; message: string }>('/api/quality-events', createPayload('nc-test-dup')),
    )

    expect(status).toBe(422)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Esta NC ya tiene un Quality Event vinculado')
  })

  it('allows creation when the NC has no qeGeneradoId yet', async () => {
    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    getNonconformitiesStore().push(baseNC({ id: 'nc-test-free', numero: 'NC-CAL-2026-FREE' }))

    const { status } = await call(
      api.post<QualityEvent>('/api/quality-events', createPayload('nc-test-free')),
    )

    expect(status).toBe(201)
  })
})

describe('quality-events.handlers — sincronización de estado Incidente <- QE', () => {
  it('syncs the linked Incidente to EN_INVESTIGACION when the QE transitions via PATCH /status', async () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-sync-investigacion', numero: 'INC-SYNC-INV', estado: 'ABIERTO', qeId: 'qe-sync-investigacion' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-sync-investigacion',
        numero: 'QE-SYNC-INV',
        estado: 'ABIERTO',
        incidenteId: 'inc-sync-investigacion',
      }),
    )

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-sync-investigacion/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    const inc = getIncidentsStore().find((i) => i.id === 'inc-sync-investigacion')
    expect(inc?.estado).toBe('EN_INVESTIGACION')
    expect(inc?.auditTrail[inc.auditTrail.length - 1]).toMatchObject({
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: 'ABIERTO',
      estadoNuevo: 'EN_INVESTIGACION',
      valorNuevo: 'Sincronizado automáticamente desde QE QE-SYNC-INV',
    })
  })

  it('syncs the linked Incidente to CERRADO when the QE closes via firmar-cierre', async () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-sync-cerrado', numero: 'INC-SYNC-CERRADO', estado: 'EN_EJECUCION', qeId: 'qe-sync-cerrado' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-sync-cerrado',
        numero: 'QE-SYNC-CERRADO',
        estado: 'PENDIENTE_CIERRE',
        incidenteId: 'inc-sync-cerrado',
        resultadoCierre: 'Cierre de prueba con más de cien caracteres para pasar la validación mínima requerida por el formulario.',
        cerradoPorId: 'user-jefecalidad-001',
      }),
    )

    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    const { status, data } = await call(
      api.patch<QualityEvent>('/api/quality-events/qe-sync-cerrado/firmar-cierre', { rol: 'SUPERVISOR', pin: '1234' }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('CERRADO')

    expect(getIncidentsStore().find((i) => i.id === 'inc-sync-cerrado')?.estado).toBe('CERRADO')
  })

  it('reopens the linked Incidente back to EN_INVESTIGACION when the QE verification result is NO_EFECTIVO', async () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-sync-reapertura', numero: 'INC-SYNC-REAPERTURA', estado: 'CERRADO', qeId: 'qe-sync-reapertura' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-sync-reapertura',
        numero: 'QE-SYNC-REAPERTURA',
        estado: 'EN_VERIFICACION',
        incidenteId: 'inc-sync-reapertura',
        areaId: 'area-001',
        reportadoPorId: 'user-operario-001',
      }),
    )

    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-sync-reapertura/verificacion-eficacia', {
        resultado: 'NO_EFECTIVO',
        evidencia: 'Recurrencia detectada',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('EN_INVESTIGACION')

    expect(getIncidentsStore().find((i) => i.id === 'inc-sync-reapertura')?.estado).toBe('EN_INVESTIGACION')
  })

  it('leaves the linked Incidente at CERRADO (no-op) when the QE reaches EN_VERIFICACION or VERIFICADO', async () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-sync-verif', numero: 'INC-SYNC-VERIF', estado: 'CERRADO', qeId: 'qe-sync-verif' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-sync-verif',
        numero: 'QE-SYNC-VERIF',
        estado: 'EN_VERIFICACION',
        incidenteId: 'inc-sync-verif',
        reportadoPorId: 'user-operario-001',
      }),
    )

    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-sync-verif/verificacion-eficacia', {
        resultado: 'EFECTIVO',
        evidencia: 'Sin recurrencias en 60 días',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('VERIFICADO')

    const inc = getIncidentsStore().find((i) => i.id === 'inc-sync-verif')
    expect(inc?.estado).toBe('CERRADO')
    expect(inc?.auditTrail).toHaveLength(0)
  })

  it('does not sync when the QE has no incidenteId linked', async () => {
    getIncidentsStore().push(baseIncidente({ id: 'inc-no-link', numero: 'INC-NO-LINK', estado: 'ABIERTO' }))
    getQeStore().push(baseQE({ id: 'qe-no-link', numero: 'QE-NO-LINK', estado: 'ABIERTO', incidenteId: undefined }))

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-no-link/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    expect(getIncidentsStore().find((i) => i.id === 'inc-no-link')?.estado).toBe('ABIERTO')
  })

  it('does not overwrite an Incidente already ANULADO even if its linked QE transitions (RN-QE-013 shared-helper consistency)', async () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-sync-anulado', numero: 'INC-SYNC-ANULADO', estado: 'ANULADO', qeId: 'qe-sync-anulado' }),
    )
    getQeStore().push(
      baseQE({ id: 'qe-sync-anulado', numero: 'QE-SYNC-ANULADO', estado: 'ABIERTO', incidenteId: 'inc-sync-anulado' }),
    )

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-sync-anulado/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    expect(getIncidentsStore().find((i) => i.id === 'inc-sync-anulado')?.estado).toBe('ANULADO')
  })
})

describe('quality-events.handlers — sincronización de estado NC <- QE (RN-QE-013)', () => {
  it('syncs the linked NC to EN_INVESTIGACION when the QE transitions via PATCH /status', async () => {
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-sync-investigacion', numero: 'NC-CAL-2026-SYNC-INV', estado: 'ABIERTA', qeGeneradoId: 'qe-nc-sync-investigacion' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-nc-sync-investigacion',
        numero: 'QE-NC-SYNC-INV',
        origen: 'O2_NC_DETECTADA',
        estado: 'ABIERTO',
        ncId: 'nc-sync-investigacion',
      }),
    )

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-nc-sync-investigacion/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    const nc = getNonconformitiesStore().find((n) => n.id === 'nc-sync-investigacion')
    expect(nc?.estado).toBe('EN_INVESTIGACION')
    expect(nc?.auditTrail[nc.auditTrail.length - 1]).toMatchObject({
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: 'ABIERTA',
      estadoNuevo: 'EN_INVESTIGACION',
      valorNuevo: 'Sincronizado automáticamente desde QE QE-NC-SYNC-INV',
    })
  })

  it('syncs the linked NC to CERRADA when the QE closes via firmar-cierre', async () => {
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-sync-cerrada', numero: 'NC-CAL-2026-SYNC-CERRADA', estado: 'EN_EJECUCION', qeGeneradoId: 'qe-nc-sync-cerrada' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-nc-sync-cerrada',
        numero: 'QE-NC-SYNC-CERRADA',
        origen: 'O2_NC_DETECTADA',
        estado: 'PENDIENTE_CIERRE',
        ncId: 'nc-sync-cerrada',
        resultadoCierre: 'Cierre de prueba con más de cien caracteres para pasar la validación mínima requerida por el formulario.',
        cerradoPorId: 'user-jefecalidad-001',
      }),
    )

    setCurrentUser('user-supervisor-001', 'SUPERVISOR')
    const { status, data } = await call(
      api.patch<QualityEvent>('/api/quality-events/qe-nc-sync-cerrada/firmar-cierre', { rol: 'SUPERVISOR', pin: '1234' }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('CERRADO')

    expect(getNonconformitiesStore().find((n) => n.id === 'nc-sync-cerrada')?.estado).toBe('CERRADA')
  })

  it('reopens the linked NC back to EN_INVESTIGACION when the QE verification result is NO_EFECTIVO', async () => {
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-sync-reapertura', numero: 'NC-CAL-2026-SYNC-REAPERTURA', estado: 'CERRADA', qeGeneradoId: 'qe-nc-sync-reapertura' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-nc-sync-reapertura',
        numero: 'QE-NC-SYNC-REAPERTURA',
        origen: 'O2_NC_DETECTADA',
        estado: 'EN_VERIFICACION',
        ncId: 'nc-sync-reapertura',
        areaId: 'area-001',
        reportadoPorId: 'user-operario-001',
      }),
    )

    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-nc-sync-reapertura/verificacion-eficacia', {
        resultado: 'NO_EFECTIVO',
        evidencia: 'Recurrencia detectada',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('EN_INVESTIGACION')

    expect(getNonconformitiesStore().find((n) => n.id === 'nc-sync-reapertura')?.estado).toBe('EN_INVESTIGACION')
  })

  it('leaves the linked NC at CERRADA (no-op) when the QE reaches EN_VERIFICACION or VERIFICADO', async () => {
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-sync-verif', numero: 'NC-CAL-2026-SYNC-VERIF', estado: 'CERRADA', qeGeneradoId: 'qe-nc-sync-verif' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-nc-sync-verif',
        numero: 'QE-NC-SYNC-VERIF',
        origen: 'O2_NC_DETECTADA',
        estado: 'EN_VERIFICACION',
        ncId: 'nc-sync-verif',
        reportadoPorId: 'user-operario-001',
      }),
    )

    setCurrentUser('user-auditor-001', 'AUDITOR_INTERNO')
    const { status, data } = await call(
      api.post<QualityEvent>('/api/quality-events/qe-nc-sync-verif/verificacion-eficacia', {
        resultado: 'EFECTIVO',
        evidencia: 'Sin recurrencias en 60 días',
      }),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('VERIFICADO')

    const nc = getNonconformitiesStore().find((n) => n.id === 'nc-sync-verif')
    expect(nc?.estado).toBe('CERRADA')
    expect(nc?.auditTrail).toHaveLength(0)
  })

  it('does not sync when the QE has no ncId linked', async () => {
    getNonconformitiesStore().push(baseNC({ id: 'nc-no-link', numero: 'NC-CAL-2026-NO-LINK', estado: 'ABIERTA' }))
    getQeStore().push(
      baseQE({ id: 'qe-nc-no-link', numero: 'QE-NC-NO-LINK', origen: 'O2_NC_DETECTADA', estado: 'ABIERTO', ncId: undefined }),
    )

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-nc-no-link/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    expect(getNonconformitiesStore().find((n) => n.id === 'nc-no-link')?.estado).toBe('ABIERTA')
  })

  it('does not overwrite a NC already ANULADA even if its linked QE transitions (RN-NC-003)', async () => {
    getNonconformitiesStore().push(
      baseNC({ id: 'nc-sync-anulada', numero: 'NC-CAL-2026-SYNC-ANULADA', estado: 'ANULADA', qeGeneradoId: 'qe-nc-sync-anulada' }),
    )
    getQeStore().push(
      baseQE({
        id: 'qe-nc-sync-anulada',
        numero: 'QE-NC-SYNC-ANULADA',
        origen: 'O2_NC_DETECTADA',
        estado: 'ABIERTO',
        ncId: 'nc-sync-anulada',
      }),
    )

    setCurrentUser('user-jefecalidad-001', 'JEFE_CALIDAD_SYST')
    const { status } = await call(
      api.patch('/api/quality-events/qe-nc-sync-anulada/status', { nuevoEstado: 'EN_INVESTIGACION' }),
    )
    expect(status).toBe(200)

    expect(getNonconformitiesStore().find((n) => n.id === 'nc-sync-anulada')?.estado).toBe('ANULADA')
  })
})
