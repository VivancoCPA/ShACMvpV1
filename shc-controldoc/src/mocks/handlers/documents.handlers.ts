import { http, HttpResponse, delay } from 'msw'
import { jsPDF } from 'jspdf'
import { documentFixtures } from '../fixtures/documents.fixtures'
import { createCambioEstadoNotification, createAsignacionNotification } from '../fixtures/notificationGeneration'
import { DOC_STATUS_TRANSITIONS, DOCUMENT_ASIGNACION_ELIGIBLE_ROLES } from '../../features/documents/constants'
import { getUsersStore } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../fixtures/empresas.fixtures'
import { buildMinimalDocxBytes } from '../utils/minimalDocx'
import { getAreasStore } from './areas.handlers'
import { getSessionUser as getUserFromRequest } from './shared/session'
import { useAuthStore } from '../../stores/authStore'
import { getQeStore } from './quality-events.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import { getDocumentPermissions } from '../../features/documents/permissions'
import type { Documento, DocStatus, DocType, QeVinculadoResumen, NcVinculadoResumen, TipoAsignacion } from '../../types/documents.types'
import type { UserRole } from '../../types/auth.types'
import type { AuditTrailEntry } from '../../types/documents.types'
import type { QEAuditTrailEntry } from '../../features/quality-events/types/qualityEvent.types'
import type { AuditTrailEntry as NCAuditTrailEntry } from '../../features/nonconformities/types/nonconformity.types'

function buildMinimalDistribucionPdfBytes(doc: Documento): Uint8Array {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text(`${doc.codigo} — ${doc.titulo}`, 20, 30)
  pdf.setFontSize(11)
  pdf.text(`Versión ${doc.version} · Estado: ${doc.estado}`, 20, 40)
  pdf.text('PDF de distribución (documento mock — sin backend real)', 20, 50)
  return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer)
}

function nombreArea(areaId: string): string {
  return getAreasStore().find((a) => a.id === areaId)?.nombre ?? areaId
}

const IN_PROCESS_STATUSES = new Set<DocStatus>(['BORRADOR', 'EN_REVISION', 'EN_APROBACION'])

function calcularNuevaVersion(versionActual: string, tipoCambio: 'MENOR' | 'MAYOR'): string {
  const match = versionActual.match(/^v?(\d+)\.(\d+)$/)
  if (!match) return versionActual
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  return tipoCambio === 'MENOR' ? `v${major}.${minor + 1}` : `v${major + 1}.0`
}

const CONFIDENCIAL_ROLES = new Set([
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
])

// Document-relative role, mirrors features/documents/permissions.ts + DocumentDetailPage's
// derivation: access to the original file depends on the caller's assignment on THIS document
// (or being Jefe Calidad), never on their raw global UserRole (RN-DOC-013/016).
function getDocRoleForUser(
  doc: Documento,
  user: { id: string; rol: UserRole } | null,
): 'AUTOR' | 'REVISOR' | 'APROBADOR' | 'JEFE_CALIDAD' | 'OPERARIO' {
  if (!user) return 'OPERARIO'
  if (doc.autorId === user.id) return 'AUTOR'
  if (doc.revisorId === user.id) return 'REVISOR'
  if (doc.aprobadorId === user.id) return 'APROBADOR'
  if (user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'JEFE_CONTROL_DOCUMENTARIO') return 'JEFE_CALIDAD'
  return 'OPERARIO'
}

// nueva-version-autor-permisos: misma regla de elegibilidad que GET /candidatos-asignacion
// (activo, rol elegible para el tipo, asignación activa en la empresa, distinto del autor),
// factorizada para reusarla también al heredar revisor/aprobador en una nueva versión.
function esCandidatoAsignacionValido(
  usuarioId: string,
  tipo: TipoAsignacion,
  autorId: string | undefined,
  empresaId: string | undefined,
): boolean {
  if (usuarioId === autorId) return false
  const elegibles = DOCUMENT_ASIGNACION_ELIGIBLE_ROLES[tipo]
  const usuario = getUsersStore().find((u) => u.id === usuarioId)
  if (!usuario || !usuario.activo || !elegibles.includes(usuario.rol)) return false
  return getEmpresasActivasForUsuario(usuarioId).some((e) => e.id === empresaId)
}

// documentos-notificaciones-pendientes (D1/D4): "pendiente" depende únicamente de la asignación
// directa del actor sobre CADA documento, igual para todos los roles — salvo EN_REVISION_PERIODICA,
// la única etapa sin un asignado individual (solo JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO).
// Reemplaza las reglas anteriores a documentos-revisor-aprobador-reales D1 (SUPERVISOR como único
// revisor, AUDITOR_INTERNO/ALTA_DIRECCION excluidos de aprobador, JEFE_CALIDAD_SYST viendo todo
// EN_REVISION sin ser el asignado, autor sin ver su propio BORRADOR sin enviar).
function filterPendientes(docs: Documento[], userId: string, userRole: UserRole): Documento[] {
  const esJefeCalidadORevisionPeriodica = userRole === 'JEFE_CALIDAD_SYST' || userRole === 'JEFE_CONTROL_DOCUMENTARIO'

  return docs.filter(
    (d) =>
      (d.estado === 'BORRADOR' && d.autorId === userId) ||
      (d.estado === 'EN_REVISION' && d.revisorId === userId) ||
      (d.estado === 'EN_APROBACION' && d.aprobadorId === userId) ||
      (d.estado === 'EN_REVISION_PERIODICA' && esJefeCalidadORevisionPeriodica),
  )
}

const LATENCY = 400

let store: Documento[] = documentFixtures.map((d) => ({ ...d }))

// Expone el store mutable en vivo para que otros handlers (p.ej. dashboard.handlers.ts)
// agreguen sobre el estado real de Documentos, no sobre el fixture estático.
export function getDocumentsStore(): Documento[] {
  return store
}

function resetStore() {
  store = documentFixtures.map((d) => ({ ...d }))
}

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateCodigo(tipo: DocType, empresaId: string): string {
  const count = store.filter((d) => d.tipo === tipo && d.empresaId === empresaId).length + 1
  return `${tipo}-CD-${String(count).padStart(3, '0')}`
}

// RN-EMP-001/003: empresa activa de la sesión — nunca un valor fijo. Mismo mecanismo
// que getSessionUser/getSessionUserUnchecked (shared/session.ts): authStore ya tiene
// el dato en memoria, sin necesidad de un helper compartido nuevo (ver me-f3-scoping-modulos design.md, D1).
function getActiveEmpresaId(): string | null {
  return useAuthStore.getState().empresaActivaId
}

export function makeAuditEntry(
  entidadId: string,
  accion: string,
  fields: Partial<AuditTrailEntry> = {},
): AuditTrailEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entidadTipo: 'Documento',
    entidadId,
    accion,
    realizadoPorId: 'user-mock-001',
    realizadoPorNombre: 'Usuario Mock',
    timestamp: new Date().toISOString(),
    generadoPorIA: false,
    ...fields,
  }
}

// documentos-rechazo-visible: espejo de CambiarEstadoDocumentoHandler.cs — las 3 transiciones
// hacia BORRADOR ganan su propia acción en vez de ESTADO_CAMBIADO.
function getAccionTransicionABorrador(estadoAnterior: DocStatus, estadoNuevo: DocStatus, motivo: string | undefined): string {
  if (estadoNuevo !== 'BORRADOR') return 'ESTADO_CAMBIADO'
  if (estadoAnterior === 'EN_REVISION') return motivo ? 'RECHAZADO_EN_REVISION' : 'REVISION_CANCELADA'
  if (estadoAnterior === 'EN_APROBACION') return 'RECHAZADO_EN_APROBACION'
  return 'ESTADO_CAMBIADO'
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json(
    { success: true, data },
    { status },
  )
}

