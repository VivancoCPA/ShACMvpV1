import { describe, it, expect, beforeEach } from 'vitest'
import { enqueue, markError, markSyncing, clearAll, type EnqueueInput } from '../../../lib/offlineQueue'
import { useOfflineQueueStore } from './offlineQueueStore'

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

describe('offlineQueueStore', () => {
  beforeEach(async () => {
    await clearAll()
    useOfflineQueueStore.setState({ items: [], pendingCount: 0, syncingId: null, hasErrors: false })
  })

  it('refresh() deja el store vacío cuando la cola no tiene entradas visibles', async () => {
    await useOfflineQueueStore.getState().refresh()

    const state = useOfflineQueueStore.getState()
    expect(state.items).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.syncingId).toBeNull()
    expect(state.hasErrors).toBe(false)
  })

  it('refresh() cuenta pendientes sin incluir la entrada en syncing', async () => {
    const pendingId = await enqueue(buildEnqueueInput())
    const syncingId = await enqueue(buildEnqueueInput())
    await markSyncing(syncingId)

    await useOfflineQueueStore.getState().refresh()

    const state = useOfflineQueueStore.getState()
    expect(state.items.map((i) => i.localId)).toEqual([pendingId, syncingId])
    expect(state.pendingCount).toBe(1)
    expect(state.syncingId).toBe(syncingId)
    expect(state.hasErrors).toBe(false)
  })

  it('refresh() marca hasErrors cuando hay al menos una entrada en error', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markError(localId, 'fallo de red')

    await useOfflineQueueStore.getState().refresh()

    expect(useOfflineQueueStore.getState().hasErrors).toBe(true)
  })

  it('retry(localId) delega en offlineQueue.retry y refresca el store', async () => {
    const localId = await enqueue(buildEnqueueInput())
    await markError(localId, 'fallo de red')
    await useOfflineQueueStore.getState().refresh()
    expect(useOfflineQueueStore.getState().hasErrors).toBe(true)

    await useOfflineQueueStore.getState().retry(localId)

    const state = useOfflineQueueStore.getState()
    expect(state.hasErrors).toBe(false)
    expect(state.items.find((i) => i.localId === localId)?.status).toBe('pending')
  })
})
