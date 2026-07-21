import { http, HttpResponse, delay } from 'msw'
import { qualityEventFixtures } from '../fixtures/quality-events.fixtures'
import { resolveUserDisplayName } from '../fixtures/userIdentity.fixtures'
import { getUsersStore } from '../fixtures/auth.fixtures'
import { createCambioEstadoNotification, createAsignacionNotification } from '../fixtures/notificationGeneration'
import { resolveRolSegundaFirma, resolveQEEditAccess } from '../../features/quality-events/utils/qualityEventPermissions'
import { getIncidentsStore } from './incidents.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import { syncOrigenFromQEEstado } from './qeOriginSync'
import { PLAZO_MINIMO_DIAS_HABILES } from '../../features/quality-events/constants/plazoAjuste.constants'
import { calcularRequiereAprobacionGerencia } from '../../features/quality-events/constants/plazoAjuste.utils'
import { contarDiasHabiles } from '../../utils/businessDays'
import { useAuthStore } from '../../stores/authStore'
import type { User } from '../../types/auth.types'
import type { QualityEvent, QEStatus, AccionCorrectivaQE, QEAuditTrailEntry, SolicitudAjustePlazoAC } from '../../features/quality-events/types/qualityEvent.types'

const LATENCY = 400

function getCurrentUser(): { id: string; nombre: string } {
  const user = useAuthStore.getState().user
  if (!user) return { id: 'user-current', nombre: 'Usuario actual' }
  return { id: user.id, nombre: `${user.nombre} ${user.apellido}` }
}

function getCurrentUserForEditAccess(): Pick<User, 'id' | 'rol' | 'areaIds'> {
  const user = useAuthStore.getState().user
  if (!user) return { id: 'user-current', rol: 'OPERARIO', areaIds: [] }
  return { id: user.id, rol: user.rol, areaIds: user.areaIds }
}

// RN-QE-008 — escalada compartida por la reapertura NO_EFECTIVO y la reapertura
// forzada por vencimiento de plazo (ambas representan el mismo tipo de reapertura).
function notifyReaperturaEscalada(qe: QualityEvent, actorId: string): void {
  const recipients = getUsersStore().filter(
    (u) =>
      u.rol === 'ALTA_DIRECCION' ||
      u.rol === 'JEFE_CALIDAD_SYST' ||
      (u.rol === 'SUPERVISOR' && (u.areaIds ?? []).includes(qe.areaId)),
  )
  for (const recipient of recipients) {
    createCambioEstadoNotification({
      entidadTipo: 'QE',
      entidadId: qe.id,
      entidadCodigo: qe.numero,
      estadoNuevo: 'EN_INVESTIGACION',
      reportadoPorId: recipient.id,
      responsablesACActivas: [],
      actorId,
      link: `/quality-events/${qe.id}`,
    })
  }
  createCambioEstadoNotification({
    entidadTipo: 'QE',
    entidadId: qe.id,
    entidadCodigo: qe.numero,
    estadoNuevo: 'EN_INVESTIGACION',
    reportadoPorId: qe.reportadoPorId,
    responsablesACActivas: [],
    actorId,
    link: `/quality-events/${qe.id}`,
  })
}

const PROTECTED_REPORTE_INICIAL_FIELDS = [
  'numero',
  'origen',
  'tipo',
  'fechaHoraReporte',
  'reportadoPorId',
  'severidad',
]

const REPORTE_INICIAL_EDITABLE_FIELDS = [
  'descripcion',
  'areaId',
  'turno',
  'fechaHoraEvento',
  'mineralInvolucrado',
  'incidenteId',
  'ncId',
  'hallazgoCodigo',
  'normativaVinculada',
  'reporteExternoRef',
]

const ESTADOS_BLOQUEADOS_SEVERIDAD_MINERAL: QEStatus[] = ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO']

let qeStore: QualityEvent[] = [...qualityEventFixtures]

