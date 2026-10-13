import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { isAxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import api from '../../lib/axios'
import { documentHandlers, getDocumentsStore, resetStore } from './documents.handlers'
import { getQeStore, resetStore as resetQeStore } from './quality-events.handlers'
import { getNonconformitiesStore, resetStore as resetNcStore } from './nonconformities.handlers'
import { authFixtures } from '../fixtures/auth.fixtures'
import { getEmpresasActivasForUsuario } from '../fixtures/empresas.fixtures'
import { useAuthStore } from '../../stores/authStore'
import { getNotificationsStore, resetStore as resetNotificationsStore } from '../fixtures/notifications.fixtures'
import type { Documento } from '../../types/documents.types'

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetStore()
  resetQeStore()
  resetNcStore()
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

// proteccion-documental (design.md D1) — GET /:id/archivo-distribucion se retira: el maestro ya
// no se descarga directamente, solo vía la copia controlada (POST /:id/exportar-pdf). Sin
// handler MSW, la ruta ya no existe — el server de test está configurado con
// onUnhandledRequest: 'error' (línea 16), así que la petición ni siquiera devuelve una
// respuesta HTTP: la promesa de axios se rechaza directamente (no hay error.response).
describe('documents.handlers — GET /api/documents/:id/archivo-distribucion ya no existe', () => {
  it('no hay handler registrado para esta ruta', async () => {
    await expect(
      api.get('/api/documents/doc-001/archivo-distribucion', authHeaders('operario@shac.pe')),
    ).rejects.toThrow()
  })
})

// nueva-version-autor-permisos (D3): enviar a revisión sin revisor/aprobador asignado es un
// error de validación por campo (400), no un 200 silencioso ni un 403/422 genérico — espejo del
// backend real (FieldValidationException).
describe('documents.handlers — PATCH /api/documents/:id/status valida revisor/aprobador asignados', () => {
  it('responde 400 con el campo revisorId cuando falta', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-003')
    if (idx === -1) throw new Error('Fixture no encontrada: doc-003')
    store[idx] = { ...store[idx], revisorId: undefined }

    const { status, data } = await call(
      api.patch<{ errors?: string[] }>(
        '/api/documents/doc-003/status',
        { estado: 'EN_REVISION' },
        authHeaders('autor@shac.pe'),
      ),
    )

    expect(status).toBe(400)
    expect(data.errors?.some((e) => e.startsWith('revisorId:'))).toBe(true)
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')?.estado).toBe('BORRADOR')
  })

  it('responde 400 con el campo aprobadorId cuando falta', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-003')
    if (idx === -1) throw new Error('Fixture no encontrada: doc-003')
    store[idx] = { ...store[idx], aprobadorId: undefined }

    const { status, data } = await call(
      api.patch<{ errors?: string[] }>(
        '/api/documents/doc-003/status',
        { estado: 'EN_REVISION' },
        authHeaders('autor@shac.pe'),
      ),
    )

    expect(status).toBe(400)
    expect(data.errors?.some((e) => e.startsWith('aprobadorId:'))).toBe(true)
  })

  it('con revisor y aprobador asignados, envía a revisión normalmente (200)', async () => {
    const { status } = await call(
      api.patch(
        '/api/documents/doc-003/status',
        { estado: 'EN_REVISION' },
        authHeaders('autor@shac.pe'),
      ),
    )
    expect(status).toBe(200)
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

describe('documents.handlers — POST/DELETE /api/documents/:id/qe-vinculados', () => {
  it('vincula un QE por primera vez y es visible simétricamente del lado QE', async () => {
    const { status, data } = await call(
      api.post<Documento>('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.qeVinculados.some((v) => v.id === 'qe-2026-001')).toBe(true)

    const qe = getQeStore().find((q) => q.id === 'qe-2026-001')!
    expect(qe.documentosVinculados.some((d) => d.id === 'doc-003')).toBe(true)
  })

  it('vincular el mismo par dos veces es idempotente', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-001' }, headers))
    await call(api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-001' }, headers))

    const doc = getDocumentsStore().find((d) => d.id === 'doc-003')!
    expect(doc.qeVinculados.filter((v) => v.id === 'qe-2026-001')).toHaveLength(1)
  })

  it('vincular un QE de otra empresa responde 404 y no crea el vínculo', async () => {
    const { status } = await call(
      api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-e2-2026-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(404)
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')!.qeVinculados).toHaveLength(0)
  })

  it('vincular sin permiso de edición (documento PUBLICADO) responde 403', async () => {
    const { status } = await call(
      api.post('/api/documents/doc-001/qe-vinculados', { qualityEventId: 'qe-2026-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(403)
  })

  it('desvincula un par existente simétricamente', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-001' }, headers))

    const { status, data } = await call(
      api.delete('/api/documents/doc-003/qe-vinculados/qe-2026-001', headers),
    )
    expect(status).toBe(200)
    expect(data.qeVinculados).toHaveLength(0)
    expect(getQeStore().find((q) => q.id === 'qe-2026-001')!.documentosVinculados).toHaveLength(0)
  })

  it('desvincular un par no vinculado responde 404', async () => {
    const { status } = await call(
      api.delete('/api/documents/doc-003/qe-vinculados/qe-2026-001', authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(404)
  })
})

describe('documents.handlers — POST/DELETE /api/documents/:id/nc-vinculadas', () => {
  it('vincula una NC por primera vez y es visible simétricamente del lado NC', async () => {
    const { status, data } = await call(
      api.post<Documento>('/api/documents/doc-003/nc-vinculadas', { noConformidadId: 'nc-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.ncVinculados.some((v) => v.id === 'nc-001')).toBe(true)

    const nc = getNonconformitiesStore().find((n) => n.id === 'nc-001')!
    expect(nc.documentosVinculados.some((d) => d.id === 'doc-003')).toBe(true)
  })

  it('vincular el mismo par dos veces es idempotente', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/nc-vinculadas', { noConformidadId: 'nc-001' }, headers))
    await call(api.post('/api/documents/doc-003/nc-vinculadas', { noConformidadId: 'nc-001' }, headers))

    const doc = getDocumentsStore().find((d) => d.id === 'doc-003')!
    expect(doc.ncVinculados.filter((v) => v.id === 'nc-001')).toHaveLength(1)
  })

  it('vincular una NC de otra empresa responde 404 y no crea el vínculo', async () => {
    const { status } = await call(
      api.post('/api/documents/doc-003/nc-vinculadas', { noConformidadId: 'nc-e2-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(404)
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')!.ncVinculados).toHaveLength(0)
  })

  it('vincular sin permiso de edición (documento PUBLICADO) responde 403', async () => {
    const { status } = await call(
      api.post('/api/documents/doc-001/nc-vinculadas', { noConformidadId: 'nc-001' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(403)
  })

  it('desvincula un par existente simétricamente', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/nc-vinculadas', { noConformidadId: 'nc-001' }, headers))

    const { status, data } = await call(
      api.delete('/api/documents/doc-003/nc-vinculadas/nc-001', headers),
    )
    expect(status).toBe(200)
    expect(data.ncVinculados).toHaveLength(0)
    expect(getNonconformitiesStore().find((n) => n.id === 'nc-001')!.documentosVinculados).toHaveLength(0)
  })

  it('desvincular un par no vinculado responde 404', async () => {
    const { status } = await call(
      api.delete('/api/documents/doc-003/nc-vinculadas/nc-001', authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(404)
  })
})

describe('documents.handlers — RN-DOC-005 en la auto-obsoletización al publicar', () => {
  it('bloquea la publicación si la versión previa tiene un QE vinculado activo', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-005' }, headers))

    const docStore = getDocumentsStore()
    const previa = docStore.find((d) => d.id === 'doc-003')!
    // Simula que doc-003 ya fue publicado bajo el mismo código que un nuevo documento a publicar.
    docStore[docStore.indexOf(previa)] = { ...previa, estado: 'PUBLICADO' }
    const nueva = { ...previa, id: 'doc-003-v2', estado: 'EN_APROBACION' as const, version: 'v2.0' }
    docStore.push(nueva)

    const { status, data } = await call(
      api.post('/api/documents/doc-003-v2/status', { nuevoEstado: 'PUBLICADO', firma: '1234' }, authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(409)
    expect((data as unknown as { message: string }).message).toContain('QE-2026-005')
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')!.estado).toBe('PUBLICADO')
  })

  it('permite publicar cuando el QE vinculado a la versión previa está cerrado', async () => {
    const headers = authHeaders('autor@shac.pe')
    await call(api.post('/api/documents/doc-003/qe-vinculados', { qualityEventId: 'qe-2026-001' }, headers)) // qe-2026-001 = CERRADO

    const docStore = getDocumentsStore()
    const previa = docStore.find((d) => d.id === 'doc-003')!
    docStore[docStore.indexOf(previa)] = { ...previa, estado: 'PUBLICADO' }
    const nueva = { ...previa, id: 'doc-003-v2', estado: 'EN_APROBACION' as const, version: 'v2.0' }
    docStore.push(nueva)

    const { status, data } = await call(
      api.post('/api/documents/doc-003-v2/status', { nuevoEstado: 'PUBLICADO', firma: '1234' }, authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('PUBLICADO')
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')!.estado).toBe('OBSOLETO')
  })
})

interface CandidatoDto {
  id: string
  nombreCompleto: string
  rol: string
}

describe('documents.handlers — GET /api/documents/candidatos-asignacion (D1/D2)', () => {
  const get = (params: Record<string, string>) =>
    call(
      api.get<CandidatoDto[]>('/api/documents/candidatos-asignacion', {
        params,
        ...authHeaders('jefe.docs@shac.pe'),
      }),
    )

  it('APROBADOR solo incluye JEFE_CONTROL_DOCUMENTARIO y ALTA_DIRECCION y excluye al usuario de la sesión', async () => {
    const { status, data } = await get({ tipo: 'APROBADOR' })

    expect(status).toBe(200)
    expect(data.length).toBeGreaterThan(0)
    expect(data.every((c) => c.rol === 'JEFE_CONTROL_DOCUMENTARIO' || c.rol === 'ALTA_DIRECCION')).toBe(true)
    expect(data.map((c) => c.id)).not.toContain('user-jefedocs-001')
  })

  it('REVISOR incluye AUDITOR_INTERNO pero no SUPERVISOR ni OPERARIO', async () => {
    const { data } = await get({ tipo: 'REVISOR' })

    const roles = new Set(data.map((c) => c.rol))
    expect(roles.has('AUDITOR_INTERNO')).toBe(true)
    expect(roles.has('SUPERVISOR')).toBe(false)
    expect(roles.has('OPERARIO')).toBe(false)
  })

  it('con documentoId excluye al autor del documento, no al usuario de la sesión', async () => {
    const autorId = getDocumentsStore().find((d) => d.id === 'doc-003')!.autorId
    const { data } = await get({ tipo: 'REVISOR', documentoId: 'doc-003' })

    expect(data.map((c) => c.id)).not.toContain(autorId)
    expect(data.map((c) => c.id)).toContain('user-jefedocs-001')
  })

  it('no incluye usuarios de otra empresa', async () => {
    const { data } = await get({ tipo: 'REVISOR' })

    const empresaActiva = useAuthStore.getState().empresaActivaId
    expect(data.length).toBeGreaterThan(0)
    for (const c of data) {
      expect(getEmpresasActivasForUsuario(c.id).some((e) => e.id === empresaActiva)).toBe(true)
    }
  })

  it('responde 400 con tipo inválido', async () => {
    const { status } = await get({ tipo: 'OTRO' })

    expect(status).toBe(400)
  })
})

// documentos-notificaciones-pendientes (H1): antes solo la creación/edición (asignación) y el
// rechazo notificaban — ninguna otra transición avisaba a quien le tocaba actuar.
describe('documents.handlers — transition notifications (documentos-notificaciones-pendientes)', () => {
  it('sending to review notifies the assigned revisor', async () => {
    // doc-003: BORRADOR, revisorId = user-supervisor-001
    const { status } = await call(
      api.patch('/api/documents/doc-003/status', { estado: 'EN_REVISION' }, authHeaders('autor@shac.pe')),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === 'doc-003' && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeDefined()
  })

  it('approving review notifies the assigned aprobador', async () => {
    // doc-004: EN_REVISION, aprobadorId = user-jefedocs-001
    const { status } = await call(
      api.patch('/api/documents/doc-004/status', { estado: 'EN_APROBACION' }, authHeaders('supervisor@shac.pe')),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-jefedocs-001' && n.entidadId === 'doc-004' && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeDefined()
  })

  it('cancelling review without motivo notifies author and reviewer', async () => {
    // doc-004: EN_REVISION, autorId = user-autor-001, revisorId = user-supervisor-001
    const { status } = await call(
      api.patch('/api/documents/doc-004/status', { estado: 'BORRADOR' }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)

    const notifAutor = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-autor-001' && n.entidadId === 'doc-004' && n.tipo === 'CAMBIO_ESTADO',
    )
    const notifRevisor = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === 'doc-004' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notifAutor).toBeDefined()
    expect(notifRevisor).toBeDefined()
  })

  it('starting periodic review notifies the author', async () => {
    // doc-001: PUBLICADO, autorId = user-autor-001
    const { status } = await call(
      api.patch('/api/documents/doc-001/status', { estado: 'EN_REVISION_PERIODICA' }, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-autor-001' && n.entidadId === 'doc-001' && n.tipo === 'CAMBIO_ESTADO',
    )
    expect(notif).toBeDefined()
  })

  it('does not notify the acting user when they are also the recipient', async () => {
    // Actor = supervisor@shac.pe, who is also doc-003's revisorId.
    const { status } = await call(
      api.patch('/api/documents/doc-003/status', { estado: 'EN_REVISION' }, authHeaders('supervisor@shac.pe')),
    )
    expect(status).toBe(200)

    const notif = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === 'doc-003' && n.tipo === 'ASIGNACION',
    )
    expect(notif).toBeUndefined()
  })
})

describe('documents.handlers — POST /api/documents/:id/sign notifies on publish', () => {
  it('notifies author and reviewer, never the signing approver', async () => {
    // doc-005: EN_APROBACION, autorId = user-autor-001, revisorId = user-supervisor-001, aprobadorId = user-jefedocs-001
    const headers = authHeaders('jefe.docs@shac.pe')
    // El handler valida el PIN enviado contra el PIN configurado del firmante
    // (pin-firma-ui) — sin esto, ningún usuario de authFixtures tiene PIN configurado.
    authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')!.pin = '1234'
    const { status, data } = await call(
      api.post<{ estado: string }>('/api/documents/doc-005/sign', { pin: '1234' }, headers),
    )
    expect(status).toBe(200)
    expect(data.estado).toBe('PUBLICADO')

    const notifAutor = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-autor-001' && n.entidadId === 'doc-005' && n.tipo === 'CAMBIO_ESTADO',
    )
    const notifRevisor = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === 'doc-005' && n.tipo === 'CAMBIO_ESTADO',
    )
    const notifAprobador = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-jefedocs-001' && n.entidadId === 'doc-005',
    )
    expect(notifAutor).toBeDefined()
    expect(notifRevisor).toBeDefined()
    expect(notifAprobador).toBeUndefined()
  })
})

describe('documents.handlers — POST /api/documents/:id/sign valida el PIN por usuario (pin-firma-ui)', () => {
  it('responde 422 con errorCode PIN_NO_CONFIGURADO cuando el firmante no tiene PIN configurado', async () => {
    const fixture = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
    if (fixture) fixture.pin = undefined
    const headers = authHeaders('jefe.docs@shac.pe')

    let caught: unknown
    try {
      await api.post('/api/documents/doc-005/sign', { pin: '1234' }, headers)
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(422)
    expect((caught.response?.data as { errorCode?: string }).errorCode).toBe('PIN_NO_CONFIGURADO')
  })

  it('responde 401 cuando el PIN enviado no coincide con el configurado', async () => {
    const fixture = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: jefe.docs@shac.pe')
    fixture.pin = '4821'
    const headers = authHeaders('jefe.docs@shac.pe')

    let caught: unknown
    try {
      await api.post('/api/documents/doc-005/sign', { pin: '0000' }, headers)
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(401)
  })
})

describe('documents.handlers — POST /api/documents/:id/sign bloquea sin archivo original (pdf-distribucion-real)', () => {
  it('responde 422 con errorCode SIN_ARCHIVO_ORIGINAL cuando el documento no tiene archivo original', async () => {
    const fixture = authFixtures.find((u) => u.email === 'jefe.docs@shac.pe')
    if (!fixture) throw new Error('Fixture no encontrado: jefe.docs@shac.pe')
    fixture.pin = '1234'

    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-005')
    if (idx === -1) throw new Error('Fixture no encontrada: doc-005')
    store[idx] = { ...store[idx], archivoOriginalUrl: null, archivoOriginalNombre: null }

    const headers = authHeaders('jefe.docs@shac.pe')
    let caught: unknown
    try {
      await api.post('/api/documents/doc-005/sign', { pin: '1234' }, headers)
    } catch (error) {
      caught = error
    }

    if (!isAxiosError(caught)) throw new Error('Se esperaba un AxiosError')
    expect(caught.response?.status).toBe(422)
    expect((caught.response?.data as { errorCode?: string }).errorCode).toBe('SIN_ARCHIVO_ORIGINAL')
    expect(getDocumentsStore().find((d) => d.id === 'doc-005')?.estado).toBe('EN_APROBACION')
  })
})

describe('documents.handlers — POST /api/documents/:id/nueva-version hereda revisor/aprobador y notifica', () => {
  // nueva-version-autor-permisos (D1): autorId = quien crea la versión (jefe.calidad@shac.pe),
  // nunca el autor del origen. revisorId se hereda solo si sigue siendo un candidato elegible
  // para ESE nuevo autor — doc-001.revisorId (user-supervisor-001, rol SUPERVISOR) ya no lo es
  // desde documentos-revisor-aprobador-reales (SUPERVISOR no está en los roles elegibles de
  // REVISOR), así que queda vacío; aprobadorId (user-jefedocs-001, JEFE_CONTROL_DOCUMENTARIO) sí
  // sigue siendo elegible y se hereda.
  it('sets autorId to the creator, drops a no-longer-eligible revisor, and keeps an eligible aprobador', async () => {
    // doc-001: PUBLICADO, revisorId = user-supervisor-001, aprobadorId = user-jefedocs-001
    const { status, data } = await call(
      api.post<{ id: string; autorId: string; revisorId?: string | null; aprobadorId?: string | null }>(
        '/api/documents/doc-001/nueva-version',
        { tipoCambio: 'MENOR', motivo: 'Corrección de forma menor en el contenido.' },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(201)
    expect(data.autorId).toBe('user-jefecalidad-001')
    expect(data.revisorId).toBeFalsy()
    expect(data.aprobadorId).toBe('user-jefedocs-001')

    const notifRevisor = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-supervisor-001' && n.entidadId === data.id && n.tipo === 'ASIGNACION',
    )
    const notifAprobador = getNotificationsStore().find(
      (n) => n.usuarioId === 'user-jefedocs-001' && n.entidadId === data.id && n.tipo === 'ASIGNACION',
    )
    expect(notifRevisor).toBeUndefined()
    expect(notifAprobador).toBeDefined()
  })

  it('rejects creation from a user who is neither the origin author nor JCA/JCD', async () => {
    // doc-001 autor = user-autor-001; supervisor@shac.pe (SUPERVISOR) no es autor ni JCA/JCD.
    const { status } = await call(
      api.post(
        '/api/documents/doc-001/nueva-version',
        { tipoCambio: 'MENOR', motivo: 'No debería poder crear una nueva versión.' },
        authHeaders('supervisor@shac.pe'),
      ),
    )
    expect(status).toBe(403)
  })
})

// documentos-notificaciones-pendientes (H2/D1): "pendiente" depende solo de la asignación directa
// del actor sobre cada documento, igual para todos los roles — ya no de reglas por rol global
// anteriores a documentos-revisor-aprobador-reales D1.
describe('documents.handlers — pendientes por asignación, no por rol (documentos-notificaciones-pendientes)', () => {
  function listPendientes(email: string) {
    return call(
      api.get<{ items: { id: string }[] }>('/api/documents', {
        params: { pendientes: 'true', pageSize: '50' },
        ...authHeaders(email),
      }),
    )
  }

  function countPendientes(email: string) {
    return call(api.get<{ count: number }>('/api/documents/pendientes/count', authHeaders(email)))
  }

  it('author sees their own BORRADOR without being revisor/aprobador of anything', async () => {
    // doc-003: BORRADOR, autorId = user-autor-001
    const { data } = await listPendientes('autor@shac.pe')

    expect(data.items.map((d) => d.id)).toContain('doc-003')
  })

  it('AUDITOR_INTERNO revisor sees their assigned EN_REVISION', async () => {
    const docStore = getDocumentsStore()
    const doc = docStore.find((d) => d.id === 'doc-004')!
    docStore[docStore.indexOf(doc)] = { ...doc, revisorId: 'user-auditor-001' }

    const { data } = await listPendientes('auditor@shac.pe')

    expect(data.items.map((d) => d.id)).toContain('doc-004')
  })

  it('ALTA_DIRECCION aprobadora sees their assigned EN_APROBACION', async () => {
    const docStore = getDocumentsStore()
    const doc = docStore.find((d) => d.id === 'doc-005')!
    docStore[docStore.indexOf(doc)] = { ...doc, aprobadorId: 'user-gerencia-001' }

    const { data } = await listPendientes('gerencia@shac.pe')

    expect(data.items.map((d) => d.id)).toContain('doc-005')
  })

  it('JEFE_CALIDAD_SYST who is not the assigned revisor no longer sees every EN_REVISION', async () => {
    // doc-004: EN_REVISION, revisorId = user-supervisor-001 (not jefe.calidad)
    const { data } = await listPendientes('jefe.calidad@shac.pe')

    expect(data.items.map((d) => d.id)).not.toContain('doc-004')
  })

  it('JEFE_CALIDAD_SYST and JEFE_CONTROL_DOCUMENTARIO see EN_REVISION_PERIODICA', async () => {
    const docStore = getDocumentsStore()
    const doc = docStore.find((d) => d.id === 'doc-001')!
    docStore[docStore.indexOf(doc)] = { ...doc, estado: 'EN_REVISION_PERIODICA' }

    const resultJCA = await listPendientes('jefe.calidad@shac.pe')
    const resultJCD = await listPendientes('jefe.docs@shac.pe')

    expect(resultJCA.data.items.map((d) => d.id)).toContain('doc-001')
    expect(resultJCD.data.items.map((d) => d.id)).toContain('doc-001')
  })

  it('count matches the filtered list for the same actor', async () => {
    const list = await listPendientes('autor@shac.pe')
    const count = await countPendientes('autor@shac.pe')

    expect(count.data.count).toBe(list.data.items.length)
  })

  it('a role with no assignments has zero pendientes — not a role-based cutoff', async () => {
    // user-operario-001 is not autor/revisor/aprobador of any fixture document.
    const { data } = await countPendientes('operario@shac.pe')

    expect(data.count).toBe(0)
  })

  it('confidencialidad hides a RESTRINGIDO document from the count even for its own author', async () => {
    const docStore = getDocumentsStore()
    const doc = docStore.find((d) => d.id === 'doc-007')! // BORRADOR, autorId = user-autor-001
    docStore[docStore.indexOf(doc)] = {
      ...doc,
      confidencialidad: 'RESTRINGIDO',
      rolesAutorizados: ['ALTA_DIRECCION'],
    }

    const { data } = await listPendientes('autor@shac.pe') // autor@shac.pe is SUPERVISOR, not in rolesAutorizados

    expect(data.items.map((d) => d.id)).not.toContain('doc-007')
  })
})

describe('documents.handlers — PATCH /api/documents/:id/restaurar restringido por rol (documentos-notificaciones-pendientes)', () => {
  function markDeleted(id: string) {
    const docStore = getDocumentsStore()
    const doc = docStore.find((d) => d.id === id)!
    docStore[docStore.indexOf(doc)] = { ...doc, deletedAt: new Date().toISOString() }
  }

  it('JEFE_CALIDAD_SYST can restore', async () => {
    markDeleted('doc-003')

    const { status, data } = await call(
      api.patch<{ deletedAt?: string }>('/api/documents/doc-003/restaurar', {}, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.deletedAt).toBeUndefined()
  })

  it('ALTA_DIRECCION can restore', async () => {
    markDeleted('doc-003')

    const { status } = await call(
      api.patch('/api/documents/doc-003/restaurar', {}, authHeaders('gerencia@shac.pe')),
    )
    expect(status).toBe(200)
  })

  it('JEFE_CONTROL_DOCUMENTARIO cannot restore', async () => {
    markDeleted('doc-003')

    const { status } = await call(
      api.patch('/api/documents/doc-003/restaurar', {}, authHeaders('jefe.docs@shac.pe')),
    )
    expect(status).toBe(403)
    expect(getDocumentsStore().find((d) => d.id === 'doc-003')!.deletedAt).toBeDefined()
  })

  it('OPERARIO cannot restore', async () => {
    markDeleted('doc-003')

    const { status } = await call(
      api.patch('/api/documents/doc-003/restaurar', {}, authHeaders('operario@shac.pe')),
    )
    expect(status).toBe(403)
  })
})

// revision-periodica-fecha-editable: mismo contrato que el backend real — body opcional
// { fechaRevisionProxima }, margen mínimo de 30 días, fecha de calendario sin hora.
describe('documents.handlers — PATCH /api/documents/:id/confirmar-revision con fecha editable', () => {
  function hoyIso(): string {
    return new Date().toISOString().slice(0, 10)
  }

  function addDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  it('sin body, un documento POL usa la fecha sugerida (hoy + 12 meses) como fecha de calendario', async () => {
    const { status, data } = await call(
      api.patch<Documento>('/api/documents/doc-001/confirmar-revision', undefined, authHeaders('jefe.calidad@shac.pe')),
    )
    expect(status).toBe(200)
    expect(data.fechaRevisionProxima).toMatch(/T00:00:00/)
  })

  it('con una fecha válida, se guarda exactamente esa fecha', async () => {
    const fechaElegida = addDays(hoyIso(), 90)
    const { status, data } = await call(
      api.patch<Documento>(
        '/api/documents/doc-001/confirmar-revision',
        { fechaRevisionProxima: fechaElegida },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(200)
    expect(data.fechaRevisionProxima?.slice(0, 10)).toBe(fechaElegida)
  })

  it('con una fecha por debajo del margen mínimo, responde con un error de validación', async () => {
    const fechaCorta = addDays(hoyIso(), 5)
    const { status, data } = await call(
      api.patch<{ errors?: string[] }>(
        '/api/documents/doc-001/confirmar-revision',
        { fechaRevisionProxima: fechaCorta },
        authHeaders('jefe.calidad@shac.pe'),
      ),
    )
    expect(status).toBe(400)
    expect(data.errors?.some((e) => e.startsWith('fechaRevisionProxima:'))).toBe(true)
  })

  it('un documento REG sin body queda sin próxima revisión', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-001')
    const original = store[idx]
    store[idx] = { ...original, tipo: 'REG', estado: 'PUBLICADO' }

    const { status, data } = await call(
      api.patch<Documento>('/api/documents/doc-001/confirmar-revision', undefined, authHeaders('jefe.calidad@shac.pe')),
    )

    expect(status).toBe(200)
    expect(data.fechaRevisionProxima).toBeFalsy()
  })
})

// revision-periodica-permiso-por-rol (D1): las 3 acciones de revisión periódica se autorizan
// por rol GLOBAL (JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO), no por docRole — un Jefe
// conserva el permiso aunque sea autor/revisor/aprobador asignado de ESE documento. Antes de
// este change, confirmar-revision no validaba ningún permiso y status (para estas 2
// transiciones) tampoco.
describe('documents.handlers — revisión periódica autorizada por rol global', () => {
  it('JEFE_CALIDAD_SYST que es el aprobador asignado de doc-001 inicia la revisión periódica (200)', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-001')
    store[idx] = { ...store[idx], aprobadorId: 'user-jefecalidad-001' }

    const { status } = await call(
      api.patch('/api/documents/doc-001/status', { estado: 'EN_REVISION_PERIODICA' }, authHeaders('jefe.calidad@shac.pe')),
    )

    expect(status).toBe(200)
  })

  it('SUPERVISOR no puede iniciar la revisión periódica (403)', async () => {
    const { status } = await call(
      api.patch('/api/documents/doc-001/status', { estado: 'EN_REVISION_PERIODICA' }, authHeaders('supervisor@shac.pe')),
    )

    expect(status).toBe(403)
  })

  it('OPERARIO no puede iniciar la revisión periódica (403)', async () => {
    const { status } = await call(
      api.patch('/api/documents/doc-001/status', { estado: 'EN_REVISION_PERIODICA' }, authHeaders('operario@shac.pe')),
    )

    expect(status).toBe(403)
  })

  it('JEFE_CONTROL_DOCUMENTARIO que es el revisor asignado de doc-020 (EN_REVISION_PERIODICA) cancela la revisión periódica (200)', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-020')
    store[idx] = { ...store[idx], revisorId: 'user-jefedocs-001' }

    const { status } = await call(
      api.patch('/api/documents/doc-020/status', { estado: 'BORRADOR' }, authHeaders('jefe.docs@shac.pe')),
    )

    expect(status).toBe(200)
  })

  it('SUPERVISOR no puede cancelar la revisión periódica (403)', async () => {
    const { status } = await call(
      api.patch('/api/documents/doc-020/status', { estado: 'BORRADOR' }, authHeaders('supervisor@shac.pe')),
    )

    expect(status).toBe(403)
  })

  it('JEFE_CALIDAD_SYST que es el revisor asignado de doc-001 confirma la revisión periódica (200)', async () => {
    const store = getDocumentsStore()
    const idx = store.findIndex((d) => d.id === 'doc-001')
    store[idx] = { ...store[idx], revisorId: 'user-jefecalidad-001' }

    const { status } = await call(
      api.patch('/api/documents/doc-001/confirmar-revision', undefined, authHeaders('jefe.calidad@shac.pe')),
    )

    expect(status).toBe(200)
  })

  it('OPERARIO no puede confirmar la revisión periódica (403)', async () => {
    const { status } = await call(
      api.patch('/api/documents/doc-001/confirmar-revision', undefined, authHeaders('operario@shac.pe')),
    )

    expect(status).toBe(403)
  })

  it('SUPERVISOR no puede confirmar la revisión periódica (403)', async () => {
    const { status } = await call(
      api.patch('/api/documents/doc-001/confirmar-revision', undefined, authHeaders('supervisor@shac.pe')),
    )

    expect(status).toBe(403)
  })
})
