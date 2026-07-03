import { http, HttpResponse, delay } from 'msw'
import { qualityEventFixtures } from '../fixtures/quality-events.fixtures'
import { USER_NOMBRE_MAP } from '../fixtures/users.fixtures'
import type { QualityEvent, QEStatus, AccionCorrectivaQE, QEAuditTrailEntry } from '../../features/quality-events/types/qualityEvent.types'

const LATENCY = 400

let qeStore: QualityEvent[] = [...qualityEventFixtures]

const ORIGIN_REQUIRED_FIELD: Record<string, string> = {
  O1_INCIDENTE_CAMPO: 'incidenteId',
  O2_NC_DETECTADA: 'ncId',
  O3_HALLAZGO_AUDITORIA: 'hallazgoAuditoriaRef',
  O4_REPORTE_EXTERNO: 'reporteExternoRef',
}

export const qualityEventHandlers = [
  http.get('/api/quality-events', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado') as QEStatus | null
    const tipo = url.searchParams.get('tipo')
    const severidad = url.searchParams.get('severidad')
    const origen = url.searchParams.get('origen')
    const fechaDesde = url.searchParams.get('fechaDesde')
    const fechaHasta = url.searchParams.get('fechaHasta')
    const soloReincidencias = url.searchParams.get('soloReincidencias') === 'true'
    const incluirEliminados = url.searchParams.get('incluirEliminados') === 'true'
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)

    let filtered = incluirEliminados ? [...qeStore] : qeStore.filter(qe => !qe.deletedAt)
    if (estado) filtered = filtered.filter(qe => qe.estado === estado)
    if (tipo) filtered = filtered.filter(qe => qe.tipo === tipo)
    if (severidad) filtered = filtered.filter(qe => qe.severidad === severidad)
    if (origen) filtered = filtered.filter(qe => qe.origen === origen)
    // fechaDesde / fechaHasta compare against fechaHoraEvento (event occurrence date)
    if (fechaDesde) filtered = filtered.filter(qe => qe.fechaHoraEvento >= fechaDesde)
    if (fechaHasta) filtered = filtered.filter(qe => qe.fechaHoraEvento.slice(0, 10) <= fechaHasta)
    if (soloReincidencias) filtered = filtered.filter(qe => qe.ciclo > 1)

    const totalItems = filtered.length
    const totalPages = Math.ceil(totalItems / pageSize)
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      success: true,
      data: { items, pagination: { page, pageSize, totalItems, totalPages } },
    })
  }),

  http.get('/api/quality-events/:id', async ({ params }) => {
    await delay(LATENCY)
    const qe = qeStore.find(q => q.id === params.id)
    if (!qe) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }
    return HttpResponse.json({ success: true, data: qe })
  }),

  http.post('/api/quality-events', async ({ request }) => {
    await delay(LATENCY)
    const body = await request.json() as Record<string, unknown>
    const origen = body.origen as string | undefined

    if (origen) {
      const requiredField = ORIGIN_REQUIRED_FIELD[origen]
      if (requiredField && !body[requiredField]) {
        return HttpResponse.json(
          { success: false, message: `${requiredField} requerido para origen ${origen}` },
          { status: 422 }
        )
      }
    }

    const numero = `QE-2026-${(qeStore.length + 1).toString().padStart(3, '0')}`
    const now = new Date().toISOString()
    const newQE: QualityEvent = {
      ...(body as Partial<QualityEvent>),
      id: `qe-2026-${(qeStore.length + 1).toString().padStart(3, '0')}`,
      numero,
      estado: 'ABIERTO',
      ciclo: 1,
      requiereEvaluacionRiesgos: (body.requiereEvaluacionRiesgos as boolean) ?? false,
      solicitudesAC: 0,
      documentosVinculados: [],
      accionesCorrectivas: [],
      auditTrail: [
        {
          id: `aud-${numero}-1`,
          entidadTipo: 'QualityEvent',
          entidadId: `qe-2026-${(qeStore.length + 1).toString().padStart(3, '0')}`,
          accion: 'CREADO',
          estadoNuevo: 'ABIERTO',
          realizadoPorId: (body.reportadoPorId as string) ?? 'user-001',
          realizadoPorNombre: 'Sistema',
          timestamp: now,
          generadoPorIA: false,
        },
      ],
      creadoEn: now,
      actualizadoEn: now,
    } as QualityEvent

    qeStore.push(newQE)
    return HttpResponse.json({ success: true, data: newQE }, { status: 201 })
  }),

  http.patch('/api/quality-events/:id', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }
    const body = await request.json() as Partial<QualityEvent>
    const updated = { ...qeStore[idx], ...body, actualizadoEn: new Date().toISOString() }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/status', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json() as { nuevoEstado: QEStatus; comentario?: string; firmaPin?: string }
    const qe = qeStore[idx]

    if (body.nuevoEstado === 'EN_EJECUCION' && !qe.causaRaizFirmadaEn) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-002: causa raíz no firmada' },
        { status: 422 }
      )
    }

    if (body.nuevoEstado === 'CERRADO' && !qe.cierreFirmaSupervisorId) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-004: se requiere firma dual' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const auditEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent' as const,
      entidadId: qe.id,
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: qe.estado,
      estadoNuevo: body.nuevoEstado,
      realizadoPorId: 'user-current',
      realizadoPorNombre: 'Usuario actual',
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      estado: body.nuevoEstado,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.delete('/api/quality-events/:id', async ({ params }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const now = new Date().toISOString()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'ELIMINADO',
      valorNuevo: now,
      realizadoPorId: 'user-current',
      realizadoPorNombre: 'Usuario actual',
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      deletedAt: now,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/reactivar', async ({ params }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const now = new Date().toISOString()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'REACTIVADO',
      estadoAnterior: qe.estado,
      estadoNuevo: 'ABIERTO',
      realizadoPorId: 'user-current',
      realizadoPorNombre: 'Usuario actual',
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      estado: 'ABIERTO',
      deletedAt: undefined,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.get('/api/quality-events/:id/acciones-correctivas', async ({ params }) => {
    await delay(LATENCY)
    const qe = qeStore.find(q => q.id === params.id)
    if (!qe) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }
    return HttpResponse.json({ success: true, data: qe.accionesCorrectivas })
  }),

  http.post('/api/quality-events/:id/acciones-correctivas', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()
    const responsableId = body.responsableId as string
    const acId = `ac-qe-${qe.id}-${qe.accionesCorrectivas.length + 1}-${Date.now().toString(36)}`

    const newAC: AccionCorrectivaQE = {
      id: acId,
      qeId: qe.id,
      titulo: body.titulo as string | undefined,
      descripcion: body.descripcion as string,
      responsableId,
      responsableNombre: USER_NOMBRE_MAP[responsableId] ?? 'Usuario',
      plazoFecha: body.plazoFecha as string,
      prioridad: body.prioridad as AccionCorrectivaQE['prioridad'],
      estado: 'PENDIENTE',
      creadoEn: now,
      actualizadoEn: now,
    }

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_CREADA',
      valorNuevo: acId,
      realizadoPorId: 'user-current',
      realizadoPorNombre: 'Usuario actual',
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      accionesCorrectivas: [...qe.accionesCorrectivas, newAC],
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: newAC }, { status: 201 })
  }),

  http.patch('/api/quality-events/:id/acciones-correctivas/:acId', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const acIdx = qe.accionesCorrectivas.findIndex(a => a.id === params.acId)
    if (acIdx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Acción correctiva no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json() as Partial<AccionCorrectivaQE>
    const now = new Date().toISOString()
    const updatedAC: AccionCorrectivaQE = {
      ...qe.accionesCorrectivas[acIdx],
      ...body,
      actualizadoEn: now,
    }

    const accionesCorrectivas = [...qe.accionesCorrectivas]
    accionesCorrectivas[acIdx] = updatedAC

    const updated: QualityEvent = { ...qe, accionesCorrectivas, actualizadoEn: now }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updatedAC })
  }),

  http.patch('/api/quality-events/:id/acciones-correctivas/:acId/status', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const acIdx = qe.accionesCorrectivas.findIndex(a => a.id === params.acId)
    if (acIdx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Acción correctiva no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json() as {
      estado: AccionCorrectivaQE['estado']
      descripcionEvidencia?: string
      evidenciaUrl?: string
    }

    if (body.estado === 'CERRADA' && (!body.descripcionEvidencia || body.descripcionEvidencia.trim() === '')) {
      return HttpResponse.json(
        { success: false, message: 'descripcionEvidencia es obligatoria para cerrar la AC' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const previous = qe.accionesCorrectivas[acIdx]
    const updatedAC: AccionCorrectivaQE = {
      ...previous,
      estado: body.estado,
      actualizadoEn: now,
      ...(body.descripcionEvidencia ? { descripcionEvidencia: body.descripcionEvidencia } : {}),
      ...(body.evidenciaUrl ? { evidenciaUrl: body.evidenciaUrl } : {}),
      ...(body.estado === 'CERRADA' ? { fechaCierre: now } : {}),
    }

    const accionesCorrectivas = [...qe.accionesCorrectivas]
    accionesCorrectivas[acIdx] = updatedAC

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_ESTADO_CAMBIADO',
      estadoAnterior: previous.estado,
      estadoNuevo: body.estado,
      valorNuevo: updatedAC.id,
      realizadoPorId: 'user-current',
      realizadoPorNombre: 'Usuario actual',
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      accionesCorrectivas,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updatedAC })
  }),

  http.patch('/api/quality-events/:id/solicitar-ac', async ({ params }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const updated: QualityEvent = {
      ...qe,
      solicitudesAC: qe.solicitudesAC + 1,
      actualizadoEn: new Date().toISOString(),
    }
    qeStore[idx] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.get('/api/quality-events/:id/audit-trail', async ({ params }) => {
    await delay(LATENCY)
    const qe = qeStore.find(q => q.id === params.id)
    if (!qe) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }
    const sorted = [...qe.auditTrail].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    return HttpResponse.json({ success: true, data: sorted })
  }),
]
