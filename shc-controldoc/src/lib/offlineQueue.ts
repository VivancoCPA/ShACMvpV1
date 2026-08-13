import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CreateIncidentInput } from '../features/incidents/schemas/createIncident.schema'
import type { IncidenteGeoUbicacion } from '../features/incidents/types/incident.types'

export type OfflineIncidentStatus = 'pending' | 'syncing' | 'synced' | 'error'

export type QueuedIncidentPayload = Omit<CreateIncidentInput, 'evidencias' | 'geoUbicacion'>

export interface QueuedIncident {
  localId: number
  payload: QueuedIncidentPayload
  photoBlobs: Blob[]
  // Caption opcional de cada foto, alineado por índice con `photoBlobs`.
  // SIEMPRE se construye junto a `photoBlobs`, en el mismo `.map()` sobre la
  // misma lista fuente — nunca se muta por separado, para no desalinear
  // índices. Una entrada persistida por una versión anterior del esquema
  // (sin este campo) SHALL tratarse como si ninguna de sus fotos tuviera
  // caption (m7-ajuste-texto-foto-incidencia design.md D1, mismo criterio de
  // compatibilidad hacia atrás que `retryCount` en m7-f3-hardening).
  photoCaptions?: (string | undefined)[]
  geoUbicacion?: IncidenteGeoUbicacion
  empresaId: string
  status: OfflineIncidentStatus
  createdAt: string
  lastAttemptAt?: string
  errorMessage?: string
  // Cuenta intentos fallidos consecutivos clasificados como error de red (ver
  // `markRetryPending`). Opcional para que una entrada persistida por una
  // versión anterior del esquema (sin este campo) siga siendo válida — se
  // trata como 0 en todos los puntos que la leen (m7-f3-hardening design.md D2).
  retryCount?: number
}

export interface EnqueueInput {
  payload: QueuedIncidentPayload
  photoBlobs: Blob[]
  photoCaptions?: (string | undefined)[]
  geoUbicacion?: IncidenteGeoUbicacion
  empresaId: string
}

export class OfflineQueueError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OfflineQueueError'
  }
}

interface IncidentQueueDB extends DBSchema {
  'incident-queue': {
    key: number
    value: QueuedIncident
    indexes: { 'by-createdAt': string }
  }
}

const DB_NAME = 'shac-offline-incidents'
const DB_VERSION = 1
const STORE_NAME = 'incident-queue'
const PENDING_STATUSES: OfflineIncidentStatus[] = ['pending', 'error']
const VISIBLE_STATUSES: OfflineIncidentStatus[] = ['pending', 'syncing', 'error']

let dbPromise: Promise<IDBPDatabase<IncidentQueueDB>> | null = null

function getDB(): Promise<IDBPDatabase<IncidentQueueDB>> {
  dbPromise ??= openDB<IncidentQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true })
      store.createIndex('by-createdAt', 'createdAt')
    },
  })
  return dbPromise
}

export async function enqueue(input: EnqueueInput): Promise<number> {
  const db = await getDB()
  const entry: Omit<QueuedIncident, 'localId'> = {
    payload: input.payload,
    photoBlobs: input.photoBlobs,
    photoCaptions: input.photoCaptions,
    geoUbicacion: input.geoUbicacion,
    empresaId: input.empresaId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  }

  try {
    // `localId` es autoincremental (keyPath): IndexedDB lo asigna al escribir,
    // no se envía en el insert. `idb` tipa `add()` exigiendo el shape completo
    // del value, así que se castea el objeto sin `localId` a propósito.
    return (await db.add(STORE_NAME, entry as QueuedIncident)) as number
  } catch (error) {
    throw new OfflineQueueError(
      'No se pudo guardar el reporte sin conexión. El almacenamiento local del dispositivo está lleno.',
      { cause: error },
    )
  }
}

export async function listPending(): Promise<QueuedIncident[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE_NAME, 'by-createdAt')
  return all.filter((item) => PENDING_STATUSES.includes(item.status))
}

// Para UI (badge/panel): a diferencia de `listPending`, incluye `syncing` —
// un reporte en vuelo debe seguir visible en el panel mientras se sincroniza,
// pero no debe volver a ofrecerse como candidato de un ciclo de sync (por eso
// `listPending`, consumida por el ciclo FIFO, no lo incluye).
export async function listVisible(): Promise<QueuedIncident[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE_NAME, 'by-createdAt')
  return all.filter((item) => VISIBLE_STATUSES.includes(item.status))
}

export async function getById(localId: number): Promise<QueuedIncident | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, localId)
}

export async function markSyncing(localId: number): Promise<void> {
  await patch(localId, { status: 'syncing', lastAttemptAt: new Date().toISOString() })
}

// Una entrada sincronizada ya no tiene ningún consumidor que necesite leerla
// (`listVisible()` ya la excluía de la UI) — se elimina en vez de conservarse
// indefinidamente, liberando sus `photoBlobs` (m7-f3-hardening design.md D2).
export async function markSynced(localId: number): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, localId)
}

export async function markError(localId: number, message: string): Promise<void> {
  await patch(localId, { status: 'error', errorMessage: message, lastAttemptAt: new Date().toISOString() })
}

// Fallo clasificado como error de red (m7-f3-hardening design.md D1): la
// entrada vuelve a `pending` para reintento automático en un ciclo futuro, en
// vez de degradar a `error` en el primer intento. `errorMessage` no se toca
// para que el panel no muestre un mensaje de error mientras el sistema sigue
// reintentando solo.
export async function markRetryPending(localId: number): Promise<void> {
  const db = await getDB()
  const existing = await db.get(STORE_NAME, localId)
  if (!existing) return
  await patch(localId, {
    status: 'pending',
    retryCount: (existing.retryCount ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
  })
}

export async function retry(localId: number): Promise<void> {
  await patch(localId, { status: 'pending', errorMessage: undefined, retryCount: 0 })
}

async function patch(localId: number, changes: Partial<Omit<QueuedIncident, 'localId'>>): Promise<void> {
  const db = await getDB()
  const existing = await db.get(STORE_NAME, localId)
  if (!existing) return
  await db.put(STORE_NAME, { ...existing, ...changes })
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