function err(message: string, status: number, errorCode?: string) {
  return HttpResponse.json(
    { success: false, data: null, message, errorCode },
    { status },
  )
}

// nueva-version-autor-permisos: mismo contrato que FieldValidationException del backend real —
// 400 con `errors: ["campo: mensaje", ...]`, no un mensaje genérico.
function fieldErr(fieldErrors: Record<string, string>) {
  return HttpResponse.json(
    {
      success: false,
      data: null,
      message: 'Error de validación.',
      errors: Object.entries(fieldErrors).map(([campo, mensaje]) => `${campo}: ${mensaje}`),
    },
    { status: 400 },
  )
}

export const documentHandlers = [
  // GET /api/documents — list with pagination + filtering
  http.get('/api/documents', async ({ request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    const estado = url.searchParams.get('estado') as DocStatus | null
    const tipo = url.searchParams.get('tipo') as DocType | null
    const area = url.searchParams.get('areaId')
    const search = url.searchParams.get('search')
    const codigo = url.searchParams.get('codigo')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true'

    // RN-DOC-012: filter by confidencialidad based on simulated user role
    const userRole = url.searchParams.get('_role') ?? 'JEFE_CALIDAD_SYST'
    const activeEmpresaId = getActiveEmpresaId()
    let filtered = store.filter((d) => {
      // RN-EMP-001: nunca mostrar documentos de otra empresa, sin importar el resto de filtros.
      if (d.empresaId !== activeEmpresaId) return false
      // Additive behavior: when includeDeleted=true, show active docs matching filters
      // PLUS all deleted docs. When false, exclude deleted entirely.
      if (!includeDeleted && d.deletedAt) return false
      if (d.confidencialidad === 'PUBLICO' || d.confidencialidad === 'INTERNO') return true
      if (d.confidencialidad === 'CONFIDENCIAL') return CONFIDENCIAL_ROLES.has(userRole)
      // RESTRINGIDO
      return ((d.rolesAutorizados as string[] | undefined) ?? []).includes(userRole)
    })

    const pendientes = url.searchParams.get('pendientes') === 'true'

    // estado filter only applies when not in deleted view and not in pendientes mode
    if (!includeDeleted && !pendientes && estado) filtered = filtered.filter((d) => d.estado === estado)
    if (tipo) filtered = filtered.filter((d) => d.tipo === tipo)
    if (area) filtered = filtered.filter((d) => d.areaId === area)
    if (codigo) filtered = filtered.filter((d) => d.codigo === codigo)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (d) => d.titulo.toLowerCase().includes(q) || d.codigo.toLowerCase().includes(q),
      )
    }

    if (pendientes) {
      const requestUser = getUserFromRequest(request)
      if (requestUser) {
        filtered = filterPendientes(filtered, requestUser.id, requestUser.rol)
      } else {
        filtered = []
      }
    }

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return ok({ items, pagination: { page, pageSize, totalItems, totalPages } })
  }),

  // GET /api/documents/pendientes/count — count pending docs for current user.
  // documentos-notificaciones-pendientes (D5): sin corte temprano por rol — todo rol se evalúa por
  // la misma regla de asignación (filterPendientes). Aplica además la misma cláusula de
  // confidencialidad que GET /api/documents, para que el badge nunca cuente un documento que el
  // listado filtrado (?pendientes=true) no mostraría.
  http.get('/api/documents/pendientes/count', async ({ request }) => {
    await delay(LATENCY)

    const requestUser = getUserFromRequest(request)
    if (!requestUser) {
      return ok({ count: 0 })
    }

    const activeEmpresaId = getActiveEmpresaId()
    const visibleDocs = store.filter((d) => {
      if (d.empresaId !== activeEmpresaId || d.deletedAt) return false
      if (d.confidencialidad === 'PUBLICO' || d.confidencialidad === 'INTERNO') return true
      if (d.confidencialidad === 'CONFIDENCIAL') return CONFIDENCIAL_ROLES.has(requestUser.rol)
      // RESTRINGIDO
      return ((d.rolesAutorizados as string[] | undefined) ?? []).includes(requestUser.rol)
    })
    const pendientesDocs = filterPendientes(visibleDocs, requestUser.id, requestUser.rol)
    return ok({ count: pendientesDocs.length })
  }),

  // GET /api/documents/candidatos-asignacion — mismo contrato y regla D1/D2 que el backend real:
  // usuarios activos con rol elegible, sin el autor (sesión, o autor del documento si viene documentoId).
  // Debe registrarse antes de /api/documents/:id para que ese comodín no lo capture.
  http.get('/api/documents/candidatos-asignacion', async ({ request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    const tipo = url.searchParams.get('tipo') as TipoAsignacion | null
    if (tipo !== 'REVISOR' && tipo !== 'APROBADOR') {
      return err('El parámetro tipo debe ser REVISOR o APROBADOR.', 400)
    }

    let autorId = getUserFromRequest(request)?.id
    const documentoId = url.searchParams.get('documentoId')
    if (documentoId) {
      const doc = store.find((d) => d.id === documentoId)
      if (!doc || doc.empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)
      autorId = doc.autorId
    }

    const activeEmpresaId = getActiveEmpresaId()
    const candidatos = getUsersStore()
      .filter((u) => esCandidatoAsignacionValido(u.id, tipo, autorId, activeEmpresaId))
      .map((u) => ({ id: u.id, nombreCompleto: `${u.nombre} ${u.apellido}`.trim(), rol: u.rol }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))

    return ok(candidatos)
  }),

  // GET /api/documents/:id — detail
  http.get('/api/documents/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const doc = store.find((d) => d.id === params.id)
    if (!doc || doc.empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const requestUser = getUserFromRequest(request)
    const userRole = requestUser?.rol ?? 'OPERARIO'
    const isEditableState = doc.estado === 'BORRADOR' || doc.estado === 'EN_REVISION'
    const docRole = getDocRoleForUser(doc, requestUser)

    // CA-34: JEFE_CONTROL_DOCUMENTARIO and ALTA_DIRECCION can access original of OBSOLETO docs
    const isHistoricalAccess =
      doc.estado === 'OBSOLETO' &&
      (userRole === 'JEFE_CONTROL_DOCUMENTARIO' || userRole === 'ALTA_DIRECCION')

    // RN-DOC-016: solo quien está asignado al documento (autor/revisor/aprobador/Jefe Calidad) lo ve
    // RN-DOC-013: archivoOriginalUrl solo accesible en BORRADOR/EN_REVISION (+ CA-34 excepción)
    const exposeOriginal = (docRole !== 'OPERARIO' && isEditableState) || isHistoricalAccess
    return ok({
      ...doc,
      archivoOriginalUrl: exposeOriginal ? doc.archivoOriginalUrl : null,
      archivoOriginalNombre: exposeOriginal ? doc.archivoOriginalNombre : null,
    })
  }),

  // POST /api/documents — create in BORRADOR
  http.post('/api/documents', async ({ request }) => {
    await delay(LATENCY)

    const activeEmpresaId = getActiveEmpresaId()
    if (!activeEmpresaId) return err('Sesión sin empresa activa', 401)

    const actorId = getUserFromRequest(request)?.id ?? 'user-mock-001'
    const body = await request.json() as Record<string, unknown>
    const tipo = body.tipo as DocType
    const now = new Date().toISOString()
    const codigo = generateCodigo(tipo, activeEmpresaId)

    const blocker = store.find(
      (d) => !d.deletedAt && d.codigo === codigo && d.empresaId === activeEmpresaId && IN_PROCESS_STATUSES.has(d.estado),
    )
    if (blocker) {
      return err(
        `El código ${codigo} ya tiene una versión en estado ${blocker.estado}. Cancela o publica esa versión antes de crear un nuevo borrador (RN-DOC-001).`,
        409,
      )
    }

    const doc: Documento = {
      id: generateId(),
      codigo,
      titulo: body.titulo as string,
      tipo,
      version: (body.version as string | undefined) ?? 'v1.0',
      estado: 'BORRADOR',
      areaId: body.areaId as string,
      empresaId: activeEmpresaId,
      confidencialidad: (body.confidencialidad as Documento['confidencialidad'] | undefined) ?? 'INTERNO',
      rolesAutorizados: body.rolesAutorizados as Documento['rolesAutorizados'],
      autorId: (body.autorId as string | undefined) ?? 'user-mock-001',
      revisorId: body.revisorId as string | undefined,
      aprobadorId: body.aprobadorId as string | undefined,
      descripcion: (body.descripcion as string | undefined) || undefined,
      fechaVigencia: (body.fechaVigencia as string | undefined) || undefined,
      fechaRevisionProxima: (body.fechaRevisionProxima as string | undefined) || undefined,
      archivoOriginalUrl: null,
      archivoOriginalNombre: null,
      archivoOriginalBloqueado: false,
      archivoDistribucionUrl: null,
      qeVinculados: [],
      ncVinculados: [],
      auditTrail: [
        makeAuditEntry('', 'DOCUMENTO_CREADO'),
      ],
      creadoEn: now,
      actualizadoEn: now,
    }
    doc.auditTrail[0].entidadId = doc.id

    store.push(doc)

    if (doc.revisorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        asignadoId: doc.revisorId,
        actorId,
        link: `/documentos/${doc.id}`,
        mensaje: `Se te asignó como revisor del documento ${doc.codigo}.`,
      })
    }
    if (doc.aprobadorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        asignadoId: doc.aprobadorId,
        actorId,
        link: `/documentos/${doc.id}`,
        mensaje: `Se te asignó como aprobador del documento ${doc.codigo}.`,
      })
    }

    return ok(doc, 201)
  }),

  // PUT /api/documents/:id — update (BORRADOR only)
  http.put('/api/documents/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    if (doc.estado !== 'BORRADOR') {
      return err('Solo se pueden editar documentos en estado BORRADOR', 409)
    }

    const body = await request.json() as Partial<Documento>
    const allowed: (keyof Documento)[] = [
      'titulo',
      'descripcion',
      'revisorId',
      'aprobadorId',
      'fechaVigencia',
      'fechaRevisionProxima',
      'version',
      'areaId',
      'confidencialidad',
      'rolesAutorizados',
    ]

    const updated: Documento = { ...doc, actualizadoEn: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(updated as any)[key] = body[key]
      }
    }

    store[idx] = updated

    const actorId = getUserFromRequest(request)?.id ?? 'user-mock-001'
    if (updated.revisorId && updated.revisorId !== doc.revisorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: updated.id,
        entidadCodigo: updated.codigo,
        empresaId: updated.empresaId,
        asignadoId: updated.revisorId,
        actorId,
        link: `/documentos/${updated.id}`,
        mensaje: `Se te asignó como revisor del documento ${updated.codigo}.`,
      })
    }
    if (updated.aprobadorId && updated.aprobadorId !== doc.aprobadorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: updated.id,
        entidadCodigo: updated.codigo,
        empresaId: updated.empresaId,
        asignadoId: updated.aprobadorId,
        actorId,
        link: `/documentos/${updated.id}`,
        mensaje: `Se te asignó como aprobador del documento ${updated.codigo}.`,
      })
    }

    return ok(updated)
  }),

  // POST /api/documents/:id/status — state transition
  http.post('/api/documents/:id/status', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const nuevoEstado = body.nuevoEstado as DocStatus
    const comentario = body.comentario as string | undefined
    const firma = body.firma as string | undefined
    const notificarAutor = body.notificarAutor as boolean | undefined

    // RN-DOC-004: firma requerida
    if (!firma) {
      return err('Se requiere firma (PIN) para cambiar el estado (RN-DOC-004)', 400)
    }

    const doc = store[idx]
    const validNext = DOC_STATUS_TRANSITIONS[doc.estado] ?? []

    // Validate state machine transition
    if (!validNext.includes(nuevoEstado)) {
      return err(
        `Transición inválida: ${doc.estado} → ${nuevoEstado}`,
        422,
      )
    }

    // RN-DOC-005: block OBSOLETO if QEs vinculados (tratamos todos como activos en mock)
    if (nuevoEstado === 'OBSOLETO' && doc.qeVinculados.length > 0) {
      return err(
        `No se puede obsoletizar: el documento tiene QEs vinculados activos (${doc.qeVinculados.join(', ')}) (RN-DOC-005)`,
        409,
      )
    }

    // RN-DOC-001: si se publica, obsoletizar la versión publicada del mismo código (misma empresa —
    // el código ya no es único entre empresas desde que la numeración es correlativa por empresa, RN-EMP-003)
    if (nuevoEstado === 'PUBLICADO') {
      // RN-DOC-005 (fs-vinculacion-documento-qe): no se obsoletiza la versión previa si tiene un
      // vínculo a un QE cuyo estado no es CERRADO ni VERIFICADO. Chequeo previo, sin mutar nada,
      // para bloquear la transición completa si corresponde — cierra el gap donde este bucle
      // nunca validaba vínculos (antes de este cambio, el único check de RN-DOC-005 vivía en la
      // rama de OBSOLETO manual, inalcanzable desde la UI).
      const vinculoActivo = store
        .filter((d) => d.codigo === doc.codigo && d.empresaId === doc.empresaId && d.id !== doc.id && d.estado === 'PUBLICADO')
        .flatMap((d) => d.qeVinculados)
        .find((v) => v.estado !== 'CERRADO' && v.estado !== 'VERIFICADO')
      if (vinculoActivo) {
        return err(
          `No se puede publicar: la versión anterior tiene un Quality Event vinculado activo (${vinculoActivo.numero}) (RN-DOC-005)`,
          409,
        )
      }

      for (let i = 0; i < store.length; i++) {
        if (store[i].codigo === doc.codigo && store[i].empresaId === doc.empresaId && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
          store[i] = {
            ...store[i],
            estado: 'OBSOLETO',
            actualizadoEn: new Date().toISOString(),
            auditTrail: [
              ...store[i].auditTrail,
              makeAuditEntry(store[i].id, 'ESTADO_CAMBIADO', {
                estadoAnterior: 'PUBLICADO',
                estadoNuevo: 'OBSOLETO',
              }),
            ],
          }
        }
      }
    }

    const now = new Date().toISOString()
    const mockDistribucionUrlStatus = nuevoEstado === 'PUBLICADO'
      ? `/mock/distribuciones/${doc.id}/${doc.codigo}-${doc.version}.pdf`
      : undefined
    const updated: Documento = {
      ...doc,
      estado: nuevoEstado,
      actualizadoEn: now,
      ...(nuevoEstado === 'PUBLICADO' && {
        archivoOriginalBloqueado: true,
        archivoDistribucionUrl: mockDistribucionUrlStatus ?? null,
      }),
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'ESTADO_CAMBIADO', {
          estadoAnterior: doc.estado,
          estadoNuevo: nuevoEstado,
          valorAnterior: comentario,
        }),
        ...(nuevoEstado === 'PUBLICADO' ? [
          makeAuditEntry(doc.id, 'ARCHIVO_ORIGINAL_CONGELADO'),
          makeAuditEntry(doc.id, 'ARCHIVO_DISTRIBUCION_GENERADO', { valorNuevo: mockDistribucionUrlStatus }),
        ] : []),
      ],
    }

    store[idx] = updated

    if (nuevoEstado === 'BORRADOR' && doc.estado === 'EN_REVISION' && notificarAutor === true) {
      const actorId = getUserFromRequest(request)?.id ?? 'user-mock-001'
      createCambioEstadoNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        estadoNuevo: nuevoEstado,
        reportadoPorId: doc.autorId,
        responsablesACActivas: [],
        actorId,
        link: `/documentos/${doc.id}`,
      })
    }

    return ok(updated)
  }),

  // POST /api/documents/:id/upload — file upload simulation
  // NOTE: MSW cannot parse multipart/form-data boundaries in the browser.
  // This handler ignores the request body and returns a mock archivoUrl + hashArchivo.
  http.post('/api/documents/:id/upload', async ({ params }) => {
    await delay(800)

    const id = params.id as string
    const idx = store.findIndex((d) => d.id === id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const filename = `documento-${id}.pdf`
    const archivoUrl = `/mock/uploads/${id}/${filename}`
    const hashArchivo = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('')

    store[idx] = {
      ...store[idx],
      archivoUrl,
      hashArchivo,
      actualizadoEn: new Date().toISOString(),
    }

    return ok({ archivoUrl, hashArchivo })
  }),

  // DELETE /api/documents/:id — soft delete (sets deletedAt)
  http.delete('/api/documents/:id', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]

    if (doc.deletedAt) {
      return err('El documento ya está eliminado', 409)
    }

    if (doc.estado !== 'BORRADOR' && doc.estado !== 'EN_REVISION') {
      return err('Solo se pueden eliminar documentos en estado BORRADOR o EN_REVISION', 409)
    }

    if (doc.qeVinculados.length > 0) {
      return err(
        `No se puede eliminar: el documento tiene QEs vinculados (${doc.qeVinculados.join(', ')})`,
        409,
      )
    }

    if (doc.ncVinculados.length > 0) {
      return err(
        `No se puede eliminar: el documento tiene No Conformidades vinculadas (${doc.ncVinculados.map((n) => n.numero).join(', ')})`,
        409,
      )
    }

    const now = new Date().toISOString()
    store[idx] = {
      ...doc,
      deletedAt: now,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'DOCUMENTO_ELIMINADO', {
          estadoAnterior: doc.estado,
        }),
      ],
    }
    return ok(null)
  }),

  // PATCH /api/documents/:id/status — state transition without PIN (for non-signing actions)
  http.patch('/api/documents/:id/status', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const nuevoEstado = body.estado as DocStatus
    const motivo = body.motivo as string | undefined
    const notificarAutor = body.notificarAutor as boolean | undefined

    const doc = store[idx]
    const validNext = DOC_STATUS_TRANSITIONS[doc.estado] ?? []

    if (!validNext.includes(nuevoEstado)) {
      return err(`Transición inválida: ${doc.estado} → ${nuevoEstado}`, 422)
    }

    // nueva-version-autor-permisos (D3): un documento sin revisor/aprobador asignado no puede
    // enviarse a revisión — error de validación por campo, no un 403/422 genérico. Espejo de
    // CambiarEstadoDocumentoHandler (backend real).
    if (doc.estado === 'BORRADOR' && nuevoEstado === 'EN_REVISION') {
      const camposFaltantes: Record<string, string> = {}
      if (!doc.revisorId) camposFaltantes.revisorId = 'Asigná un revisor antes de enviar a revisión.'
      if (!doc.aprobadorId) camposFaltantes.aprobadorId = 'Asigná un aprobador antes de enviar a revisión.'
      if (Object.keys(camposFaltantes).length > 0) return fieldErr(camposFaltantes)
    }

    if (nuevoEstado === 'OBSOLETO' && doc.qeVinculados.length > 0) {
      return err(
        `No se puede obsoletizar: QEs vinculados activos (${doc.qeVinculados.join(', ')}) (RN-DOC-005)`,
        409,
      )
    }

    // RN-DOC-001: obsoletizar versión publicada del mismo código (misma empresa)
    if (nuevoEstado === 'PUBLICADO') {
      for (let i = 0; i < store.length; i++) {
        if (store[i].codigo === doc.codigo && store[i].empresaId === doc.empresaId && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
          store[i] = {
            ...store[i],
            estado: 'OBSOLETO',
            actualizadoEn: new Date().toISOString(),
            auditTrail: [
              ...store[i].auditTrail,
              makeAuditEntry(store[i].id, 'ESTADO_CAMBIADO', {
                estadoAnterior: 'PUBLICADO',
                estadoNuevo: 'OBSOLETO',
              }),
            ],
          }
        }
      }
    }

    const now = new Date().toISOString()
    const mockDistribucionUrlPatch = nuevoEstado === 'PUBLICADO'
      ? `/mock/distribuciones/${doc.id}/${doc.codigo}-${doc.version}.pdf`
      : undefined
    const updated: Documento = {
      ...doc,
      estado: nuevoEstado,
      actualizadoEn: now,
      ...(nuevoEstado === 'PUBLICADO' && {
        archivoOriginalBloqueado: true,
        archivoDistribucionUrl: mockDistribucionUrlPatch ?? null,
      }),
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, getAccionTransicionABorrador(doc.estado, nuevoEstado, motivo), {
          estadoAnterior: doc.estado,
          estadoNuevo: nuevoEstado,
          motivo,
        }),
        ...(nuevoEstado === 'PUBLICADO' ? [
          makeAuditEntry(doc.id, 'ARCHIVO_ORIGINAL_CONGELADO'),
          makeAuditEntry(doc.id, 'ARCHIVO_DISTRIBUCION_GENERADO', { valorNuevo: mockDistribucionUrlPatch }),
        ] : []),
      ],
    }

    store[idx] = updated

    const actorId = getUserFromRequest(request)?.id ?? 'user-mock-001'
    const link = `/documentos/${doc.id}`

    if (nuevoEstado === 'BORRADOR' && doc.estado === 'EN_REVISION' && notificarAutor === true) {
      // Rechazo formal (con motivo, DocumentRejectModal) — ya existente.
      createCambioEstadoNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        estadoNuevo: nuevoEstado,
        reportadoPorId: doc.autorId,
        responsablesACActivas: [],
        actorId,
        link,
      })
    } else if (nuevoEstado === 'BORRADOR' && doc.estado === 'EN_REVISION' && !motivo) {
      // Cancelar revisión (sin motivo, docRole JEFE_CALIDAD) — notifica a autor y revisor
      // (documentos-notificaciones-pendientes, design.md D2).
      createCambioEstadoNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        estadoNuevo: nuevoEstado,
        reportadoPorId: doc.autorId,
        responsablesACActivas: doc.revisorId ? [doc.revisorId] : [],
        actorId,
        link,
      })
    }

    if (nuevoEstado === 'EN_REVISION' && doc.estado === 'BORRADOR' && doc.revisorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        asignadoId: doc.revisorId,
        actorId,
        link,
        mensaje: `${doc.codigo} está listo para tu revisión.`,
      })
    }

    if (nuevoEstado === 'EN_APROBACION' && doc.estado === 'EN_REVISION' && doc.aprobadorId) {
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        asignadoId: doc.aprobadorId,
        actorId,
        link,
        mensaje: `${doc.codigo} está listo para tu aprobación.`,
      })
    }

    if (nuevoEstado === 'EN_REVISION_PERIODICA' && doc.estado === 'PUBLICADO') {
      createCambioEstadoNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: doc.id,
        entidadCodigo: doc.codigo,
        empresaId: doc.empresaId,
        estadoNuevo: nuevoEstado,
        reportadoPorId: doc.autorId,
        responsablesACActivas: [],
        actorId,
        link,
      })
    }

    return ok(updated)
  }),

  // POST /api/documents/:id/sign — electronic signature + publish (RN-DOC-004)
  http.post('/api/documents/:id/sign', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const pin = body.pin as string

    // Valida contra el PIN configurado por el propio firmante (getUsersStore(), store mutable
    // cross-dominio — nunca un valor fijo), no un MOCK_PIN agnóstico de identidad.
    const sessionUser = getUserFromRequest(request)
    if (!sessionUser) return err('Sesión expirada', 401)
    const signer = getUsersStore().find((u) => u.id === sessionUser.id)
    if (!signer) return err('Sesión expirada', 401)
    if (!signer.pin) {
      return err(
        'Debés configurar tu PIN de firma antes de firmar (POST /api/auth/set-pin)',
        422,
        'PIN_NO_CONFIGURADO',
      )
    }
    if (pin !== signer.pin) {
      return err('PIN incorrecto', 401)
    }

    const doc = store[idx]
    if (doc.estado !== 'EN_APROBACION') {
      return err('Solo se puede firmar un documento en estado EN_APROBACION', 409)
    }

    // pdf-distribucion-real: RN-DOC-017 permite documentos sin archivo original, pero sin él no
    // hay nada que convertir a PDF real — simula el mismo bloqueo que el backend real
    // (FirmarPublicarDocumentoHandler) en vez de generar una portada dummy como sustituto.
    if (!doc.archivoOriginalUrl) {
      return err(
        'El documento no tiene archivo original; súbelo antes de enviarlo a aprobación',
        422,
        'SIN_ARCHIVO_ORIGINAL',
      )
    }

    // RN-DOC-001: obsoletizar versión publicada del mismo código (misma empresa)
    for (let i = 0; i < store.length; i++) {
      if (store[i].codigo === doc.codigo && store[i].empresaId === doc.empresaId && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
        store[i] = {
          ...store[i],
          estado: 'OBSOLETO',
          actualizadoEn: new Date().toISOString(),
          auditTrail: [
            ...store[i].auditTrail,
            makeAuditEntry(store[i].id, 'ESTADO_CAMBIADO', {
              estadoAnterior: 'PUBLICADO',
              estadoNuevo: 'OBSOLETO',
            }),
          ],
        }
      }
    }

    const now = new Date().toISOString()
    const mockHash = `sha256-mock-${doc.id}`
    const mockDistribucionUrlSign = `/mock/distribuciones/${doc.id}/${doc.codigo}-${doc.version}.pdf`
    const updated: Documento = {
      ...doc,
      estado: 'PUBLICADO',
      hashArchivo: mockHash,
      archivoOriginalBloqueado: true,
      archivoDistribucionUrl: mockDistribucionUrlSign,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'FIRMA_REGISTRADA', {
          estadoAnterior: 'EN_APROBACION',
          estadoNuevo: 'PUBLICADO',
          valorNuevo: mockHash,
        }),
        makeAuditEntry(doc.id, 'ARCHIVO_ORIGINAL_CONGELADO'),
        makeAuditEntry(doc.id, 'ARCHIVO_DISTRIBUCION_GENERADO', {
          valorNuevo: mockDistribucionUrlSign,
        }),
      ],
    }

    store[idx] = updated

    // Publicación — notifica a autor y revisor (informativo), nunca al propio firmante
    // (documentos-notificaciones-pendientes, design.md D2).
    const actorIdSign = getUserFromRequest(request)?.id ?? 'user-mock-001'
    createCambioEstadoNotification({
      entidadTipo: 'DOCUMENTO',
      entidadId: doc.id,
      entidadCodigo: doc.codigo,
      empresaId: doc.empresaId,
      estadoNuevo: 'PUBLICADO',
      reportadoPorId: doc.autorId,
      responsablesACActivas: doc.revisorId ? [doc.revisorId] : [],
      actorId: actorIdSign,
      link: `/documentos/${doc.id}`,
    })

    return ok(updated)
  }),

  // GET /api/documents/:id/archivo — signed view URL + VISUALIZACION audit (RN-DOC-008/009)
  http.get('/api/documents/:id/archivo', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const ext = doc.archivoUrl?.split('.').pop() ?? 'pdf'
    const tipoArchivo = doc.tipoArchivo ?? 'application/pdf'
    const nombreArchivo = `${doc.codigo}-${doc.version}.${ext}`
    const now = new Date().toISOString()

    store[idx] = {
      ...doc,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'VISUALIZACION', { timestamp: now }),
      ],
    }

    return ok({
      url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/pdf-sample.pdf',
      expiresAt,
      nombreArchivo,
      tipoArchivo,
    })
  }),

  // POST /api/documents/:id/nueva-version — create new version draft (RN-DOC-002)
  http.post('/api/documents/:id/nueva-version', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]

    // nueva-version-autor-permisos: solo el autor del documento origen o un Jefe de
    // Calidad/Control Documentario (rol global) puede iniciar una nueva versión — espejo de
    // NuevaVersionDocumentoEndpoint (backend real). Antes cualquier usuario autenticado podía.
    const actor = getUserFromRequest(request)
    const puedeCrearVersion = actor?.id === doc.autorId
      || actor?.rol === 'JEFE_CALIDAD_SYST' || actor?.rol === 'JEFE_CONTROL_DOCUMENTARIO'
    if (!puedeCrearVersion) {
      return err('No tenés permiso para crear una nueva versión de este documento', 403)
    }

    const versionEnProceso = store.find(
      (d) => !d.deletedAt && d.codigo === doc.codigo && d.empresaId === doc.empresaId && d.id !== doc.id && IN_PROCESS_STATUSES.has(d.estado),
    )
    if (versionEnProceso) {
      return err(
        `El código ${doc.codigo} ya tiene una versión en estado ${versionEnProceso.estado}. Cancela o publica esa versión antes de crear una nueva (RN-DOC-001).`,
        409,
      )
    }

    const body = await request.json() as { tipoCambio: 'MENOR' | 'MAYOR'; motivo: string }
    const nuevaVersion = calcularNuevaVersion(doc.version, body.tipoCambio)
    const now = new Date().toISOString()
    const newId = generateId()
    const activeEmpresaId = getActiveEmpresaId()

    // nueva-version-autor-permisos (D1): el autor de la nueva versión es quien la crea, nunca el
    // autor del origen. Revisor/aprobador se heredan solo si son distintos del nuevo autor y
    // siguen siendo candidatos elegibles para él — misma regla que GET /candidatos-asignacion.
    const nuevoAutorId = actor!.id
    const revisorHeredado = doc.revisorId && esCandidatoAsignacionValido(doc.revisorId, 'REVISOR', nuevoAutorId, activeEmpresaId)
      ? doc.revisorId
      : undefined
    const aprobadorHeredado = doc.aprobadorId && esCandidatoAsignacionValido(doc.aprobadorId, 'APROBADOR', nuevoAutorId, activeEmpresaId)
      ? doc.aprobadorId
      : undefined

    const newDoc = {
      ...doc,
      id: newId,
      version: nuevaVersion,
      estado: 'BORRADOR' as const,
      versionAnteriorId: doc.id,
      archivoUrl: undefined,
      hashArchivo: undefined,
      fechaEmision: undefined,
      autorId: nuevoAutorId,
      revisorId: revisorHeredado,
      aprobadorId: aprobadorHeredado,
      archivoOriginalBloqueado: false,
      archivoDistribucionUrl: null,
      qeVinculados: [],
      ncVinculados: [],
      auditTrail: [
        makeAuditEntry(newId, 'DOCUMENTO_CREADO', {
          valorNuevo: `Nueva versión ${nuevaVersion} iniciada. Motivo: ${body.motivo}`,
        }),
        makeAuditEntry(newId, 'ARCHIVO_ORIGINAL_COPIADO_A_VERSION', {
          valorNuevo: doc.archivoOriginalUrl ?? 'sin archivo original en versión anterior',
        }),
      ],
      creadoEn: now,
      actualizadoEn: now,
    }

    store[idx] = {
      ...doc,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'NUEVA_VERSION_INICIADA', {
          valorNuevo: `Nueva versión ${nuevaVersion} iniciada. Motivo: ${body.motivo}`,
        }),
      ],
    }

    store.push(newDoc)

    const actorIdNuevaVersion = getUserFromRequest(request)?.id ?? 'user-mock-001'
    const linkNuevaVersion = `/documentos/${newDoc.id}`
    for (const destinatarioId of [newDoc.revisorId, newDoc.aprobadorId]) {
      if (!destinatarioId) continue
      createAsignacionNotification({
        entidadTipo: 'DOCUMENTO',
        entidadId: newDoc.id,
        entidadCodigo: newDoc.codigo,
        empresaId: newDoc.empresaId,
        asignadoId: destinatarioId,
        actorId: actorIdNuevaVersion,
        link: linkNuevaVersion,
        mensaje: `Fuiste designado para la revisión/aprobación de la nueva versión de ${newDoc.codigo} (${newDoc.version}).`,
      })
    }

    return ok(newDoc, 201)
  }),

  // POST /api/documents/:id/exportar-pdf — watermarked PDF for controlled copy (RN-DOC-007)
  http.post('/api/documents/:id/exportar-pdf', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    if (doc.estado !== 'PUBLICADO') {
      return err('Solo se puede exportar documentos en estado PUBLICADO', 409)
    }

    const body = await request.json() as { userNombreCompleto: string }
    const limaTime = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
    const fileName = `${doc.codigo}-${doc.version}-controlado.pdf`
    const now = new Date().toISOString()

    store[idx] = {
      ...store[idx],
      actualizadoEn: now,
      auditTrail: [
        ...store[idx].auditTrail,
        makeAuditEntry(doc.id, 'DESCARGA', {
          timestamp: now,
          valorNuevo: `Archivo: ${fileName}`,
        }),
      ],
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${doc.codigo} — ${doc.titulo}</title>
  <style>
    body { font-family: sans-serif; margin: 40px; color: #141413; background: #ffffff; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg);
      font-size: 48px; color: rgba(0,0,0,0.07); white-space: nowrap; pointer-events: none; user-select: none; }
    .header { border-bottom: 2px solid #e6dfd8; padding-bottom: 16px; margin-bottom: 24px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
    .meta dt { font-weight: 600; color: #6c6a64; font-size: 12px; text-transform: uppercase; }
    .meta dd { margin: 0; font-size: 14px; }
    .copy-notice { margin-top: 40px; padding: 12px; background: #f5f0e8; border: 1px solid #e6dfd8;
      font-size: 12px; color: #4a4a4a; }
    .user-info { font-weight: bold; color: #4a4a4a; }
  </style>
</head>
<body>
  <div class="watermark">COPIA NO CONTROLADA</div>
  <div class="header">
    <h1>${doc.codigo} — ${doc.titulo}</h1>
    <p>Versión ${doc.version} &middot; Estado: ${doc.estado} &middot; Área: ${nombreArea(doc.areaId)}</p>
  </div>
  <dl class="meta">
    <dt>Tipo</dt><dd>${doc.tipo}</dd>
    <dt>Área</dt><dd>${nombreArea(doc.areaId)}</dd>
    <dt>Emisión</dt><dd>${doc.fechaEmision ?? '—'}</dd>
    <dt>Vigencia</dt><dd>${doc.fechaVigencia ?? '—'}</dd>
  </dl>
  <div class="copy-notice">
    <p class="user-info">Descargado por: ${body.userNombreCompleto}</p>
    <p>Fecha y hora Lima (GMT-5): ${limaTime}</p>
    <p><strong>COPIA NO CONTROLADA — Solo válido al momento de impresión</strong></p>
    <p>Hash SHA-256: ${doc.hashArchivo ?? 'sin firma'}</p>
  </div>
</body>
</html>`

    const encoder = new TextEncoder()
    const bytes = encoder.encode(htmlContent)

    return new HttpResponse(bytes.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  }),

  // GET /api/documents/:id/download-url — signed URL (RN-DOC-009)
  http.get('/api/documents/:id/download-url', async ({ params, request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    if (url.searchParams.get('expired') === 'true') {
      return HttpResponse.json(
        { success: false, data: null, message: 'URL de descarga expirada' },
        { status: 403 },
      )
    }

    const doc = store.find((d) => d.id === params.id)
    if (!doc || doc.empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    return ok({ url: `mock://signed-url-${params.id as string}`, expiresAt })
  }),

  // PATCH /api/documents/:id/confirmar-revision — confirm periodic review, renew next review date
  http.patch('/api/documents/:id/confirmar-revision', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    if (doc.estado !== 'PUBLICADO' && doc.estado !== 'EN_REVISION_PERIODICA') {
      return err('La revisión periódica solo aplica a documentos PUBLICADO o EN_REVISION_PERIODICA', 409)
    }

    const now = new Date()
    let fechaRevisionProxima: string | undefined = undefined
    switch (doc.tipo) {
      case 'POL':
      case 'PRC':
      case 'PLAN':
        fechaRevisionProxima = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
        break
      case 'MAT':
        fechaRevisionProxima = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()).toISOString()
        break
      case 'INS':
        fechaRevisionProxima = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString()
        break
      case 'REG':
      case 'INF':
        fechaRevisionProxima = undefined
        break
    }

    const nowStr = now.toISOString()
    const detalle = fechaRevisionProxima
      ? `Documento confirmado vigente sin cambios. Próxima revisión: ${fechaRevisionProxima}`
      : 'Documento confirmado vigente sin cambios. Sin próxima revisión programada.'

    const updated: Documento = {
      ...doc,
      estado: 'PUBLICADO',
      fechaRevisionProxima,
      actualizadoEn: nowStr,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'REVISION_PERIODICA_CONFIRMADA', {
          estadoAnterior: doc.estado,
          estadoNuevo: 'PUBLICADO',
          valorNuevo: detalle,
        }),
      ],
    }

    store[idx] = updated
    return ok(updated)
  }),

  // PATCH /api/documents/:id/restaurar — restore a soft-deleted document.
  // documentos-notificaciones-pendientes (D2): solo JEFE_CALIDAD_SYST y ALTA_DIRECCION — mismo
  // criterio que ya exigía el frontend (DocumentActionPanel.tsx canRestore), ahora también en el
  // backend real (RestaurarDocumentoEndpoint).
  http.patch('/api/documents/:id/restaurar', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const requestUser = getUserFromRequest(request)
    if (!requestUser || (requestUser.rol !== 'JEFE_CALIDAD_SYST' && requestUser.rol !== 'ALTA_DIRECCION')) {
      return err('No tenés permiso para restaurar este documento', 403)
    }

    const doc = store[idx]
    if (!doc.deletedAt) {
      return err('El documento no está eliminado', 409)
    }

    const now = new Date().toISOString()
    const updated: Documento = {
      ...doc,
      deletedAt: undefined,
      estado: 'BORRADOR',
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'RESTAURADO', {
          estadoAnterior: 'ELIMINADO',
          estadoNuevo: 'BORRADOR',
          valorNuevo: 'Documento restaurado desde estado eliminado',
        }),
      ],
    }

    store[idx] = updated
    return ok(updated)
  }),

  // POST /api/documents/:id/audit/access — register DESCARGA or VISUALIZACION (RN-DOC-008)
  http.post('/api/documents/:id/audit/access', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const accion = body.accion as string
    const timestamp = (body.timestamp as string | undefined) ?? new Date().toISOString()

    store[idx] = {
      ...store[idx],
      auditTrail: [
        ...store[idx].auditTrail,
        makeAuditEntry(params.id as string, accion, { timestamp }),
      ],
    }

    return ok({ success: true })
  }),

  // GET /api/documents/:id/archivo-original — download original editable file as Blob (RN-DOC-013, RN-DOC-016)
  http.get('/api/documents/:id/archivo-original', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]

    const requestUser = getUserFromRequest(request)
    const userRole = requestUser?.rol ?? 'OPERARIO'
    const docRole = getDocRoleForUser(doc, requestUser)
    const isEditableState = doc.estado === 'BORRADOR' || doc.estado === 'EN_REVISION'

    // CA-34: JEFE_CONTROL_DOCUMENTARIO and ALTA_DIRECCION can access original of OBSOLETO docs
    const isHistoricalAccess =
      doc.estado === 'OBSOLETO' &&
      (userRole === 'JEFE_CONTROL_DOCUMENTARIO' || userRole === 'ALTA_DIRECCION')

    if (!((docRole !== 'OPERARIO' && isEditableState) || isHistoricalAccess)) {
      return err('Acceso denegado al archivo original (RN-DOC-013, RN-DOC-016)', 403)
    }

    if (!doc.archivoOriginalUrl) {
      return err('Documento sin archivo original', 404)
    }

    const fileName = doc.archivoOriginalNombre ?? `${doc.codigo}-original.docx`
    const now = new Date().toISOString()

    store[idx] = {
      ...doc,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'DESCARGA_ARCHIVO_ORIGINAL', {
          timestamp: now,
          campoModificado: 'archivo',
          valorNuevo: fileName,
        }),
      ],
    }

    const bytes = buildMinimalDocxBytes(`${doc.codigo} — ${doc.titulo} (archivo original, documento mock)`)
    return new HttpResponse(bytes.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  }),

  // POST /api/documents/:id/archivo-original — replace original editable file (RN-DOC-013, RN-DOC-015)
  // NOTE: MSW cannot parse multipart/form-data boundaries. Body is ignored; a mock URL is returned.
  http.post('/api/documents/:id/archivo-original', async ({ params }) => {
    await delay(LATENCY)

    const id = params.id as string
    const idx = store.findIndex((d) => d.id === id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]

    if (doc.archivoOriginalBloqueado) {
      return err('El archivo original está congelado y no puede ser reemplazado (RN-DOC-015)', 403)
    }

    const isEditableState = doc.estado === 'BORRADOR' || doc.estado === 'EN_REVISION'
    if (!isEditableState) {
      return err('Solo se puede actualizar el archivo original en BORRADOR o EN_REVISION (RN-DOC-013)', 403)
    }

    const now = new Date().toISOString()
    const mockUrl = `/mock/originales/${id}/documento-${Date.now()}.docx`
    const mockNombre = `documento-${Date.now()}.docx`

    store[idx] = {
      ...doc,
      archivoOriginalUrl: mockUrl,
      archivoOriginalNombre: mockNombre,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(id, 'ARCHIVO_ORIGINAL_ACTUALIZADO', {
          valorAnterior: doc.archivoOriginalUrl ?? 'sin archivo',
          valorNuevo: mockUrl,
        }),
      ],
    }

    return ok({ archivoOriginalUrl: mockUrl, archivoOriginalNombre: mockNombre })
  }),

  // GET /api/documents/:id/archivo-distribucion — download distribution PDF as Blob (RN-DOC-018)
  http.get('/api/documents/:id/archivo-distribucion', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]

    if (!doc.archivoDistribucionUrl) {
      return err('Documento sin PDF de distribución', 404)
    }

    const fileName = `${doc.codigo}-${doc.version}-distribucion.pdf`
    const now = new Date().toISOString()

    store[idx] = {
      ...doc,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'DESCARGA', {
          timestamp: now,
          campoModificado: 'archivo',
          valorNuevo: fileName,
        }),
      ],
    }

    const bytes = buildMinimalDistribucionPdfBytes(doc)
    return new HttpResponse(bytes.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  }),

  // POST /api/documents/:id/qe-vinculados — vincular un QE (fs-vinculacion-documento-qe)
  http.post('/api/documents/:id/qe-vinculados', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const currentUser = getUserFromRequest(request)
    const docRole = getDocRoleForUser(doc, currentUser)
    const permisos = getDocumentPermissions(doc.estado, docRole)
    if (!permisos.canEdit) return err('No tenés permiso para vincular Quality Events a este documento', 403)

    const body = (await request.json()) as { qualityEventId: string }
    const qeStore = getQeStore()
    const qeIdx = qeStore.findIndex((q) => q.id === body.qualityEventId)
    if (qeIdx === -1 || qeStore[qeIdx].empresaId !== getActiveEmpresaId()) return err('Quality Event no encontrado', 404)

    const qe = qeStore[qeIdx]
    const now = new Date().toISOString()
    const actorId = currentUser?.id ?? 'user-mock-001'
    const actorNombre = currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Usuario Mock'

    if (!doc.qeVinculados.some((v) => v.id === qe.id)) {
      const qeResumen: QeVinculadoResumen = { id: qe.id, numero: qe.numero, tipo: qe.tipo, severidad: qe.severidad, estado: qe.estado }
      store[idx] = {
        ...doc,
        qeVinculados: [...doc.qeVinculados, qeResumen],
        actualizadoEn: now,
        auditTrail: [...doc.auditTrail, makeAuditEntry(doc.id, 'DOCUMENTO_VINCULADO', { valorNuevo: qe.id, realizadoPorId: actorId, realizadoPorNombre: actorNombre })],
      }

      const docResumen = { id: doc.id, codigo: doc.codigo, titulo: doc.titulo, estado: doc.estado }
      const qeAuditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'QE_VINCULADO',
        valorNuevo: doc.id,
        realizadoPorId: actorId,
        realizadoPorNombre: actorNombre,
        timestamp: now,
        generadoPorIA: false,
      }
      qeStore[qeIdx] = {
        ...qe,
        documentosVinculados: [...qe.documentosVinculados, docResumen],
        actualizadoEn: now,
        auditTrail: [...qe.auditTrail, qeAuditEntry],
      }
    }

    return ok(store[idx])
  }),

  // DELETE /api/documents/:id/qe-vinculados/:qualityEventId — desvincular (fs-vinculacion-documento-qe)
  http.delete('/api/documents/:id/qe-vinculados/:qualityEventId', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const currentUser = getUserFromRequest(request)
    const docRole = getDocRoleForUser(doc, currentUser)
    const permisos = getDocumentPermissions(doc.estado, docRole)
    if (!permisos.canEdit) return err('No tenés permiso para desvincular Quality Events de este documento', 403)

    const qualityEventId = params.qualityEventId as string
    if (!doc.qeVinculados.some((v) => v.id === qualityEventId)) return err('Vínculo no encontrado', 404)

    const now = new Date().toISOString()
    const actorId = currentUser?.id ?? 'user-mock-001'
    const actorNombre = currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Usuario Mock'

    store[idx] = {
      ...doc,
      qeVinculados: doc.qeVinculados.filter((v) => v.id !== qualityEventId),
      actualizadoEn: now,
      auditTrail: [...doc.auditTrail, makeAuditEntry(doc.id, 'DOCUMENTO_DESVINCULADO', { valorAnterior: qualityEventId, realizadoPorId: actorId, realizadoPorNombre: actorNombre })],
    }

    const qeStore = getQeStore()
    const qeIdx = qeStore.findIndex((q) => q.id === qualityEventId)
    if (qeIdx !== -1) {
      const qe = qeStore[qeIdx]
      const qeAuditEntry: QEAuditTrailEntry = {
        id: `aud-${qe.id}-${qe.auditTrail.length + 1}`,
        entidadTipo: 'QualityEvent',
        entidadId: qe.id,
        accion: 'QE_DESVINCULADO',
        valorAnterior: doc.id,
        realizadoPorId: actorId,
        realizadoPorNombre: actorNombre,
        timestamp: now,
        generadoPorIA: false,
      }
      qeStore[qeIdx] = {
        ...qe,
        documentosVinculados: qe.documentosVinculados.filter((d) => d.id !== doc.id),
        actualizadoEn: now,
        auditTrail: [...qe.auditTrail, qeAuditEntry],
      }
    }

    return ok(store[idx])
  }),

  // POST /api/documents/:id/nc-vinculadas — vincular una NC (fs-vinculacion-documento-nc)
  http.post('/api/documents/:id/nc-vinculadas', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const currentUser = getUserFromRequest(request)
    const docRole = getDocRoleForUser(doc, currentUser)
    const permisos = getDocumentPermissions(doc.estado, docRole)
    if (!permisos.canEdit) return err('No tenés permiso para vincular No Conformidades a este documento', 403)

    const body = (await request.json()) as { noConformidadId: string }
    const ncStore = getNonconformitiesStore()
    const ncIdx = ncStore.findIndex((n) => n.id === body.noConformidadId)
    if (ncIdx === -1 || ncStore[ncIdx].empresaId !== getActiveEmpresaId()) return err('No Conformidad no encontrada', 404)

    const nc = ncStore[ncIdx]
    const now = new Date().toISOString()
    const actorId = currentUser?.id ?? 'user-mock-001'
    const actorNombre = currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Usuario Mock'

    if (!doc.ncVinculados.some((v) => v.id === nc.id)) {
      const ncResumen: NcVinculadoResumen = { id: nc.id, numero: nc.numero, tipo: nc.tipo, severidad: nc.severidad, estado: nc.estado }
      store[idx] = {
        ...doc,
        ncVinculados: [...doc.ncVinculados, ncResumen],
        actualizadoEn: now,
        auditTrail: [...doc.auditTrail, makeAuditEntry(doc.id, 'DOCUMENTO_VINCULADO', { valorNuevo: nc.id, realizadoPorId: actorId, realizadoPorNombre: actorNombre })],
      }

      const docResumen = { id: doc.id, codigo: doc.codigo, titulo: doc.titulo, estado: doc.estado }
      const ncAuditEntry: NCAuditTrailEntry = {
        id: `aud-${nc.id}-${nc.auditTrail.length + 1}`,
        entidadTipo: 'NoConformidad',
        entidadId: nc.id,
        accion: 'NC_VINCULADO',
        valorNuevo: doc.id,
        realizadoPorId: actorId,
        realizadoPorNombre: actorNombre,
        timestamp: now,
        generadoPorIA: false,
      }
      ncStore[ncIdx] = {
        ...nc,
        documentosVinculados: [...nc.documentosVinculados, docResumen],
        actualizadoEn: now,
        auditTrail: [...nc.auditTrail, ncAuditEntry],
      }
    }

    return ok(store[idx])
  }),

  // DELETE /api/documents/:id/nc-vinculadas/:noConformidadId — desvincular (fs-vinculacion-documento-nc)
  http.delete('/api/documents/:id/nc-vinculadas/:noConformidadId', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1 || store[idx].empresaId !== getActiveEmpresaId()) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const currentUser = getUserFromRequest(request)
    const docRole = getDocRoleForUser(doc, currentUser)
    const permisos = getDocumentPermissions(doc.estado, docRole)
    if (!permisos.canEdit) return err('No tenés permiso para desvincular No Conformidades de este documento', 403)

    const noConformidadId = params.noConformidadId as string
    if (!doc.ncVinculados.some((v) => v.id === noConformidadId)) return err('Vínculo no encontrado', 404)

    const now = new Date().toISOString()
    const actorId = currentUser?.id ?? 'user-mock-001'
    const actorNombre = currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Usuario Mock'

    store[idx] = {
      ...doc,
      ncVinculados: doc.ncVinculados.filter((v) => v.id !== noConformidadId),
      actualizadoEn: now,
      auditTrail: [...doc.auditTrail, makeAuditEntry(doc.id, 'DOCUMENTO_DESVINCULADO', { valorAnterior: noConformidadId, realizadoPorId: actorId, realizadoPorNombre: actorNombre })],
    }

    const ncStore = getNonconformitiesStore()
    const ncIdx = ncStore.findIndex((n) => n.id === noConformidadId)
    if (ncIdx !== -1) {
      const nc = ncStore[ncIdx]
      const ncAuditEntry: NCAuditTrailEntry = {
        id: `aud-${nc.id}-${nc.auditTrail.length + 1}`,
        entidadTipo: 'NoConformidad',
        entidadId: nc.id,
        accion: 'NC_DESVINCULADO',
        valorAnterior: doc.id,
        realizadoPorId: actorId,
        realizadoPorNombre: actorNombre,
        timestamp: now,
        generadoPorIA: false,
      }
      ncStore[ncIdx] = {
        ...nc,
        documentosVinculados: nc.documentosVinculados.filter((d) => d.id !== doc.id),
        actualizadoEn: now,
        auditTrail: [...nc.auditTrail, ncAuditEntry],
      }
    }

    return ok(store[idx])
  }),
]

export { resetStore }
