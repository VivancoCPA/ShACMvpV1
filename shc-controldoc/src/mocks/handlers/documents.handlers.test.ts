import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import api from '../../lib/axios'
import { documentHandlers, getDocumentsStore, resetStore } from './documents.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../fixtures/empresas.fixtures'
import { useAuthStore } from '../../stores/authStore'
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

// Tipado como AxiosResponse<T> (la forma real que devuelven las llamadas
// api.get/post envueltas aquí) en vez de un `{ data, status, headers:
// Record<string,string> }` a mano — AxiosResponse['headers'] es
// `AxiosResponseHeaders | Partial<RawAxiosHeaders & {...}>`, no
// Record<string,string>, y mantener el parámetro genérico en T permite que
// TS siga infiriendo T desde cada call site sin anotar `call<...>` a mano.
async function call<T>(promise: Promise<AxiosResponse<T>>): Promise<Result<T>> {
  try {
    const res = await promise
    return { status: res.status, data: res.data, headers: res.headers as Record<string, string> }
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return { status: error.response.status, data: error.response.data as T, headers: error.response.headers as Record<string, string> }
    }
    throw error
  }
}

// `getSessionUser` (empresa-session, me-f2-sesion-rbac-login) resuelve el
// usuario actuante desde la sesión activa en memoria, no solo del Bearer
// token — este helper pobla `authStore` además de construir el token, para
// que los handlers de dominio reconozcan al usuario de cada fixture.
// `empresaActivaId` se resuelve igual que lo haría un login real (primera
// empresa ACTIVO de `UsuarioEmpresa`) — los handlers de Documentos ahora
// filtran/asignan por empresa activa de sesión (me-f3-scoping-modulos).
function authHeaders(email: string, empresaId?: string) {
  const mockUser = authFixtures.find((u) => u.email === email)
  if (!mockUser) throw new Error(`Fixture no encontrado: ${email}`)
  const { password: _password, ...user } = mockUser
  const accessToken = `mock-access-token-${user.id}-${Date.now()}`
  const empresasDisponibles = getEmpresasActivasForUsuario(user.id)
  const empresaActivaId = empresaId ?? empresasDisponibles[0]?.id ?? null
  useAuthStore.setState({ user, accessToken, isAuthenticated: true, empresaActivaId, empresasDisponibles })
  return { headers: { Authorization: `Bearer ${accessToken}` } }
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

describe('documents.handlers — empresa isolation (me-f3-scoping-modulos)', () => {
  it('list excludes documents from another empresa', async () => {
    const { status, data } = await call(
      api.get<{ items: { id: string; empresaId: string }[] }>(
        '/api/documents',
        authHeaders('jefe.docs@shac.pe'), // empresa-001
      ),
    )
    expect(status).toBe(200)
    expect(data.items.some((d) => d.empresaId === 'empresa-002')).toBe(false)
  })

  it('detail returns 404 for a document belonging to another empresa', async () => {
    // doc-e2-001 belongs to empresa-002; acting session is empresa-001
    const { status } = await call(
      api.get('/api/documents/doc-e2-001', authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(404)
  })

  it('status transition on another empresa document is rejected as not found', async () => {
    // doc-e2-002 (empresa-002, EN_REVISION) — acting session is empresa-001
    const { status } = await call(
      api.patch(
        '/api/documents/doc-e2-002/status',
        { estado: 'EN_APROBACION' },
        authHeaders('jefe.docs@shac.pe'),
      ),
    )
    expect(status).toBe(404)
    expect(getDocumentsStore().find((d) => d.id === 'doc-e2-002')!.estado).toBe('EN_REVISION')
  })

  it('delete on another empresa document is rejected as not found', async () => {
    // doc-e2-003 (empresa-002, BORRADOR) — acting session is empresa-001
    const { status } = await call(
      api.delete('/api/documents/doc-e2-003', authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(404)
    expect(getDocumentsStore().find((d) => d.id === 'doc-e2-003')!.deletedAt).toBeUndefined()
  })

  it('created document carries the active empresa and an independent codigo sequence', async () => {
    const { status, data } = await call(
      api.post<{ empresaId: string; codigo: string }>(
        '/api/documents',
        { titulo: 'Procedimiento Terminal Portuario', tipo: 'PRC', areaId: 'area-009' },
        authHeaders('jefe.docs@ilo.pe'), // empresa-002, JEFE_CONTROL_DOCUMENTARIO
      ),
    )
    expect(status).toBe(201)
    expect(data.empresaId).toBe('empresa-002')
    // Only doc-e2-002 (PRC-CD-E2-001) is empresa-002/PRC in fixtures — this is the 2nd for that empresa.
    expect(data.codigo).toBe('PRC-CD-002')
  })

  it('create is rejected with 401 when the session has no active empresa', async () => {
    const headers = authHeaders('jefe.docs@shac.pe')
    useAuthStore.setState({ empresaActivaId: null })
    const { status } = await call(
      api.post('/api/documents', { titulo: 'Documento sin empresa activa', tipo: 'PRC', areaId: 'area-007' }, headers),
    )
    expect(status).toBe(401)
  })
})
