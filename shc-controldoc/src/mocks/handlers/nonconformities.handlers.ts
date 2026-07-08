import { http, HttpResponse, delay } from 'msw'
import { nonconformityFixtures } from '../fixtures/nonconformities.fixtures'
import { userFixtures, USER_NOMBRE_MAP } from '../fixtures/users.fixtures'
import type {
  NoConformidad,
  NCStatus,
  NCDominio,
  NCTipo,
  NCSeveridad,
  AuditTrailEntry,
  AccionCorrectiva,
} from '../../features/nonconformities/types/nonconformity.types'

const LATENCY = 400

let nonconformities: NoConformidad[] = [...nonconformityFixtures]

// Expone el store mutable en vivo para que otros handlers (p.ej. dashboard.handlers.ts)
// agreguen sobre el estado real de No Conformidades, no sobre el fixture estático.
export function getNonconformitiesStore(): NoConformidad[] {
  return nonconformities
}

const DOMINIO_PREFIX: Record<NCDominio, string> = {
  CALIDAD: 'CAL',
  SST: 'SST',
  ADUANERO: 'ADU',
  OPERACIONAL: 'OPE',
  PROVEEDOR: 'PRV',
}

function generateId(): string {
  return `nc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateNumero(dominio: NCDominio): string {
  const prefix = DOMINIO_PREFIX[dominio]
  const year = new Date().getFullYear()
  const count = nonconformities.filter((nc) => nc.dominio === dominio).length + 1
  return `NC-${prefix}-${year}-${String(count).padStart(3, '0')}`
}

function makeAuditEntry(
  entidadId: string,
  accion: string,
  fields: Partial<AuditTrailEntry> = {},
): AuditTrailEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo: 'NoConformidad',
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

export const nonconformityHandlers = [
  // GET /api/nonconformities — list with filters + pagination
  http.get('/api/nonconformities', async ({ request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    const estado = url.searchParams.get('estado') as NCStatus | null
    const tipo = url.searchParams.get('tipo') as NCTipo | null
    const severidad = url.searchParams.get('severidad') as NCSeveridad | null
    const dominio = url.searchParams.get('dominio') as NCDominio | null
    const areaAfectada = url.searchParams.get('areaAfectada')
    const search = url.searchParams.get('search')
    const fechaDesde = url.searchParams.get('fechaDesde')
    const fechaHasta = url.searchParams.get('fechaHasta')
    const fechaCampo = (url.searchParams.get('fechaCampo') ?? 'fechaDeteccion') as 'fechaDeteccion' | 'fechaCierre'
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)

    const showDeleted = url.searchParams.get('showDeleted') === 'true'

    let filtered = showDeleted
      ? [...nonconformities]
      : nonconformities.filter((nc) => !nc.deletedAt)

    if (estado) filtered = filtered.filter((nc) => nc.estado === estado)
    if (tipo) filtered = filtered.filter((nc) => nc.tipo === tipo)
    if (severidad) filtered = filtered.filter((nc) => nc.severidad === severidad)
    if (dominio) filtered = filtered.filter((nc) => nc.dominio === dominio)
    if (areaAfectada) filtered = filtered.filter((nc) => nc.areaAfectada === areaAfectada)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (nc) =>
          nc.numero.toLowerCase().includes(q) || nc.descripcion.toLowerCase().includes(q),
      )
    }
    if (fechaDesde) {
      const since = new Date(fechaDesde).getTime()
      filtered = filtered.filter((nc) => {
        const val = fechaCampo === 'fechaCierre' ? nc.fechaCierre : nc.fechaDeteccion
        return val ? new Date(val).getTime() >= since : false
      })
    }
    if (fechaHasta) {
      const until = new Date(fechaHasta).getTime()
      filtered = filtered.filter((nc) => {
        const val = fechaCampo === 'fechaCierre' ? nc.fechaCierre : nc.fechaDeteccion
        return val ? new Date(val).getTime() <= until : false
      })
    }

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return ok({ items, pagination: { page, pageSize, totalItems, totalPages } })
  }),

  // GET /api/nonconformities/:id — detail with ACs
  http.get('/api/nonconformities/:id', async ({ params }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.id)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    return ok(nc)
  }),

  // POST /api/nonconformities — create
  http.post('/api/nonconformities', async ({ request }) => {
    await delay(LATENCY)

    const body = await request.json() as Record<string, unknown>

    const required = ['origen', 'tipo', 'severidad', 'areaAfectada', 'descripcion', 'fechaDeteccion', 'dominio', 'titulo', 'fechaCierre']
    const missing = required.filter((f) => !body[f])
    if (missing.length > 0) {
      return err('Validation error', 400, missing.map((f) => `${f} is required`))
    }

    const dominio = body.dominio as NCDominio
    const forzar = body.forzar === true
    const now = new Date().toISOString()
    const id = generateId()
    const numero = generateNumero(dominio)

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const similares = forzar
      ? []
      : nonconformities.filter(
          (nc) =>
            nc.dominio === dominio &&
            nc.areaAfectada === body.areaAfectada &&
            new Date(nc.creadoEn).getTime() > thirtyDaysAgo,
        )

    const newNC: NoConformidad = {
      id,
      numero,
      dominio,
      origen: body.origen as NoConformidad['origen'],
      tipo: body.tipo as NoConformidad['tipo'],
      severidad: body.severidad as NoConformidad['severidad'],
      estado: 'ABIERTA',
      titulo: body.titulo as string,
      descripcion: body.descripcion as string,
      areaAfectada: body.areaAfectada as string,
      fechaCierre: body.fechaCierre as string,
      reportadoPorId: 'user-mock-001',
      fechaDeteccion: body.fechaDeteccion as string,
      fechaReporte: now,
      requiereIPER: (body.requiereIPER as boolean) ?? false,
      accionesCorrectivas: [],
      documentosVinculados: (body.documentosVinculados as string[]) ?? [],
      adjuntos: [],
      auditTrail: [
        makeAuditEntry(id, 'CREADA', { estadoNuevo: 'ABIERTA' }),
      ],
      creadoEn: now,
      actualizadoEn: now,
      ...(body.turno ? { turno: body.turno as NoConformidad['turno'] } : {}),
      ...(body.mineralInvolucrado ? { mineralInvolucrado: body.mineralInvolucrado as string } : {}),
      ...(body.accionInmediata ? { accionInmediata: body.accionInmediata as string } : {}),
      ...(body.detectadoPorId ? { detectadoPorId: body.detectadoPorId as string } : {}),
      ...(body.procesoInvolucrado ? { procesoInvolucrado: body.procesoInvolucrado as string } : {}),
    }

    nonconformities = [...nonconformities, newNC]

    const responseData: NoConformidad & { warning?: string; ncsSimilares?: NoConformidad[] } =
      similares.length > 0
        ? { ...newNC, warning: 'POSIBLE_DUPLICADO', ncsSimilares: similares }
        : newNC

    return ok(responseData, 201)
  }),

  // PATCH /api/nonconformities/:id — update
  http.patch('/api/nonconformities/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.id)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    if (nc.estado === 'CERRADA' || nc.estado === 'ANULADA') {
      return err('nonconformities:errors.editBlockedByStatus', 409)
    }

    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const newAuditEntries: AuditTrailEntry[] = Object.keys(body).map((campo) =>
      makeAuditEntry(nc.id, 'CAMPO_EDITADO', {
        campoModificado: campo,
        valorAnterior: String((nc as Record<string, unknown>)[campo] ?? ''),
        valorNuevo: String(body[campo] ?? ''),
      }),
    )

    const updated: NoConformidad = {
      ...nc,
      ...(body as Partial<NoConformidad>),
      actualizadoEn: now,
      auditTrail: [...nc.auditTrail, ...newAuditEntries],
    }

    nonconformities = nonconformities.map((n) => (n.id === params.id ? updated : n))

    return ok(updated)
  }),

  // DELETE /api/nonconformities/:id — soft delete (solo si ABIERTA)
  http.delete('/api/nonconformities/:id', async ({ params }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.id)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    if (nc.estado !== 'ABIERTA') {
      return err('Solo se pueden eliminar NCs en estado ABIERTA', 422)
    }

    if (nc.deletedAt) {
      return err('La NC ya está eliminada', 422)
    }

    const now = new Date().toISOString()
    const updated: NoConformidad = {
      ...nc,
      deletedAt: now,
      actualizadoEn: now,
      auditTrail: [
        ...nc.auditTrail,
        makeAuditEntry(nc.id, 'ELIMINADA', { valorNuevo: now }),
      ],
    }

    nonconformities = nonconformities.map((n) => (n.id === params.id ? updated : n))
    return ok(updated)
  }),

  // PATCH /api/nonconformities/:id/restore — restaurar NC eliminada
  http.patch('/api/nonconformities/:id/restore', async ({ params }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.id)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    if (!nc.deletedAt) {
      return err('La NC no está eliminada', 422)
    }

    const now = new Date().toISOString()
    const updated: NoConformidad = {
      ...nc,
      deletedAt: undefined,
      actualizadoEn: now,
      auditTrail: [
        ...nc.auditTrail,
        makeAuditEntry(nc.id, 'RESTAURADA', {}),
      ],
    }

    nonconformities = nonconformities.map((n) => (n.id === params.id ? updated : n))
    return ok(updated)
  }),

  // POST /api/nonconformities/:id/anular
  http.post('/api/nonconformities/:id/anular', async ({ params, request }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.id)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    const body = await request.json() as Record<string, unknown>
    const justificacion = body?.justificacion as string | undefined

    if (!justificacion || justificacion.trim() === '') {
      return err('Validation error', 400, ['justificacion is required'])
    }

    const now = new Date().toISOString()
    const updated: NoConformidad = {
      ...nc,
      estado: 'ANULADA',
      justificacionAnulacion: justificacion,
      actualizadoEn: now,
      auditTrail: [
        ...nc.auditTrail,
        makeAuditEntry(nc.id, 'ANULADA', {
          estadoAnterior: nc.estado,
          estadoNuevo: 'ANULADA',
          valorNuevo: justificacion,
        }),
      ],
    }

    nonconformities = nonconformities.map((n) => (n.id === params.id ? updated : n))

    return ok(updated)
  }),

  // POST /api/nonconformities/:ncId/acciones-correctivas — create AC
  http.post('/api/nonconformities/:ncId/acciones-correctivas', async ({ params, request }) => {
    await delay(LATENCY)

    const nc = nonconformities.find((n) => n.id === params.ncId)
    if (!nc) return err('nonconformities:errors.notFound', 404)

    const body = await request.json() as Record<string, unknown>
    const required = ['titulo', 'descripcion', 'responsableId', 'plazoFecha', 'prioridad']
    const missing = required.filter((f) => !body[f])
    if (missing.length > 0) {
      return err('Validation error', 400, missing.map((f) => `${f} is required`))
    }

    const now = new Date().toISOString()
    const acId = `ac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const responsableId = body.responsableId as string

    const newAC: AccionCorrectiva = {
      id: acId,
      ncId: nc.id,
      titulo: body.titulo as string,
      descripcion: body.descripcion as string,
      responsableId,
      responsableNombre: USER_NOMBRE_MAP[responsableId] ?? 'Usuario',
      plazoFecha: body.plazoFecha as string,
      prioridad: body.prioridad as AccionCorrectiva['prioridad'],
      estado: 'PENDIENTE',
      creadoEn: now,
      actualizadoEn: now,
    }

    const updated: NoConformidad = {
      ...nc,
      accionesCorrectivas: [...nc.accionesCorrectivas, newAC],
      actualizadoEn: now,
      auditTrail: [
        ...nc.auditTrail,
        makeAuditEntry(nc.id, 'AC_CREADA', { valorNuevo: acId }),
      ],
    }

    nonconformities = nonconformities.map((n) => (n.id === params.ncId ? updated : n))

    return ok(newAC, 201)
  }),

  // PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId — update AC
  http.patch(
    '/api/nonconformities/:ncId/acciones-correctivas/:acId',
    async ({ params, request }) => {
      await delay(LATENCY)

      const nc = nonconformities.find((n) => n.id === params.ncId)
      if (!nc) return err('nonconformities:errors.notFound', 404)

      const ac = nc.accionesCorrectivas.find((a) => a.id === params.acId)
      if (!ac) return err('nonconformities:errors.notFound', 404)

      const body = await request.json() as Record<string, unknown>
      const now = new Date().toISOString()

      const updatedAC: AccionCorrectiva = {
        ...ac,
        ...(body as Partial<AccionCorrectiva>),
        actualizadoEn: now,
      }

      const updated: NoConformidad = {
        ...nc,
        accionesCorrectivas: nc.accionesCorrectivas.map((a) =>
          a.id === params.acId ? updatedAC : a,
        ),
        actualizadoEn: now,
        auditTrail: [
          ...nc.auditTrail,
          makeAuditEntry(nc.id, 'AC_ACTUALIZADA', { valorNuevo: params.acId as string }),
        ],
      }

      nonconformities = nonconformities.map((n) => (n.id === params.ncId ? updated : n))

      return ok(updatedAC)
    },
  ),

  // POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar
  http.post(
    '/api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar',
    async ({ params, request }) => {
      await delay(LATENCY)

      const nc = nonconformities.find((n) => n.id === params.ncId)
      if (!nc) return err('nonconformities:errors.notFound', 404)

      const ac = nc.accionesCorrectivas.find((a) => a.id === params.acId)
      if (!ac) return err('nonconformities:errors.notFound', 404)

      const body = await request.json() as Record<string, unknown>
      const descripcionEvidencia = body?.descripcionEvidencia as string | undefined

      if (!descripcionEvidencia || descripcionEvidencia.trim() === '') {
        return err('Validation error', 400, ['descripcionEvidencia is required'])
      }

      const now = new Date().toISOString()
      const closedAC: AccionCorrectiva = {
        ...ac,
        estado: 'CERRADA',
        fechaCierre: now,
        descripcionEvidencia,
        ...(body.evidenciaUrl ? { evidenciaUrl: body.evidenciaUrl as string } : {}),
        actualizadoEn: now,
      }

      const updated: NoConformidad = {
        ...nc,
        accionesCorrectivas: nc.accionesCorrectivas.map((a) =>
          a.id === params.acId ? closedAC : a,
        ),
        actualizadoEn: now,
        auditTrail: [
          ...nc.auditTrail,
          makeAuditEntry(nc.id, 'AC_CERRADA', { valorNuevo: params.acId as string }),
        ],
      }

      nonconformities = nonconformities.map((n) => (n.id === params.ncId ? updated : n))

      return ok(closedAC)
    },
  ),

  // GET /api/users — list of users for responsable picker
  http.get('/api/users', async () => {
    await delay(LATENCY)
    return ok(userFixtures)
  }),
]
