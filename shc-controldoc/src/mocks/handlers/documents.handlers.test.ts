import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import api from '../../lib/axios'
import { documentHandlers, getDocumentsStore, resetStore } from './documents.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetStore()
  resetNotificationsStore()
})

interface Result<T> {
  status: number
  data: T
  headers: Record<string, string>
}

async function call<T>(
  promise: Promise<{ data: T; status: number; headers: Record<string, string> }>,
): Promise<Result<T>> {
  try {
    const res = await promise
    return { status: res.status, data: res.data, headers: res.headers }
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return { status: error.response.status, data: error.response.data as T, headers: error.response.headers as Record<string, string> }
    }
    throw error
  }
}

function tokenFor(email: string): string {
  const user = authFixtures.find((u) => u.email === email)
  if (!user) throw new Error(`Fixture no encontrado: ${email}`)
  return `mock-access-token-${user.id}-${Date.now()}`
}

function authHeaders(email: string) {
  return { headers: { Authorization: `Bearer ${tokenFor(email)}` } }
}

describe('documents.handlers — GET /api/documents/:id/archivo-original', () => {
  it('devuelve un archivo binario con Content-Disposition para un rol permitido en BORRADOR (CA-DOC-1)', async () => {
    // doc-003 está en BORRADOR y tiene archivoOriginalUrl
    const { status, data, headers } = await call(
      api.get<string>('/api/documents/doc-003/archivo-original', authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(200)
    expect(headers['content-disposition']).toContain('attachment')
    expect(headers['content-disposition']).toContain('INS-CD-001-v1.0.docx')
    expect(typeof data).toBe('string')
    expect((data as string).length).toBeGreaterThan(0)
  })

  it('registra una entrada DESCARGA_ARCHIVO_ORIGINAL en el auditTrail al descargar (RN-DOC-008, CA-DOC-3)', async () => {
    const before = getDocumentsStore().find((d) => d.id === 'doc-003')!.auditTrail.length
    await call(api.get('/api/documents/doc-003/archivo-original', authHeaders('jefe.docs@shac.pe')))
    const after = getDocumentsStore().find((d) => d.id === 'doc-003')!
    expect(after.auditTrail.length).toBe(before + 1)
    const lastEntry = after.auditTrail[after.auditTrail.length - 1]
    expect(lastEntry.accion).toBe('DESCARGA_ARCHIVO_ORIGINAL')
    expect(lastEntry.valorNuevo).toBe('INS-CD-001-v1.0.docx')
  })

  it('rechaza con 403 a OPERARIO (RN-DOC-013)', async () => {
    const { status } = await call(
      api.get('/api/documents/doc-003/archivo-original', authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(403)
  })

  it('rechaza con 403 fuera de BORRADOR/EN_REVISION para roles no históricos', async () => {
    // doc-001 está PUBLICADO
    const { status } = await call(
      api.get('/api/documents/doc-001/archivo-original', authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(403)
  })

  it('devuelve 404 si el documento no tiene archivoOriginalUrl', async () => {
    // doc-007 (BORRADOR, sin archivoOriginalUrl per RN-DOC-017)
    const store = getDocumentsStore()
    const doc = store.find((d) => d.estado === 'BORRADOR' && !d.archivoOriginalUrl)
    expect(doc).toBeDefined()
    const { status } = await call(
      api.get(`/api/documents/${doc!.id}/archivo-original`, authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('devuelve un .docx OOXML genuinamente válido, no un placeholder de texto plano (CA-DOC-4)', async () => {
    const response = await api.get('/api/documents/doc-003/archivo-original', {
      ...authHeaders('jefe.docs@shac.pe'),
      responseType: 'arraybuffer',
    })
    const bytes = new Uint8Array(response.data as ArrayBuffer)
    // ZIP local file header signature "PK\x03\x04" — a real .docx is a ZIP/OOXML container.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])

    // The word/document.xml entry name must appear in the ZIP directory as a plain filename record.
    const asLatin1 = Buffer.from(bytes).toString('latin1')
    expect(asLatin1).toContain('word/document.xml')
    expect(asLatin1).toContain('[Content_Types].xml')
  })
})

describe('documents.handlers — GET /api/documents/:id/archivo-distribucion', () => {
  it('devuelve un archivo binario con Content-Disposition cuando archivoDistribucionUrl existe (CA-DOC-2)', async () => {
    // doc-001 está PUBLICADO y tiene archivoDistribucionUrl
    const { status, data, headers } = await call(
      api.get<string>('/api/documents/doc-001/archivo-distribucion', authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(200)
    expect(headers['content-disposition']).toContain('attachment')
    expect(headers['content-disposition']).toContain('POL-CD-001-v2.0-distribucion.pdf')
    expect(typeof data).toBe('string')
    expect((data as string).length).toBeGreaterThan(0)
  })

  it('registra una entrada DESCARGA en el auditTrail al descargar (RN-DOC-008, CA-DOC-3)', async () => {
    const before = getDocumentsStore().find((d) => d.id === 'doc-001')!.auditTrail.length
    await call(api.get('/api/documents/doc-001/archivo-distribucion', authHeaders('operario@shac.pe')))
    const after = getDocumentsStore().find((d) => d.id === 'doc-001')!
    expect(after.auditTrail.length).toBe(before + 1)
    expect(after.auditTrail[after.auditTrail.length - 1].accion).toBe('DESCARGA')
  })

  it('devuelve 404 si el documento no tiene archivoDistribucionUrl', async () => {
    const store = getDocumentsStore()
    const doc = store.find((d) => !d.archivoDistribucionUrl)
    expect(doc).toBeDefined()
    const { status } = await call(
      api.get(`/api/documents/${doc!.id}/archivo-distribucion`, authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('devuelve 404 para un documento inexistente', async () => {
    const { status } = await call(
      api.get('/api/documents/doc-no-existe/archivo-distribucion', authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('devuelve un .pdf genuinamente válido, no un placeholder de texto plano (CA-DOC-4)', async () => {
    const response = await api.get('/api/documents/doc-001/archivo-distribucion', {
      ...authHeaders('operario@shac.pe'),
      responseType: 'arraybuffer',
    })
    const bytes = new Uint8Array(response.data as ArrayBuffer)
    const header = Buffer.from(bytes.slice(0, 5)).toString('ascii')
    expect(header).toBe('%PDF-')
  })
})

describe('documents.handlers — notificarAutor on rejection (PATCH /api/documents/:id/status)', () => {
  it('creates a CAMBIO_ESTADO notification for the author when notificarAutor is true', async () => {
    const { status } = await call(
      api.patch(
        '/api/documents/doc-004/status',
        { estado: 'BORRADOR', motivo: 'Falta evidencia', notificarAutor: true },
        authHeaders('jefe.docs@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-autor-001' && n.entidadId === 'doc-004' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('creates no notification when notificarAutor is false', async () => {
    const { status } = await call(
      api.patch(
        '/api/documents/doc-004/status',
        { estado: 'BORRADOR', motivo: 'Falta evidencia', notificarAutor: false },
        authHeaders('jefe.docs@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-autor-001' && n.entidadId === 'doc-004',
    )
    expect(notif).toBeUndefined()
  })
})

describe('documents.handlers — asignación notifications on create/update', () => {
  it('notifies the revisor when a document is created with a revisorId', async () => {
    const { status, data } = await call(
      api.post<{ id: string }>(
        '/api/documents',
        { titulo: 'Nuevo procedimiento', tipo: 'PRC', areaId: 'area-007', revisorId: 'user-supervisor-001' },
        authHeaders('jefe.docs@shac.pe'),
      ),
    )
    expect(status).toBe(201)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === data.id && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeDefined()
  })

  it('notifies the newly assigned aprobador when PUT changes aprobadorId to a different user', async () => {
    // doc-003's fixture aprobadorId is already user-jefedocs-001 — reassign to a different real account.
    const { status } = await call(
      api.put(
        '/api/documents/doc-003',
        { aprobadorId: 'user-auditor-001' },
        authHeaders('autor@shac.pe'),
      ),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-auditor-001' && n.entidadId === 'doc-003' && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeDefined()
  })
})
