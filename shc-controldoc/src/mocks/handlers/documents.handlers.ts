import { http, HttpResponse, delay } from 'msw'
import { documentFixtures } from '../fixtures/documents.fixtures'
import { DOC_STATUS_TRANSITIONS } from '../../features/documents/constants'
import type { Documento, DocStatus, DocType } from '../../types/documents.types'
import type { AuditTrailEntry } from '../../types/documents.types'

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
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)

    let filtered = [...store]

    if (estado) filtered = filtered.filter((d) => d.estado === estado)
    if (tipo) filtered = filtered.filter((d) => d.tipo === tipo)
    if (area) filtered = filtered.filter((d) => d.area === area)
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
      version: 'v1.0',
      estado: 'BORRADOR',
      area: body.area as string,
      autorId: body.autorId as string ?? 'user-mock-001',
      revisorId: body.revisorId as string | undefined,
      aprobadorId: body.aprobadorId as string | undefined,
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
      'descripcion' as keyof Documento,
      'revisorId',
      'aprobadorId',
      'fechaVigencia',
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

  // DELETE /api/documents/:id
  http.delete('/api/documents/:id', async ({ params }) => {
    await delay(LATENCY)

    const idx = store.findIndex((d) => d.id === params.id)
    if (idx === -1) return err('Documento no encontrado', 404)

    const doc = store[idx]

    if (doc.estado !== 'BORRADOR') {
      return err('Solo se pueden eliminar documentos en estado BORRADOR', 409)
    }

    if (doc.qeVinculados.length > 0) {
      return err(
        `No se puede eliminar: el documento tiene QEs vinculados (${doc.qeVinculados.join(', ')})`,
        409,
      )
    }

    store.splice(idx, 1)
    return ok(null)
  }),
]

export { resetStore }
