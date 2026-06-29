import { http, HttpResponse, delay } from 'msw'
import { incidentFixtures } from '../fixtures/incidents.fixtures'
import { getAutoSeveridad } from '../../features/incidents/utils/incidentSeveridad'
import type {
  Incidente,
  IncidentStatus,
  IncidentType,
  IncidentSeveridad,
  IncidentTurno,
  AuditTrailEntry,
  AccionCorrectivaIncidente,
} from '../../features/incidents/types/incident.types'

const LATENCY = 400

let incidents: Incidente[] = [...incidentFixtures]

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  ABIERTO: ['EN_INVESTIGACION', 'ANULADO'],
  EN_INVESTIGACION: ['ANALISIS_COMPLETADO'],
  ANALISIS_COMPLETADO: ['EN_EJECUCION'],
  EN_EJECUCION: ['PENDIENTE_CIERRE'],
  PENDIENTE_CIERRE: ['CERRADO'],
  CERRADO: [],
  ANULADO: [],
}

function generateId(): string {
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateNumero(): string {
  const year = new Date().getFullYear()
  const count = incidents.length + 1
  return `INC-${year}-${String(count).padStart(3, '0')}`
}

function makeAuditEntry(
  entidadId: string,
  accion: string,
  fields: Partial<AuditTrailEntry> = {},
): AuditTrailEntry {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo: 'Incidente',
    entidadId,
    accion,
    realizadoPorId: 'user-mock-001',
    realizadoPorNombre: 'Usuario Mock',
    timestamp: new Date().toISOString(),
    generadoPorIA: false,
    ...fields,
  }
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number, errors?: string[]) {
  return HttpResponse.json({ success: false, data: null, message, errors }, { status })
}

