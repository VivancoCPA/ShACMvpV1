import { getUsersStore } from './auth.fixtures'
import { getNotificationsStore, addNotification } from './notifications.fixtures'
import { getQeStore } from '../handlers/quality-events.handlers'
import { getNonconformitiesStore } from '../handlers/nonconformities.handlers'
import { getIncidentsStore } from '../handlers/incidents.handlers'
import { getDocumentsStore } from '../handlers/documents.handlers'
import { getRolEfectivo } from './empresas.fixtures'
import { calcularEstadoSemaforoDesdeFecha } from '../../features/dashboard/utils/semaforoPendientes'
import { getIncidentQEAlertLevel } from '../../features/incidents/utils/incidentQEAlert'
import type { Notificacion, NotificacionEntidadTipo } from '../../types/notification.types'
import { DOC_REVISION_ALERT_DAYS } from '../../config/businessRules.config'

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// revision-periodica-trazabilidad: "hoy" en America/Lima, no en la zona del navegador — mismo
// criterio que el backend (design.md D2). `Intl...('en-CA')` da directo el formato YYYY-MM-DD.
function hoyLimaIso(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(now)
}

// Días de calendario entre "hoy en Lima" y una fecha de calendario ISO (fechaRevisionProxima) —
// construido en UTC puro para no arrastrar ninguna zona local (mismo patrón que
// calendarDaysUntil en date.utils.ts, pero anclado a Lima en vez del navegador).
function diasHastaEnLima(fechaIso: string, now: Date): number {
  const [y, m, d] = fechaIso.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const [hy, hm, hd] = hoyLimaIso(now).split('-').map(Number)
  const hoy = Date.UTC(hy, hm - 1, hd)
  return Math.round((target - hoy) / (1000 * 60 * 60 * 24))
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
  empresaId: string
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
    empresaId,
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
    empresaId,
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
  empresaId: string
  asignadoId: string
  actorId: string
  link: string
  mensaje: string
}

// RN-NOTIF-002
export function createAsignacionNotification(params: CreateAsignacionParams): Notificacion | null {
  const { entidadTipo, entidadId, entidadCodigo, empresaId, asignadoId, actorId, link, mensaje } = params

  if (asignadoId === actorId || !isResolvableAccount(asignadoId)) return null

  const notification: Notificacion = {
    id: generateId(),
    usuarioId: asignadoId,
    empresaId,
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

// revision-periodica-trazabilidad: `cicloClave` opcional — omitirlo preserva exactamente la
// clave de antes (AC/INCIDENTE, idempotencia "una sola notificación para siempre por entidad").
// Documento la usa para distinguir preaviso/vencido y ciclo (espejo de Notificacion.CicloClave
// del backend, ver design.md D1).
export function buildVencimientoKey(
  entidadTipo: 'AC' | 'DOCUMENTO' | 'INCIDENTE',
  entidadId: string,
  cicloClave?: string,
): string {
  return cicloClave ? `VENCIMIENTO:${entidadTipo}:${entidadId}:${cicloClave}` : `VENCIMIENTO:${entidadTipo}:${entidadId}`
}

function existingVencimientoKeys(): Set<string> {
  return new Set(
    getNotificationsStore()
      .filter((n) => n.tipo === 'VENCIMIENTO')
      .map((n) => buildVencimientoKey(n.entidadTipo as 'AC' | 'DOCUMENTO' | 'INCIDENTE', n.entidadId, n.cicloClave)),
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
  empresaId: string
  link: string
}

function collectActiveACSources(): ACSource[] {
  const sources: ACSource[] = []

  for (const qe of getQeStore()) {
    for (const ac of qe.accionesCorrectivas) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: qe.numero, empresaId: qe.empresaId, link: `/quality-events/${qe.id}` })
    }
  }
  for (const nc of getNonconformitiesStore()) {
    for (const ac of nc.accionesCorrectivas) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: nc.numero, empresaId: nc.empresaId, link: `/nonconformities/${nc.id}` })
    }
  }
  for (const inc of getIncidentsStore()) {
    for (const ac of inc.accionesCorrectivas ?? []) {
      if (ac.estado === 'CERRADA') continue
      sources.push({ ac, entidadCodigo: inc.numero, empresaId: inc.empresaId, link: `/incidents/${inc.id}` })
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

  for (const { ac, entidadCodigo, empresaId, link } of collectActiveACSources()) {
    const key = buildVencimientoKey('AC', ac.id)
    if (existingKeys.has(key)) continue

    const { estado: semaforo } = calcularEstadoSemaforoDesdeFecha(ac.plazoFecha, now)
    if (semaforo !== 'AMARILLO') continue
    if (!isResolvableAccount(ac.responsableId)) continue

    const notification: Notificacion = {
      id: generateId(),
      usuarioId: ac.responsableId,
      empresaId,
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

  // revision-periodica-trazabilidad: solo PUBLICADO (D3 — espejo del backend: un documento en
  // BORRADOR/OBSOLETO/EN_REVISION_PERIODICA con fechaRevisionProxima dentro de la ventana no
  // genera avisos), "hoy" en Lima (D2), y preaviso/vencido como ciclos distintos que pueden
  // coexistir (D1).
  for (const doc of getDocumentsStore()) {
    if (doc.estado !== 'PUBLICADO' || !doc.fechaRevisionProxima) continue

    const diasRestantes = diasHastaEnLima(doc.fechaRevisionProxima, now)
    if (diasRestantes > DOC_REVISION_ALERT_DAYS) continue

    const esVencido = diasRestantes <= 0
    const cicloClave = `${esVencido ? 'VENCIDO' : 'PREAVISO'}:${doc.fechaRevisionProxima.slice(0, 10)}`
    const key = buildVencimientoKey('DOCUMENTO', doc.id, cicloClave)
    if (existingKeys.has(key)) continue

    const recipients = new Set<string>()
    if (isResolvableAccount(doc.autorId)) recipients.add(doc.autorId)
    for (const u of getUsersStore()) {
      const rolEfectivo = getRolEfectivo(u.id, doc.empresaId)
      if (rolEfectivo === 'JEFE_CONTROL_DOCUMENTARIO' || rolEfectivo === 'JEFE_CALIDAD_SYST') recipients.add(u.id)
    }

    const mensaje = esVencido
      ? `La revisión periódica de ${doc.codigo} está vencida. Debe iniciarse la revisión.`
      : `El documento ${doc.codigo} se acerca a su fecha de revisión periódica.`

    let createdAny = false
    for (const usuarioId of recipients) {
      const notification: Notificacion = {
        id: generateId(),
        usuarioId,
        empresaId: doc.empresaId,
        tipo: 'VENCIMIENTO',
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        mensaje,
        leida: false,
        createdAt: now.toISOString(),
        link: `/documentos/${doc.id}`,
        cicloClave,
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
      const rolEfectivo = getRolEfectivo(u.id, inc.empresaId)
      if (rolEfectivo === 'JEFE_CALIDAD_SYST') recipients.add(u.id)
      if (rolEfectivo === 'SUPERVISOR' && (u.areaIds ?? []).includes(inc.areaId)) recipients.add(u.id)
    }

    let createdAny = false
    for (const usuarioId of recipients) {
      const notification: Notificacion = {
        id: generateId(),
        usuarioId,
        empresaId: inc.empresaId,
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
