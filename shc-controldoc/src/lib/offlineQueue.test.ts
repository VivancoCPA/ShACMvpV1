import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueue,
  listPending,
  getById,
  markSyncing,
  markSynced,
  markError,
  markRetryPending,
  retry,
  clearAll,
  OfflineQueueError,
  type EnqueueInput,
} from './offlineQueue'

function buildEnqueueInput(overrides: Partial<EnqueueInput> = {}): EnqueueInput {
  return {
    payload: {
      tipo: 'INCIDENTE',
      descripcion: 'Descripción de prueba con al menos veinte caracteres',
      areaId: 'area-001',
      turno: 'DIA',
      fechaEvento: '2026-01-01T00:00:00.000Z',
      huboLesionados: false,
    },
    photoBlobs: [],
    empresaId: 'empresa-001',
    ...overrides,
  }
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('enqueue crea una entrada pending con localId y createdAt asignados', async () => {
    const localId = await enqueue(buildEnqueueInput())
    const pending = await listPending()

    expect(pending).toHaveLength(1)
    expect(pending[0].localId).toBe(localId)
    expect(pending[0].status).toBe('pending')
    expect(typeof pending[0].createdAt).toBe('string')
  })

  it('listPending retorna entradas pending y error ordenadas por createdAt ascendente', async () => {
    const first = await enqueue(buildEnqueueInput())
    const second = await enqueue(buildEnqueueInput())
    await markError(second, 'fallo de validación')

    const pending = await listPending()

    expect(pending.map((item) => item.localId)).toEqual([first, second])
    expect(pending[1].status).toBe('error')
  })

  it('listPending excluye entradas synced y syncing', async () => {
    const syncingId = await enqueue(buildEnqueueInput())
    const syncedId = await enqueue(buildEnqueueInput())
    await markSyncing(syncingId)
    await markSynced(syncedId)

    const pending = await listPending()

    expect(pending).toHaveLength(0)
  })

  it('markSynced elimina la entrada del store en vez de conservarla', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markSynced(localId)

    const entry = await getById(localId)
    expect(entry).toBeUndefined()
  })

  it('enqueue inicializa retryCount en 0', async () => {
    const localId = await enqueue(buildEnqueueInput())
    const entry = await getById(localId)

    expect(entry?.retryCount).toBe(0)
  })

  it('markRetryPending incrementa retryCount, vuelve a pending y no toca errorMessage', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markSyncing(localId)
    await markRetryPending(localId)

    const entry = await getById(localId)
    expect(entry?.status).toBe('pending')
    expect(entry?.retryCount).toBe(1)
    expect(entry?.errorMessage).toBeUndefined()

    await markSyncing(localId)
    await markRetryPending(localId)
    const secondAttempt = await getById(localId)
    expect(secondAttempt?.retryCount).toBe(2)
  })

  it('markRetryPending trata una entrada sin retryCount previo (esquema anterior) como 0', async () => {
    const localId = await enqueue(buildEnqueueInput())
    // Simula una entrada persistida por una versión anterior del esquema (sin
    // `retryCount`): se escribe directo con IndexedDB, sin pasar por `enqueue()`,
    // que siempre inicializa el campo en 0.
    const existing = await getById(localId)
    const legacyEntry = { ...existing }
    delete (legacyEntry as { retryCount?: number }).retryCount
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('shac-offline-incidents')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('incident-queue', 'readwrite')
      tx.objectStore('incident-queue').put(legacyEntry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()

    const beforeRetry = await getById(localId)
    expect(beforeRetry?.retryCount).toBeUndefined()

    await markRetryPending(localId)
    const entry = await getById(localId)
    expect(entry?.retryCount).toBe(1)
  })

  it('retry manual resetea retryCount a 0 además de limpiar errorMessage', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markSyncing(localId)
    await markRetryPending(localId)
    await markSyncing(localId)
    await markRetryPending(localId)
    await markError(localId, 'reintentos agotados')

    await retry(localId)

    const entry = await getById(localId)
    expect(entry?.status).toBe('pending')
    expect(entry?.retryCount).toBe(0)
    expect(entry?.errorMessage).toBeUndefined()
  })

  it('markSyncing actualiza status y lastAttemptAt, y saca la entrada de listPending', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markSyncing(localId)

    const entry = await getById(localId)
    expect(entry?.status).toBe('syncing')
    expect(entry?.lastAttemptAt).toBeDefined()
    expect(await listPending()).toHaveLength(0)
  })

  it('markError deja la entrada en error con el mensaje y vuelve a aparecer en listPending', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markSyncing(localId)
    await markError(localId, 'Error de validación del servidor')

    const [entry] = await listPending()
    expect(entry.status).toBe('error')
    expect(entry.errorMessage).toBe('Error de validación del servidor')
  })

  it('retry vuelve a poner una entrada en error en status pending', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markError(localId, 'fallo de red')
    await retry(localId)

    const [entry] = await listPending()
    expect(entry.status).toBe('pending')
  })

  it('preserva photoBlobs, geoUbicacion y empresaId tal como se encolaron', async () => {
    const blob = new Blob(['foto'], { type: 'image/jpeg' })
    const localId = await enqueue(
      buildEnqueueInput({
        photoBlobs: [blob],
        geoUbicacion: { lat: -12.05, lng: -77.04, capturadoEn: '2026-01-01T00:00:00.000Z' },
        empresaId: 'empresa-002',
      }),
    )

    const [entry] = await listPending()
    expect(entry.localId).toBe(localId)
    expect(entry.photoBlobs).toHaveLength(1)
    expect(entry.geoUbicacion).toEqual({ lat: -12.05, lng: -77.04, capturadoEn: '2026-01-01T00:00:00.000Z' })
    expect(entry.empresaId).toBe('empresa-002')
  })

  it('enqueue persiste photoCaptions alineado por índice con photoBlobs', async () => {
    const blobs = [new Blob(['foto1'], { type: 'image/jpeg' }), new Blob(['foto2'], { type: 'image/jpeg' })]
    const localId = await enqueue(
      buildEnqueueInput({ photoBlobs: blobs, photoCaptions: ['válvula dañada', undefined] }),
    )

    const entry = await getById(localId)
    expect(entry?.photoCaptions).toEqual(['válvula dañada', undefined])
    expect(entry?.photoBlobs).toHaveLength(2)
  })

  it('enqueue sin photoCaptions no lanza error y deja el campo sin definir', async () => {
    const localId = await enqueue(buildEnqueueInput({ photoBlobs: [new Blob(['foto'], { type: 'image/jpeg' })] }))

    const entry = await getById(localId)
    expect(entry?.photoCaptions).toBeUndefined()
  })

  it('una entrada sin photoCaptions (esquema anterior) se lee sin error', async () => {
    const localId = await enqueue(buildEnqueueInput({ photoBlobs: [new Blob(['foto'], { type: 'image/jpeg' })] }))
    // Simula una entrada persistida por una versión anterior del esquema (sin
    // `photoCaptions`), mismo patrón que el test de `retryCount` sin migrar.
    const existing = await getById(localId)
    const legacyEntry = { ...existing }
    delete (legacyEntry as { photoCaptions?: (string | undefined)[] }).photoCaptions
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('shac-offline-incidents')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('incident-queue', 'readwrite')
      tx.objectStore('incident-queue').put(legacyEntry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()

    const entry = await getById(localId)
    expect(entry?.photoCaptions).toBeUndefined()
    expect(entry?.photoBlobs).toHaveLength(1)
  })

  it('envuelve un fallo de cuota de almacenamiento en OfflineQueueError sin crashear', async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore) {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await expect(enqueue(buildEnqueueInput())).rejects.toBeInstanceOf(OfflineQueueError)

    spy.mockRestore()
  })
})

describe('OfflineQueueError', () => {
  it('es una instancia de Error con nombre identificable', () => {
    const error = new OfflineQueueError('cuota agotada')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('OfflineQueueError')
    expect(error.message).toBe('cuota agotada')
  })
})