// Expone el store mutable en vivo para que otros handlers (p.ej. dashboard.handlers.ts)
// agreguen sobre el estado real de QE, no sobre el fixture estático.
export function getQeStore(): QualityEvent[] {
  return qeStore
}

function resetStore() {
  qeStore = [...qualityEventFixtures]
}

// Único punto de escritura para qeStore: todas las transiciones de estado del QE pasan por
// acá (reemplaza las asignaciones directas `qeStore[idx] = updated` dispersas en cada
// handler), para que la sincronización del origen vinculado (Incidente RN-INC-006 / NC —
// ver qeOriginSync.ts) se dispare siempre que `estado` cambia, sin depender de que cada
// transición futura recuerde llamarla explícitamente.
function commitQE(idx: number, previous: QualityEvent, updated: QualityEvent): QualityEvent {
  qeStore[idx] = updated
  if (updated.estado !== previous.estado) {
    const currentUser = getCurrentUser()
    syncOrigenFromQEEstado(updated, currentUser)
  }
  return updated
}

const ORIGIN_REQUIRED_FIELD: Record<string, string> = {
  O1_INCIDENTE_CAMPO: 'incidenteId',
  O2_NC_DETECTADA: 'ncId',
  O3_HALLAZGO_AUDITORIA: 'hallazgoCodigo',
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

    // RN-QE-001 — guard server-side: un Incidente ya vinculado a un QE no puede originar otro.
    // La UI ya bloquea esto vía canCrearQE (incidentPermissions.ts), pero eso no cubre un doble
    // clic en la ventana entre crear y navegar, ni una llamada directa a la API.
    if (origen === 'O1_INCIDENTE_CAMPO') {
      const incidenteId = body.incidenteId as string | undefined
      const incidente = incidenteId ? getIncidentsStore().find((i) => i.id === incidenteId) : undefined
      if (incidente?.qeId) {
        return HttpResponse.json(
          { success: false, message: 'Este incidente ya tiene un Quality Event vinculado' },
          { status: 422 }
        )
      }
    }

    // RN-QE-013 — mismo guard server-side que arriba (O1_INCIDENTE_CAMPO), pero para NC: una NC
    // ya vinculada a un QE no puede originar otro. La UI ya bloquea esto vía canCrearQE
    // (ncPermissions.ts), pero eso no cubre un doble clic ni una llamada directa a la API.
    if (origen === 'O2_NC_DETECTADA') {
      const ncId = body.ncId as string | undefined
      const nc = ncId ? getNonconformitiesStore().find((n) => n.id === ncId) : undefined
      if (nc?.qeGeneradoId) {
        return HttpResponse.json(
          { success: false, message: 'Esta NC ya tiene un Quality Event vinculado' },
          { status: 422 }
        )
      }
    }

    const numero = `QE-2026-${(qeStore.length + 1).toString().padStart(3, '0')}`
    const now = new Date().toISOString()
    const currentUser = getCurrentUser()
    const newQE: QualityEvent = {
      ...(body as Partial<QualityEvent>),
      id: `qe-2026-${(qeStore.length + 1).toString().padStart(3, '0')}`,
      numero,
      estado: 'ABIERTO',
      ciclo: 1,
      fechaHoraReporte: now,
      reportadoPorId: currentUser.id,
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
          realizadoPorId: currentUser.id,
          realizadoPorNombre: currentUser.nombre,
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
    const previous = qeStore[idx]
    const body = await request.json() as Partial<QualityEvent>
    const updated = { ...previous, ...body, actualizadoEn: new Date().toISOString() }
    commitQE(idx, previous, updated)
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
    const currentUser = getCurrentUser()
    const auditEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent' as const,
      entidadId: qe.id,
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: qe.estado,
      estadoNuevo: body.nuevoEstado,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      estado: body.nuevoEstado,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
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
    const currentUser = getCurrentUser()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'ELIMINADO',
      valorNuevo: now,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      deletedAt: now,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
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
    const currentUser = getCurrentUser()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'REACTIVADO',
      estadoAnterior: qe.estado,
      estadoNuevo: 'ABIERTO',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
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
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.post('/api/quality-events/:id/export-pdf', async ({ params }) => {
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
    const currentUser = getCurrentUser()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'EXPORTACION_PDF',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
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
      responsableNombre: resolveUserDisplayName(responsableId),
      plazoFecha: body.plazoFecha as string,
      prioridad: body.prioridad as AccionCorrectivaQE['prioridad'],
      estado: 'PENDIENTE',
      creadoEn: now,
      actualizadoEn: now,
      solicitudesAjustePlazo: [],
    }

    const currentUser = getCurrentUser()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_CREADA',
      valorNuevo: acId,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      accionesCorrectivas: [...qe.accionesCorrectivas, newAC],
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)

    if (responsableId) {
      createAsignacionNotification({
        entidadTipo: 'QE',
        entidadId: qe.id,
        entidadCodigo: qe.numero,
        asignadoId: responsableId,
        actorId: currentUser.id,
        link: `/quality-events/${qe.id}`,
        mensaje: `Se te asignó una acción correctiva del Quality Event ${qe.numero}.`,
      })
    }

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
    const previousResponsableId = qe.accionesCorrectivas[acIdx].responsableId
    const updatedAC: AccionCorrectivaQE = {
      ...qe.accionesCorrectivas[acIdx],
      ...body,
      actualizadoEn: now,
    }

    const accionesCorrectivas = [...qe.accionesCorrectivas]
    accionesCorrectivas[acIdx] = updatedAC

    const updated: QualityEvent = { ...qe, accionesCorrectivas, actualizadoEn: now }
    commitQE(idx, qe, updated)

    if (updatedAC.responsableId && updatedAC.responsableId !== previousResponsableId) {
      const currentUser = getCurrentUser()
      createAsignacionNotification({
        entidadTipo: 'QE',
        entidadId: qe.id,
        entidadCodigo: qe.numero,
        asignadoId: updatedAC.responsableId,
        actorId: currentUser.id,
        link: `/quality-events/${qe.id}`,
        mensaje: `Se te asignó una acción correctiva del Quality Event ${qe.numero}.`,
      })
    }

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

    const currentUser = getCurrentUser()
    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_ESTADO_CAMBIADO',
      estadoAnterior: previous.estado,
      estadoNuevo: body.estado,
      valorNuevo: updatedAC.id,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    let auditTrail = [...qe.auditTrail, auditEntry]
    let nuevoEstado: QEStatus = qe.estado

    const todasCerradasConEvidencia = accionesCorrectivas.every(
      (ac) => ac.estado === 'CERRADA' && !!ac.descripcionEvidencia && ac.descripcionEvidencia.trim() !== '',
    )

    if (qe.estado === 'EN_EJECUCION' && body.estado === 'CERRADA' && todasCerradasConEvidencia) {
      nuevoEstado = 'PENDIENTE_CIERRE'
      const transicionEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 2}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'TRANSICION_AUTOMATICA',
        estadoAnterior: 'EN_EJECUCION',
        estadoNuevo: 'PENDIENTE_CIERRE',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
      auditTrail = [...auditTrail, transicionEntry]
    }

    const updated: QualityEvent = {
      ...qe,
      estado: nuevoEstado,
      accionesCorrectivas,
      auditTrail,
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)

    if (nuevoEstado === 'PENDIENTE_CIERRE') {
      const jefesCalidad = getUsersStore().filter((u) => u.rol === 'JEFE_CALIDAD_SYST')
      for (const jefe of jefesCalidad) {
        createCambioEstadoNotification({
          entidadTipo: 'QE',
          entidadId: qe.id,
          entidadCodigo: qe.numero,
          estadoNuevo: nuevoEstado,
          reportadoPorId: jefe.id,
          responsablesACActivas: [],
          actorId: currentUser.id,
          link: `/quality-events/${qe.id}`,
        })
      }
    }

    return HttpResponse.json({ success: true, data: updatedAC })
  }),

  http.post('/api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo', async ({ params, request }) => {
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

    const ac = qe.accionesCorrectivas[acIdx]
    const body = await request.json() as { fechaSolicitada: string; justificacion: string }
    const usuario = getCurrentUserForEditAccess()

    if (usuario.id !== ac.responsableId) {
      return HttpResponse.json(
        { success: false, message: 'Solo el responsable de la AC puede solicitar un ajuste de plazo' },
        { status: 422 }
      )
    }
    if (ac.estado === 'CERRADA') {
      return HttpResponse.json(
        { success: false, message: 'No se puede solicitar un ajuste de plazo para una AC cerrada' },
        { status: 422 }
      )
    }
    if (ac.solicitudesAjustePlazo.some(s => s.estado === 'PENDIENTE')) {
      return HttpResponse.json(
        { success: false, message: 'Ya existe una solicitud de ajuste de plazo pendiente para esta AC' },
        { status: 422 }
      )
    }

    const totalPlazoDiasHabiles = contarDiasHabiles(new Date(ac.creadoEn), new Date(body.fechaSolicitada))
    if (totalPlazoDiasHabiles < PLAZO_MINIMO_DIAS_HABILES[qe.severidad]) {
      return HttpResponse.json(
        { success: false, message: 'El plazo solicitado está por debajo del mínimo permitido para la severidad del QE' },
        { status: 422 }
      )
    }

    const incrementoDiasHabiles = contarDiasHabiles(new Date(ac.plazoFecha), new Date(body.fechaSolicitada))
    const requiereAprobacionGerencia = calcularRequiereAprobacionGerencia(qe.severidad, incrementoDiasHabiles)

    const now = new Date().toISOString()
    const currentUser = getCurrentUser()
    const nuevaSolicitud: SolicitudAjustePlazoAC = {
      id: `sol-${ac.id}-${ac.solicitudesAjustePlazo.length + 1}`,
      fechaSolicitada: body.fechaSolicitada,
      justificacion: body.justificacion,
      estado: 'PENDIENTE',
      solicitadoPorId: currentUser.id,
      solicitadoEn: now,
      requiereAprobacionGerencia,
    }

    const updatedAC: AccionCorrectivaQE = {
      ...ac,
      solicitudesAjustePlazo: [...ac.solicitudesAjustePlazo, nuevaSolicitud],
      actualizadoEn: now,
    }

    const accionesCorrectivas = [...qe.accionesCorrectivas]
    accionesCorrectivas[acIdx] = updatedAC

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_AJUSTE_PLAZO_SOLICITADO',
      valorNuevo: body.fechaSolicitada,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      accionesCorrectivas,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated }, { status: 201 })
  }),

  http.patch('/api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId', async ({ params, request }) => {
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

    const ac = qe.accionesCorrectivas[acIdx]
    const solIdx = ac.solicitudesAjustePlazo.findIndex(s => s.id === params.solicitudId)
    if (solIdx === -1 || ac.solicitudesAjustePlazo[solIdx].estado !== 'PENDIENTE') {
      return HttpResponse.json(
        { success: false, message: 'Solicitud de ajuste de plazo no encontrada' },
        { status: 404 }
      )
    }

    const solicitud = ac.solicitudesAjustePlazo[solIdx]
    const body = await request.json() as { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string }

    if (body.accion === 'RECHAZAR' && (!body.comentarioRevision || body.comentarioRevision.trim() === '')) {
      return HttpResponse.json(
        { success: false, message: 'El comentario de revisión es obligatorio para rechazar la solicitud' },
        { status: 422 }
      )
    }

    const usuario = getCurrentUserForEditAccess()
    const rolEsperado = solicitud.requiereAprobacionGerencia ? 'ALTA_DIRECCION' : 'JEFE_CALIDAD_SYST'
    if (usuario.rol !== rolEsperado) {
      return HttpResponse.json(
        { success: false, message: 'No tiene el rol autorizado para revisar esta solicitud' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const currentUser = getCurrentUser()
    const solicitudesAjustePlazo = [...ac.solicitudesAjustePlazo]

    if (body.accion === 'APROBAR') {
      const plazoAnterior = ac.plazoFecha
      solicitudesAjustePlazo[solIdx] = {
        ...solicitud,
        estado: 'APROBADA',
        revisadoPorId: currentUser.id,
        revisadoEn: now,
      }

      const updatedAC: AccionCorrectivaQE = {
        ...ac,
        plazoFecha: solicitud.fechaSolicitada,
        solicitudesAjustePlazo,
        actualizadoEn: now,
      }

      const accionesCorrectivas = [...qe.accionesCorrectivas]
      accionesCorrectivas[acIdx] = updatedAC

      const auditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'AC_AJUSTE_PLAZO_APROBADO',
        valorAnterior: plazoAnterior,
        valorNuevo: solicitud.fechaSolicitada,
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }

      const updated: QualityEvent = {
        ...qe,
        accionesCorrectivas,
        auditTrail: [...qe.auditTrail, auditEntry],
        actualizadoEn: now,
      }
      commitQE(idx, qe, updated)
      return HttpResponse.json({ success: true, data: updated })
    }

    solicitudesAjustePlazo[solIdx] = {
      ...solicitud,
      estado: 'RECHAZADA',
      revisadoPorId: currentUser.id,
      revisadoEn: now,
      comentarioRevision: body.comentarioRevision,
    }

    const updatedAC: AccionCorrectivaQE = {
      ...ac,
      solicitudesAjustePlazo,
      actualizadoEn: now,
    }

    const accionesCorrectivas = [...qe.accionesCorrectivas]
    accionesCorrectivas[acIdx] = updatedAC

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'AC_AJUSTE_PLAZO_RECHAZADO',
      campoModificado: 'comentarioRevision',
      valorNuevo: body.comentarioRevision,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      accionesCorrectivas,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/cerrar', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    if (qe.estado !== 'PENDIENTE_CIERRE') {
      return HttpResponse.json(
        { success: false, message: 'El Quality Event no está en PENDIENTE_CIERRE' },
        { status: 422 }
      )
    }

    const body = await request.json() as { resultadoCierre: string; plazoVerificacionDias: number }
    const now = new Date().toISOString()
    const currentUser = getCurrentUser()

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'CIERRE_INICIADO',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      resultadoCierre: body.resultadoCierre,
      plazoVerificacionDias: body.plazoVerificacionDias,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/firmar-cierre', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const body = await request.json() as {
      rol: 'JEFE_CALIDAD_SYST' | 'SUPERVISOR' | 'ALTA_DIRECCION'
      pin: string
    }

    if (!qe.resultadoCierre) {
      return HttpResponse.json(
        { success: false, message: 'QE-AC-006: debe registrarse el cierre antes de firmar' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const currentUser = getCurrentUser()

    if (body.rol === 'JEFE_CALIDAD_SYST') {
      if (qe.cerradoPorId) {
        return HttpResponse.json(
          { success: false, message: 'QE-AC-006: la primera firma ya fue registrada' },
          { status: 422 }
        )
      }

      const auditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'FIRMA_CIERRE_JEFE_CALIDAD',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }

      const updated: QualityEvent = {
        ...qe,
        cerradoPorId: currentUser.id,
        auditTrail: [...qe.auditTrail, auditEntry],
        actualizadoEn: now,
      }
      commitQE(idx, qe, updated)
      return HttpResponse.json({ success: true, data: updated })
    }

    // Second signature: SUPERVISOR or ALTA_DIRECCION
    if (!qe.cerradoPorId) {
      return HttpResponse.json(
        { success: false, message: 'QE-AC-006: falta la primera firma (Jefe de Calidad)' },
        { status: 422 }
      )
    }
    if (qe.cierreFirmaSupervisorId) {
      return HttpResponse.json(
        { success: false, message: 'QE-AC-006: la segunda firma ya fue registrada' },
        { status: 422 }
      )
    }

    const rolEsperado = resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId)
    if (body.rol !== rolEsperado) {
      return HttpResponse.json(
        { success: false, message: 'QE-AC-006: rol de segunda firma inválido' },
        { status: 422 }
      )
    }

    const fechaCierre = now
    const plazo = qe.plazoVerificacionDias ?? 60
    const fechaVerificacionProgramada = new Date(
      new Date(fechaCierre).getTime() + plazo * 24 * 60 * 60 * 1000,
    ).toISOString()

    const firmaEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'FIRMA_CIERRE_SEGUNDA',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }
    const transicionEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 2}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'ESTADO_CAMBIADO',
      estadoAnterior: qe.estado,
      estadoNuevo: 'CERRADO',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      cierreFirmaSupervisorId: currentUser.id,
      cierreFirmaSupervisorRol: body.rol,
      estado: 'CERRADO',
      fechaCierre,
      fechaVerificacionProgramada,
      auditTrail: [...qe.auditTrail, firmaEntry, transicionEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)

    createCambioEstadoNotification({
      entidadTipo: 'QE',
      entidadId: qe.id,
      entidadCodigo: qe.numero,
      estadoNuevo: 'CERRADO',
      reportadoPorId: qe.reportadoPorId,
      responsablesACActivas: [],
      actorId: currentUser.id,
      link: `/quality-events/${qe.id}`,
    })

    if (qe.severidad === 'ALTA' || qe.severidad === 'CRITICA') {
      const gerencia = getUsersStore().filter((u) => u.rol === 'ALTA_DIRECCION')
      for (const g of gerencia) {
        createCambioEstadoNotification({
          entidadTipo: 'QE',
          entidadId: qe.id,
          entidadCodigo: qe.numero,
          estadoNuevo: 'CERRADO',
          reportadoPorId: g.id,
          responsablesACActivas: [],
          actorId: currentUser.id,
          link: `/quality-events/${qe.id}`,
        })
      }
    }

    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/forzar-vencimiento-verificacion', async ({ params, request }) => {
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
    const currentUser = getCurrentUser()
    const body = (await request.json().catch(() => ({}))) as { auditorAsignadoId?: string }

    if (qe.estado === 'CERRADO') {
      const auditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'ESTADO_CAMBIADO',
        estadoAnterior: qe.estado,
        estadoNuevo: 'EN_VERIFICACION',
        campoModificado: 'forzarVencimiento',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
      const updated: QualityEvent = {
        ...qe,
        estado: 'EN_VERIFICACION',
        auditorAsignadoId: body.auditorAsignadoId,
        auditTrail: [...qe.auditTrail, auditEntry],
        actualizadoEn: now,
      }
      commitQE(idx, qe, updated)

      if (body.auditorAsignadoId) {
        createAsignacionNotification({
          entidadTipo: 'QE',
          entidadId: qe.id,
          entidadCodigo: qe.numero,
          asignadoId: body.auditorAsignadoId,
          actorId: currentUser.id,
          link: `/quality-events/${qe.id}`,
          mensaje: `Se te asignó como verificador de eficacia del Quality Event ${qe.numero}.`,
        })
      }

      return HttpResponse.json({ success: true, data: updated })
    }

    if (qe.estado === 'EN_VERIFICACION') {
      const timeoutEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'VERIFICACION_VENCIDA',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
      const reaperturaEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 2}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'REABIERTO',
        estadoAnterior: qe.estado,
        estadoNuevo: 'EN_INVESTIGACION',
        campoModificado: 'motivo',
        valorNuevo: 'VENCIMIENTO_PLAZO',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
      const updated: QualityEvent = {
        ...qe,
        estado: 'EN_INVESTIGACION',
        ciclo: qe.ciclo + 1,
        auditTrail: [...qe.auditTrail, timeoutEntry, reaperturaEntry],
        actualizadoEn: now,
      }
      commitQE(idx, qe, updated)

      notifyReaperturaEscalada(qe, currentUser.id)

      return HttpResponse.json({ success: true, data: updated })
    }

    return HttpResponse.json(
      { success: false, message: 'No hay nada que forzar para el estado actual' },
      { status: 422 }
    )
  }),

  http.post('/api/quality-events/:id/verificacion-eficacia', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const body = await request.json() as { resultado: 'EFECTIVO' | 'NO_EFECTIVO'; evidencia: string }

    if (qe.estado !== 'EN_VERIFICACION' || !body.evidencia || body.evidencia.trim() === '') {
      return HttpResponse.json(
        { success: false, message: 'Solicitud inválida para registrar verificación de eficacia' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const currentUser = getCurrentUser()

    if (body.resultado === 'EFECTIVO') {
      const auditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'ESTADO_CAMBIADO',
        estadoAnterior: qe.estado,
        estadoNuevo: 'VERIFICADO',
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
      const updated: QualityEvent = {
        ...qe,
        resultadoVerificacion: 'EFECTIVO',
        evidenciaVerificacion: body.evidencia,
        verificadoPorId: currentUser.id,
        fechaVerificacionRealizada: now,
        estado: 'VERIFICADO',
        auditTrail: [...qe.auditTrail, auditEntry],
        actualizadoEn: now,
      }
      commitQE(idx, qe, updated)

      createCambioEstadoNotification({
        entidadTipo: 'QE',
        entidadId: qe.id,
        entidadCodigo: qe.numero,
        estadoNuevo: 'VERIFICADO',
        reportadoPorId: qe.reportadoPorId,
        responsablesACActivas: [],
        actorId: currentUser.id,
        link: `/quality-events/${qe.id}`,
      })

      if (qe.severidad === 'ALTA' || qe.severidad === 'CRITICA') {
        const gerencia = getUsersStore().filter((u) => u.rol === 'ALTA_DIRECCION')
        for (const g of gerencia) {
          createCambioEstadoNotification({
            entidadTipo: 'QE',
            entidadId: qe.id,
            entidadCodigo: qe.numero,
            estadoNuevo: 'VERIFICADO',
            reportadoPorId: g.id,
            responsablesACActivas: [],
            actorId: currentUser.id,
            link: `/quality-events/${qe.id}`,
          })
        }
      }

      return HttpResponse.json({ success: true, data: updated })
    }

    const resultEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'VERIFICACION_NO_EFECTIVA',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }
    const reaperturaEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 2}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'REABIERTO',
      estadoAnterior: qe.estado,
      estadoNuevo: 'EN_INVESTIGACION',
      campoModificado: 'motivo',
      valorNuevo: 'NO_EFECTIVO',
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }
    const updated: QualityEvent = {
      ...qe,
      resultadoVerificacion: 'NO_EFECTIVO',
      evidenciaVerificacion: body.evidencia,
      fechaVerificacionRealizada: now,
      ciclo: qe.ciclo + 1,
      estado: 'EN_INVESTIGACION',
      auditTrail: [...qe.auditTrail, resultEntry, reaperturaEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)

    notifyReaperturaEscalada(qe, currentUser.id)

    return HttpResponse.json({ success: true, data: updated })
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
    commitQE(idx, qe, updated)
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

  http.patch('/api/quality-events/:id/editar-reporte-inicial', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json() as Record<string, unknown>
    const hasProtectedField = PROTECTED_REPORTE_INICIAL_FIELDS.some((field) => field in body)
    if (hasProtectedField) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-014: no se pueden editar campos protegidos del reporte inicial' },
        { status: 422 }
      )
    }

    const qe = qeStore[idx]
    const usuario = getCurrentUserForEditAccess()
    const access = resolveQEEditAccess(qe, usuario, new Date())
    if (!access.reporteInicial) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-014: fuera de la ventana de corrección o sin permiso para editar' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    const currentUser = getCurrentUser()

    const cambios = REPORTE_INICIAL_EDITABLE_FIELDS.filter((campo) => campo in body).filter((campo) => {
      const anterior = (qe as unknown as Record<string, unknown>)[campo]
      return JSON.stringify(body[campo]) !== JSON.stringify(anterior)
    })

    const auditEntries: QEAuditTrailEntry[] = cambios.map((campo, i) => {
      const anterior = (qe as unknown as Record<string, unknown>)[campo]
      const nuevo = body[campo]
      return {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1 + i}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'QE_REPORTE_INICIAL_EDITADO',
        campoModificado: campo,
        valorAnterior: anterior !== undefined ? String(anterior) : undefined,
        valorNuevo: nuevo !== undefined ? String(nuevo) : undefined,
        realizadoPorId: currentUser.id,
        realizadoPorNombre: currentUser.nombre,
        timestamp: now,
        generadoPorIA: false,
      }
    })

    const patch: Record<string, unknown> = {}
    for (const campo of cambios) patch[campo] = body[campo]

    const updated: QualityEvent = {
      ...qe,
      ...patch,
      auditTrail: [...qe.auditTrail, ...auditEntries],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.patch('/api/quality-events/:id/editar-severidad', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const usuario = getCurrentUserForEditAccess()
    if (usuario.rol !== 'JEFE_CALIDAD_SYST' || ESTADOS_BLOQUEADOS_SEVERIDAD_MINERAL.includes(qe.estado)) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-015: sin permiso para editar la severidad' },
        { status: 422 }
      )
    }

    const body = await request.json() as { severidad: QualityEvent['severidad'] }
    const now = new Date().toISOString()
    const currentUser = getCurrentUser()
    const severidadAnterior = qe.severidad

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'QE_SEVERIDAD_EDITADA',
      campoModificado: 'severidad',
      valorAnterior: severidadAnterior,
      valorNuevo: body.severidad,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const requiereNotificacionUrgente =
      (body.severidad === 'CRITICA' && severidadAnterior !== 'CRITICA') ||
      (severidadAnterior === 'CRITICA' && body.severidad !== 'CRITICA')

    const updated: QualityEvent = {
      ...qe,
      severidad: body.severidad,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({
      success: true,
      data: { ...updated, requiereNotificacionUrgente },
    })
  }),

  http.patch('/api/quality-events/:id/editar-mineral', async ({ params, request }) => {
    await delay(LATENCY)
    const idx = qeStore.findIndex(q => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, message: 'Quality Event no encontrado' },
        { status: 404 }
      )
    }

    const qe = qeStore[idx]
    const usuario = getCurrentUserForEditAccess()
    const tipoValido = qe.tipo === 'CALIDAD' || qe.tipo === 'OPERACIONAL'
    if (
      usuario.rol !== 'JEFE_CALIDAD_SYST' ||
      ESTADOS_BLOQUEADOS_SEVERIDAD_MINERAL.includes(qe.estado) ||
      !tipoValido
    ) {
      return HttpResponse.json(
        { success: false, message: 'RN-QE-016: sin permiso para editar el mineral involucrado' },
        { status: 422 }
      )
    }

    const body = await request.json() as { mineralInvolucrado: string }
    const now = new Date().toISOString()
    const currentUser = getCurrentUser()

    const auditEntry: QEAuditTrailEntry = {
      id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
      entidadTipo: 'QualityEvent',
      entidadId: qe.id,
      accion: 'QE_MINERAL_EDITADO',
      campoModificado: 'mineralInvolucrado',
      valorAnterior: qe.mineralInvolucrado,
      valorNuevo: body.mineralInvolucrado,
      realizadoPorId: currentUser.id,
      realizadoPorNombre: currentUser.nombre,
      timestamp: now,
      generadoPorIA: false,
    }

    const updated: QualityEvent = {
      ...qe,
      mineralInvolucrado: body.mineralInvolucrado,
      auditTrail: [...qe.auditTrail, auditEntry],
      actualizadoEn: now,
    }
    commitQE(idx, qe, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),
]

export { resetStore }
