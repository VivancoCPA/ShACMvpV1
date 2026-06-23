import { http, HttpResponse, delay } from 'msw'
import { documentFixtures } from '../fixtures/documents.fixtures'
import { DOC_STATUS_TRANSITIONS } from '../../features/documents/constants'
import type { Documento, DocStatus, DocType } from '../../types/documents.types'
import type { UserRole } from '../../types/auth.types'
import type { AuditTrailEntry } from '../../types/documents.types'

const MOCK_PIN = '123456'

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

const LATENCY = 400

let store: Documento[] = documentFixtures.map((d) => ({ ...d }))

function resetStore() {
  store = documentFixtures.map((d) => ({ ...d }))
}

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateCodigo(tipo: DocType): string {
  const count = store.filter((d) => d.tipo === tipo).length + 1
  return `${tipo}-CD-${String(count).padStart(3, '0')}`
}

function makeAuditEntry(
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

function ok<T>(data: T, status = 200) {
  return HttpResponse.json(
    { success: true, data },
    { status },
  )
}

function err(message: string, status: number) {
  return HttpResponse.json(
    { success: false, data: null, message },
    { status },
  )
}

export const documentHandlers = [
  // GET /api/documents — list with pagination + filtering
  http.get('/api/documents', async ({ request }) => {
    await delay(LATENCY)

    const url = new URL(request.url)
    const estado = url.searchParams.get('estado') as DocStatus | null
    const tipo = url.searchParams.get('tipo') as DocType | null
    const area = url.searchParams.get('area')
    const search = url.searchParams.get('search')
    const codigo = url.searchParams.get('codigo')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true'

    // RN-DOC-012: filter by confidencialidad based on simulated user role
    const userRole = url.searchParams.get('_role') ?? 'JEFE_CALIDAD_SYST'
    let filtered = store.filter((d) => {
      // Soft-delete filter: by default only active docs; with includeDeleted only deleted docs
      if (includeDeleted) {
        if (!d.deletedAt) return false
      } else {
        if (d.deletedAt) return false
      }
      if (d.confidencialidad === 'PUBLICO' || d.confidencialidad === 'INTERNO') return true
      if (d.confidencialidad === 'CONFIDENCIAL') return CONFIDENCIAL_ROLES.has(userRole)
      // RESTRINGIDO
      return (d.rolesAutorizados ?? []).includes(userRole as UserRole)
    })

    // estado filter only applies when not in deleted view
    if (!includeDeleted && estado) filtered = filtered.filter((d) => d.estado === estado)
    if (tipo) filtered = filtered.filter((d) => d.tipo === tipo)
    if (area) filtered = filtered.filter((d) => d.area === area)
    if (codigo) filtered = filtered.filter((d) => d.codigo === codigo)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (d) => d.titulo.toLowerCase().includes(q) || d.codigo.toLowerCase().includes(q),
      )
    }

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return ok({ items, pagination: { page, pageSize, totalItems, totalPages } })
  }),

  // GET /api/documents/:id — detail
  http.get('/api/documents/:id', async ({ params }) => {
    await delay(LATENCY)

    const doc = store.find((d) => d.id === params.id)
    if (!doc) return err('Documento no encontrado', 404)
    return ok(doc)
  }),

  // POST /api/documents — create in BORRADOR
  http.post('/api/documents', async ({ request }) => {
    await delay(LATENCY)

    const body = await request.json() as Record<string, unknown>
    const tipo = body.tipo as DocType
    const now = new Date().toISOString()

    const doc: Documento = {
      id: generateId(),
      codigo: generateCodigo(tipo),
      titulo: body.titulo as string,
      tipo,
      version: (body.version as string | undefined) ?? 'v1.0',
      estado: 'BORRADOR',
      area: body.area as string,
      confidencialidad: (body.confidencialidad as Documento['confidencialidad'] | undefined) ?? 'INTERNO',
      rolesAutorizados: body.rolesAutorizados as Documento['rolesAutorizados'],
      autorId: (body.autorId as string | undefined) ?? 'user-mock-001',
      revisorId: body.revisorId as string | undefined,
      aprobadorId: body.aprobadorId as string | undefined,
      descripcion: (body.descripcion as string | undefined) || undefined,
      fechaVigencia: (body.fechaVigencia as string | undefined) || undefined,
      fechaRevisionProxima: (body.fechaRevisionProxima as string | undefined) || undefined,
      qeVinculados: [],
      historialVersiones: [],
      auditTrail: [
        makeAuditEntry('', 'DOCUMENTO_CREADO'),
      ],
      creadoEn: now,
      actualizadoEn: now,
    }
    doc.auditTrail[0].entidadId = doc.id

    store.push(doc)
    return ok(doc, 201)
  }),

  // PUT /api/documents/:id — update (BORRADOR only)
  http.put('/api/documents/:id', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

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
      'area',
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
    return ok(updated)
  }),

  // POST /api/documents/:id/status — state transition
  http.post('/api/documents/:id/status', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const nuevoEstado = body.nuevoEstado as DocStatus
    const comentario = body.comentario as string | undefined
    const firma = body.firma as string | undefined

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

    // RN-DOC-001: si se publica, obsoletizar la versión publicada del mismo código
    if (nuevoEstado === 'PUBLICADO') {
      for (let i = 0; i < store.length; i++) {
        if (store[i].codigo === doc.codigo && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
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
    const updated: Documento = {
      ...doc,
      estado: nuevoEstado,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'ESTADO_CAMBIADO', {
          estadoAnterior: doc.estado,
          estadoNuevo: nuevoEstado,
          valorAnterior: comentario,
        }),
      ],
    }

    store[idx] = updated
    return ok(updated)
  }),

  // POST /api/documents/:id/upload — file upload simulation
  // NOTE: MSW cannot parse multipart/form-data boundaries in the browser.
  // This handler ignores the request body and returns a mock archivoUrl + hashArchivo.
  http.post('/api/documents/:id/upload', async ({ params }) => {
    await delay(800)

    const id = params.id as string
    const idx = store.findIndex((d) => d.id === id)
    if (idx === -1) return err('Documento no encontrado', 404)

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
    if (idx === -1) return err('Documento no encontrado', 404)

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
    if (idx === -1) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const nuevoEstado = body.estado as DocStatus
    const motivo = body.motivo as string | undefined

    const doc = store[idx]
    const validNext = DOC_STATUS_TRANSITIONS[doc.estado] ?? []

    if (!validNext.includes(nuevoEstado)) {
      return err(`Transición inválida: ${doc.estado} → ${nuevoEstado}`, 422)
    }

    if (nuevoEstado === 'OBSOLETO' && doc.qeVinculados.length > 0) {
      return err(
        `No se puede obsoletizar: QEs vinculados activos (${doc.qeVinculados.join(', ')}) (RN-DOC-005)`,
        409,
      )
    }

    // RN-DOC-001: obsoletizar versión publicada del mismo código
    if (nuevoEstado === 'PUBLICADO') {
      for (let i = 0; i < store.length; i++) {
        if (store[i].codigo === doc.codigo && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
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
    const updated: Documento = {
      ...doc,
      estado: nuevoEstado,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'ESTADO_CAMBIADO', {
          estadoAnterior: doc.estado,
          estadoNuevo: nuevoEstado,
          valorAnterior: motivo,
        }),
      ],
    }

    store[idx] = updated
    return ok(updated)
  }),

  // POST /api/documents/:id/sign — electronic signature + publish (RN-DOC-004)
  http.post('/api/documents/:id/sign', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

    const body = await request.json() as Record<string, unknown>
    const password = body.password as string

    if (password !== MOCK_PIN) {
      return HttpResponse.json(
        { success: false, data: null, message: 'Credenciales inválidas' },
        { status: 401 },
      )
    }

    const doc = store[idx]
    if (doc.estado !== 'EN_APROBACION') {
      return err('Solo se puede firmar un documento en estado EN_APROBACION', 409)
    }

    // RN-DOC-001: obsoletizar versión publicada del mismo código
    for (let i = 0; i < store.length; i++) {
      if (store[i].codigo === doc.codigo && store[i].id !== doc.id && store[i].estado === 'PUBLICADO') {
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
    const updated: Documento = {
      ...doc,
      estado: 'PUBLICADO',
      hashArchivo: `sha256-mock-${doc.id}`,
      actualizadoEn: now,
      auditTrail: [
        ...doc.auditTrail,
        makeAuditEntry(doc.id, 'FIRMA_REGISTRADA', {
          estadoAnterior: 'EN_APROBACION',
          estadoNuevo: 'PUBLICADO',
          valorNuevo: `sha256-mock-${doc.id}`,
        }),
      ],
    }

    store[idx] = updated
    return ok(updated)
  }),

  // GET /api/documents/:id/archivo — signed view URL + VISUALIZACION audit (RN-DOC-008/009)
  http.get('/api/documents/:id/archivo', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

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
    if (idx === -1) return err('Documento no encontrado', 404)

    const doc = store[idx]
    const body = await request.json() as { tipoCambio: 'MENOR' | 'MAYOR'; motivo: string }
    const nuevaVersion = calcularNuevaVersion(doc.version, body.tipoCambio)
    const now = new Date().toISOString()
    const newId = generateId()

    const newDoc = {
      ...doc,
      id: newId,
      version: nuevaVersion,
      estado: 'BORRADOR' as const,
      versionAnteriorId: doc.id,
      archivoUrl: undefined,
      hashArchivo: undefined,
      fechaEmision: undefined,
      revisorId: undefined,
      aprobadorId: undefined,
      qeVinculados: [],
      historialVersiones: [],
      auditTrail: [
        makeAuditEntry(newId, 'DOCUMENTO_CREADO', {
          valorNuevo: `Nueva versión ${nuevaVersion} iniciada. Motivo: ${body.motivo}`,
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
    return ok(newDoc, 201)
  }),

  // POST /api/documents/:id/exportar-pdf — watermarked PDF for controlled copy (RN-DOC-007)
  http.post('/api/documents/:id/exportar-pdf', async ({ params, request }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

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
    <p>Versión ${doc.version} &middot; Estado: ${doc.estado} &middot; Área: ${doc.area}</p>
  </div>
  <dl class="meta">
    <dt>Tipo</dt><dd>${doc.tipo}</dd>
    <dt>Área</dt><dd>${doc.area}</dd>
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
    if (!doc) return err('Documento no encontrado', 404)

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    return ok({ url: `mock://signed-url-${params.id as string}`, expiresAt })
  }),

  // PATCH /api/documents/:id/confirmar-revision — confirm periodic review, renew next review date
  http.patch('/api/documents/:id/confirmar-revision', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

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

  // PATCH /api/documents/:id/restaurar — restore a soft-deleted document
  http.patch('/api/documents/:id/restaurar', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

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
    if (idx === -1) return err('Documento no encontrado', 404)

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
]

export { resetStore }
