import { differenceInCalendarDays } from 'date-fns'
import { getUsersStore } from './auth.fixtures'
import { getNotificationsStore, addNotification } from './notifications.fixtures'
import { getQeStore } from '../handlers/quality-events.handlers'
import { getNonconformitiesStore } from '../handlers/nonconformities.handlers'
import { getIncidentsStore } from '../handlers/incidents.handlers'
import { getDocumentsStore } from '../handlers/documents.handlers'
import { calcularEstadoSemaforoDesdeFecha } from '../../features/dashboard/utils/semaforoPendientes'
import { getIncidentQEAlertLevel } from '../../features/incidents/utils/incidentQEAlert'
import type { Notificacion, NotificacionEntidadTipo } from '../../types/notification.types'
import { DOC_REVISION_ALERT_DAYS } from '../../config/businessRules.config'

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// CA-NOTIF-06: `isResolvableAccount` es la única fuente de verdad para "¿puede
// esta persona recibir una notificación in-app?" — deliberadamente NO usa
// `resolveUserDisplayName`/`seedLegacyNames`, que siempre devuelven un string
// de despliegue incluso para ids sin cuenta real (ver design.md Decisión 3).
export function isResolvableAccount(id: string): boolean {
  return getUsersStore().some((u) => u.id === id)
}

interface CreateCambioEstadoParams {
  entidadTipo: NotificacionEntidadTipo
  entidadId: string
  entidadCodigo: string
  estadoNuevo: string
  reportadoPorId: string
  responsablesACActivas: string[]
  actorId: string
  link: string
}

// RN-NOTIF-001
export function createCambioEstadoNotification(params: CreateCambioEstadoParams): Notificacion[] {
  const {
    entidadTipo,
    entidadId,
    entidadCodigo,
    estadoNuevo,
    reportadoPorId,
    responsablesACActivas,
    actorId,
    link,
  } = params

  const recipients = Array.from(new Set([reportadoPorId, ...responsablesACActivas]))
    .filter((id) => id !== actorId)
    .filter(isResolvableAccount)

  const now = new Date().toISOString()
  const created: Notificacion[] = recipients.map((usuarioId) => ({
    id: generateId(),
    usuarioId,
    tipo: 'CAMBIO_ESTADO',
    entidadTipo,
    entidadId,
    entidadCodigo,
    mensaje: `${entidadCodigo} cambió a estado ${estadoNuevo}.`,
    leida: false,
    createdAt: now,
    link,
  }))

  created.forEach(addNotification)
  return created
}

interface CreateAsignacionParams {
  entidadTipo: NotificacionEntidadTipo
  entidadId: string
  entidadCodigo: string
  asignadoId: string
  actorId: string
  link: string
  mensaje: string
}

// RN-NOTIF-002
export function createAsignacionNotification(params: CreateAsignacionParams): Notificacion | null {
  const { entidadTipo, entidadId, entidadCodigo, asignadoId, actorId, link, mensaje } = params

  if (asignadoId === actorId || !isResolvableAccount(asignadoId)) return null

  const notification: Notificacion = {
    id: generateId(),
    usuarioId: asignadoId,
    tipo: 'ASIGNACION',
    entidadTipo,
    entidadId,
    entidadCodigo,
    mensaje,
    leida: false,
    createdAt: new Date().toISOString(),
    link,
  }
  addNotification(notification)
  return notification
}

export function buildVencimientoKey(entidadTipo: 'AC' | 'DOCUMENTO' | 'INCIDENTE', entidadId: string): string {
  return `VENCIMIENTO:${entidadTipo}:${entidadId}`
}

function existingVencimientoKeys(): Set<string> {
  return new Set(
    getNotificationsStore()
      .filter((n) => n.tipo === 'VENCIMIENTO')
      .map((n) => buildVencimientoKey(n.entidadTipo as 'AC' | 'DOCUMENTO' | 'INCIDENTE', n.entidadId)),
  )
}

interface ACLike {
  id: string
  plazoFecha: string
  responsableId: string
  estado: string
}

interface ACSource {
  ac: ACLike
  entidadCodigo: string
  link: string
}

function collectActiveACSources(): ACSource[] {
  const sources: ACSource[] = []

  for (const qe of getQeStore()) {
    for (const ac of qe.accionesCorrectivas) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: qe.numero, link: `/quality-events/${qe.id}` })
    }
  }
  for (const nc of getNonconformitiesStore()) {
    for (const ac of nc.accionesCorrectivas) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: nc.numero, link: `/nonconformities/${nc.id}` })
    }
  }
  for (const inc of getIncidentsStore()) {
    for (const ac of inc.accionesCorrectivas ?? []) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: inc.numero, link: `/incidents/${inc.id}` })
    }
  }

  return sources
}

