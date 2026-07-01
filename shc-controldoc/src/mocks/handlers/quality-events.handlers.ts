import { http, HttpResponse, delay } from 'msw'
import { qualityEventFixtures } from '../fixtures/quality-events.fixtures'
import type { QualityEvent, QEStatus } from '../../features/quality-events/types/qualityEvent.types'

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
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)

    let filtered = qeStore
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
]