export const incidentHandlers = [
  // GET /api/incidents — list with filters + pagination
  http.get('/api/incidents', async ({ request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    const tipo = url.searchParams.get('tipo') as IncidentType | null
    const estado = url.searchParams.get('estado') as IncidentStatus | null
    const severidad = url.searchParams.get('severidad') as IncidentSeveridad | null
    const areaId = url.searchParams.get('areaId')
    const turno = url.searchParams.get('turno') as IncidentTurno | null
    const fechaDesde = url.searchParams.get('fechaDesde')
    const fechaHasta = url.searchParams.get('fechaHasta')
    const showDeleted = url.searchParams.get('showDeleted') === 'true'
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)

    let filtered = showDeleted
      ? [...incidents]
      : incidents.filter((inc) => !inc.deletedAt)

    if (tipo) filtered = filtered.filter((inc) => inc.tipo === tipo)
    if (estado) filtered = filtered.filter((inc) => inc.estado === estado)
    if (severidad) filtered = filtered.filter((inc) => inc.severidad === severidad)
    if (areaId) filtered = filtered.filter((inc) => inc.areaId === areaId)
    if (turno && turno !== 'TODOS') filtered = filtered.filter((inc) => inc.turno === turno)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (inc) =>
          inc.numero.toLowerCase().includes(q) || inc.descripcion.toLowerCase().includes(q),
      )
    }
    if (fechaDesde) {
      const since = new Date(fechaDesde).getTime()
      filtered = filtered.filter((inc) => new Date(inc.fechaEvento).getTime() >= since)
    }
    if (fechaHasta) {
      const until = new Date(fechaHasta).getTime()
      filtered = filtered.filter((inc) => new Date(inc.fechaEvento).getTime() <= until)
    }

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return ok({ items, pagination: { page, pageSize, totalItems, totalPages } })
  }),

  // GET /api/incidents/:id — detail (incluyendo eliminados)
  http.get('/api/incidents/:id', async ({ params }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    return ok(inc)
  }),

  // POST /api/incidents — create
  http.post('/api/incidents', async ({ request }) => {
    await delay(LATENCY)

    const body = await request.json() as Record<string, unknown>

    const required = ['tipo', 'descripcion', 'areaId', 'turno', 'fechaEvento', 'huboLesionados']
    const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === '')
    if (missing.length > 0) {
      return err('Validation error', 400, missing.map((f) => `${f} is required`))
    }

    const descripcion = body.descripcion as string
    if (descripcion.length < 20) {
      return err('Validation error', 400, ['descripcion must be at least 20 characters'])
    }

    const tipo = body.tipo as IncidentType
    const numAfectadas = body.numPersonasAfectadas as number | undefined
    const severidad: IncidentSeveridad =
      (body.severidad as IncidentSeveridad | undefined) ?? getAutoSeveridad(tipo, numAfectadas)

    const now = new Date().toISOString()
    const id = generateId()
    const numero = generateNumero()
    const fechaEvento = body.fechaEvento as string

    const auditTrail: AuditTrailEntry[] = [
      makeAuditEntry(id, 'CREADO', { estadoNuevo: 'ABIERTO' }),
    ]

    const eventoMs = new Date(fechaEvento).getTime()
    const nowMs = Date.now()
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (nowMs - eventoMs > twentyFourHours) {
      auditTrail.push(
        makeAuditEntry(id, 'REPORTE_TARDIO', {
          realizadoPorId: 'system',
          realizadoPorNombre: 'Sistema',
          generadoPorIA: true,
        }),
      )
    }

    const newIncident: Incidente = {
      id,
      numero,
      tipo,
      estado: 'ABIERTO',
      severidad,
      descripcion,
      areaId: body.areaId as string,
      turno: body.turno as IncidentTurno,
      fechaEvento,
      fechaReporte: now,
      reportadoPorId: 'user-mock-001',
      huboLesionados: body.huboLesionados as boolean,
      auditTrail,
      accionesCorrectivas: [],
      creadoEn: now,
      actualizadoEn: now,
      ...(numAfectadas !== undefined ? { numPersonasAfectadas: numAfectadas } : {}),
      ...(body.personalInvolucrado ? { personalInvolucrado: body.personalInvolucrado as string[] } : {}),
      ...(body.testigos ? { testigos: body.testigos as string[] } : {}),
      ...(body.equiposInvolucrados ? { equiposInvolucrados: body.equiposInvolucrados as string[] } : {}),
      ...(body.condicionesEntorno ? { condicionesEntorno: body.condicionesEntorno as Incidente['condicionesEntorno'] } : {}),
      ...(body.atencionMedicaRequerida !== undefined ? { atencionMedicaRequerida: body.atencionMedicaRequerida as boolean } : {}),
      ...(body.atencionMedicaDescripcion ? { atencionMedicaDescripcion: body.atencionMedicaDescripcion as string } : {}),
      ...(body.notificacionAmbientalRequerida !== undefined ? { notificacionAmbientalRequerida: body.notificacionAmbientalRequerida as boolean } : {}),
      ...(body.evidencias ? { evidencias: body.evidencias as Incidente['evidencias'] } : {}),
    }

    incidents = [...incidents, newIncident]

    return ok(newIncident, 201)
  }),

  // PATCH /api/incidents/:id — update investigation fields
  http.patch('/api/incidents/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const updated: Incidente = {
      ...inc,
      ...(body as Partial<Incidente>),
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'CAMPO_EDITADO'),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.id ? updated : i))

    return ok(updated)
  }),

  // PATCH /api/incidents/:id/status — transition validation
  http.patch('/api/incidents/:id/status', async ({ params, request }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    const body = await request.json() as Record<string, unknown>
    const nuevoEstado = body.estado as IncidentStatus
    const comentario = body.comentario as string | undefined

    const valid = VALID_TRANSITIONS[inc.estado] ?? []
    if (!valid.includes(nuevoEstado)) {
      return err(
        `Transición inválida: ${inc.estado} → ${nuevoEstado}`,
        422,
      )
    }

    const now = new Date().toISOString()
    const updated: Incidente = {
      ...inc,
      estado: nuevoEstado,
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'ESTADO_CAMBIADO', {
          estadoAnterior: inc.estado,
          estadoNuevo: nuevoEstado,
          ...(comentario ? { valorNuevo: comentario } : {}),
        }),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.id ? updated : i))

    return ok(updated)
  }),

  // DELETE /api/incidents/:id — soft delete (solo ABIERTO)
  http.delete('/api/incidents/:id', async ({ params }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    if (inc.estado !== 'ABIERTO') {
      return err('Solo se pueden eliminar incidentes en estado ABIERTO', 422)
    }

    if (inc.deletedAt) {
      return err('El incidente ya está eliminado', 422)
    }

    const now = new Date().toISOString()
    const updated: Incidente = {
      ...inc,
      deletedAt: now,
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'ELIMINADO', { valorNuevo: now }),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.id ? updated : i))

    return ok(updated)
  }),

  // PATCH /api/incidents/:id/restore — restaurar eliminado
  http.patch('/api/incidents/:id/restore', async ({ params }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    if (!inc.deletedAt) {
      return err('El incidente no está eliminado', 422)
    }

    const now = new Date().toISOString()
    const updated: Incidente = {
      ...inc,
      deletedAt: undefined,
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'RESTAURADO'),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.id ? updated : i))

    return ok(updated)
  }),

  // POST /api/incidents/:id/acciones — crear AC
  http.post('/api/incidents/:id/acciones', async ({ params, request }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.id)
    if (!inc) return err('incidents:errors.notFound', 404)

    const body = await request.json() as Record<string, unknown>
    const required = ['descripcion', 'responsableId', 'fechaLimite']
    const missing = required.filter((f) => !body[f])
    if (missing.length > 0) {
      return err('Validation error', 400, missing.map((f) => `${f} is required`))
    }

    const now = new Date().toISOString()
    const acId = `ac-inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const responsableId = body.responsableId as string

    const newAC: AccionCorrectivaIncidente = {
      id: acId,
      incidenteId: inc.id,
      descripcion: body.descripcion as string,
      responsableId,
      fechaLimite: body.fechaLimite as string,
      estado: 'PENDIENTE',
      creadoEn: now,
      actualizadoEn: now,
      ...(body.evidencia ? { evidencia: body.evidencia as string } : {}),
    }

    const updated: Incidente = {
      ...inc,
      accionesCorrectivas: [...(inc.accionesCorrectivas ?? []), newAC],
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'AC_CREADA', { valorNuevo: acId }),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.id ? updated : i))

    return ok(newAC, 201)
  }),

  // PATCH /api/incidents/:incidenteId/acciones/:acId — actualizar AC
  http.patch('/api/incidents/:incidenteId/acciones/:acId', async ({ params, request }) => {
    await delay(LATENCY)

    const inc = incidents.find((i) => i.id === params.incidenteId)
    if (!inc) return err('incidents:errors.notFound', 404)

    const ac = (inc.accionesCorrectivas ?? []).find((a) => a.id === params.acId)
    if (!ac) return err('incidents:errors.acNotFound', 404)

    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const updatedAC: AccionCorrectivaIncidente = {
      ...ac,
      ...(body as Partial<AccionCorrectivaIncidente>),
      actualizadoEn: now,
    }

    const updatedInc: Incidente = {
      ...inc,
      accionesCorrectivas: (inc.accionesCorrectivas ?? []).map((a) =>
        a.id === params.acId ? updatedAC : a,
      ),
      actualizadoEn: now,
      auditTrail: [
        ...inc.auditTrail,
        makeAuditEntry(inc.id, 'AC_ACTUALIZADA', { valorNuevo: params.acId as string }),
      ],
    }

    incidents = incidents.map((i) => (i.id === params.incidenteId ? updatedInc : i))

    return ok(updatedAC)
  }),
]