// RN-NOTIF-003 — recomputado en cada GET /api/notifications (sin cron
// disponible en el entorno mock, ver design.md Decisión 4). Idempotente vía
// `buildVencimientoKey`: nunca crea una segunda notificación para la misma
// entidad mientras exista una previa con esa clave.
// Fuentes: AC próximas a vencer, Documentos próximos a revisión periódica, e
// Incidentes vencidos sin QE vinculado (RN-INC-006).
export function generateVencimientoNotifications(): Notificacion[] {
  const existingKeys = existingVencimientoKeys()
  const created: Notificacion[] = []
  const now = new Date()

  for (const { ac, entidadCodigo, link } of collectActiveACSources()) {
    const key = buildVencimientoKey('AC', ac.id)
    if (existingKeys.has(key)) continue

    const { estado: semaforo } = calcularEstadoSemaforoDesdeFecha(ac.plazoFecha, now)
    if (semaforo !== 'AMARILLO') continue
    if (!isResolvableAccount(ac.responsableId)) continue

    const notification: Notificacion = {
      id: generateId(),
      usuarioId: ac.responsableId,
      tipo: 'VENCIMIENTO',
      entidadTipo: 'AC',
      entidadId: ac.id,
      entidadCodigo,
      mensaje: `La acción correctiva de ${entidadCodigo} vence pronto.`,
      leida: false,
      createdAt: now.toISOString(),
      link,
    }
    addNotification(notification)
    created.push(notification)
    existingKeys.add(key)
  }

  for (const doc of getDocumentsStore()) {
    if (!doc.fechaRevisionProxima) continue

    const key = buildVencimientoKey('DOCUMENTO', doc.id)
    if (existingKeys.has(key)) continue

    const diasRestantes = differenceInCalendarDays(new Date(doc.fechaRevisionProxima), now)
    if (diasRestantes > DOC_REVISION_ALERT_DAYS) continue

    const recipients = new Set<string>()
    if (isResolvableAccount(doc.autorId)) recipients.add(doc.autorId)
    for (const u of getUsersStore()) {
      if (u.rol === 'JEFE_CONTROL_DOCUMENTARIO' || u.rol === 'JEFE_CALIDAD_SYST') recipients.add(u.id)
    }

    let createdAny = false
    for (const usuarioId of recipients) {
      const notification: Notificacion = {
        id: generateId(),
        usuarioId,
        tipo: 'VENCIMIENTO',
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        mensaje: `El documento ${doc.codigo} se acerca a su fecha de revisión periódica.`,
        leida: false,
        createdAt: now.toISOString(),
        link: `/documentos/${doc.id}`,
      }
      addNotification(notification)
      created.push(notification)
      createdAny = true
    }
    if (createdAny) existingKeys.add(key)
  }

  // RN-INC-006 — solo dispara al superar el plazo (ROJO), no en el preaviso
  // AMARILLO: el badge de IncidentList ya cubre el preaviso visualmente: la
  // notificación es la escalada para cuando de verdad "nadie se enteró".
  for (const inc of getIncidentsStore()) {
    if (getIncidentQEAlertLevel(inc, now) !== 'ROJO') continue

    const key = buildVencimientoKey('INCIDENTE', inc.id)
    if (existingKeys.has(key)) continue

    const recipients = new Set<string>()
    for (const u of getUsersStore()) {
      if (u.rol === 'JEFE_CALIDAD_SYST') recipients.add(u.id)
      if (u.rol === 'SUPERVISOR' && (u.areaIds ?? []).includes(inc.areaId)) recipients.add(u.id)
    }

    let createdAny = false
    for (const usuarioId of recipients) {
      const notification: Notificacion = {
        id: generateId(),
        usuarioId,
        tipo: 'VENCIMIENTO',
        entidadTipo: 'INCIDENTE',
        entidadId: inc.id,
        entidadCodigo: inc.numero,
        mensaje: `El incidente ${inc.numero} superó su plazo de investigación sin tener un Quality Event vinculado.`,
        leida: false,
        createdAt: now.toISOString(),
        link: `/incidents/${inc.id}`,
      }
      addNotification(notification)
      created.push(notification)
      createdAny = true
    }
    if (createdAny) existingKeys.add(key)
  }

  return created
}
