import { create } from 'zustand'
import { listVisible, retry as retryQueueEntry, type QueuedIncident } from '../../../lib/offlineQueue'

interface OfflineQueueState {
  items: QueuedIncident[]
  pendingCount: number
  syncingId: number | null
  hasErrors: boolean
  // Referencia al ciclo FIFO de sincronización (`runSyncCycle`) de la única
  // instancia de `useOfflineIncidentSync` montada en `MobileShell` — registrada
  // por el propio hook al montar/desmontar. Permite que código fuera de ese
  // árbol de componentes (el formulario, vía `notifyIncidentEnqueued`) dispare
  // un ciclo de sync sin volver a invocar el hook y duplicar sus listeners.
  syncTrigger: (() => void) | null
}

interface OfflineQueueActions {
  refresh(): Promise<void>
  retry(localId: number): Promise<void>
  setSyncTrigger(trigger: (() => void) | null): void
}

const initialState: OfflineQueueState = {
  items: [],
  pendingCount: 0,
  syncingId: null,
  hasErrors: false,
  syncTrigger: null,
}

/**
 * Proyección compartida del estado de `incident-queue` (IndexedDB, ver
 * `offlineQueue.ts`) — IndexedDB sigue siendo la única fuente de verdad,
 * este store solo cachea el resultado de `listVisible()` para que `MobileShell`
 * (badge de header) y el panel de detalle puedan leerlo sin volver a montar
 * `useOfflineIncidentSync` (m7-f2-indicador-offline design.md D1/D3).
 */
export const useOfflineQueueStore = create<OfflineQueueState & OfflineQueueActions>()((set, get) => ({
  ...initialState,

  refresh: async () => {
    const items = await listVisible()
    const syncing = items.find((item) => item.status === 'syncing')
    set({
      items,
      pendingCount: items.filter((item) => item.status !== 'syncing').length,
      syncingId: syncing ? syncing.localId : null,
      hasErrors: items.some((item) => item.status === 'error'),
    })
  },

  // Disparar el ciclo FIFO de sincronización tras el reintento es
  // responsabilidad de `useOfflineIncidentSync` (necesita la mutation de
  // TanStack Query), no de este store — su `retry(localId)` envuelve a este.
  retry: async (localId) => {
    await retryQueueEntry(localId)
    await get().refresh()
  },

  setSyncTrigger: (trigger) => set({ syncTrigger: trigger }),
}))

/**
 * Llamado por el formulario justo después de un `enqueue()` exitoso: refleja
 * el nuevo pendiente de inmediato en el badge, y si el dispositivo ya está
 * online (p. ej. el POST falló por un error de red transitorio pese a
 * `navigator.onLine === true`), dispara el ciclo de sync ya registrado por
 * `useOfflineIncidentSync` en vez de esperar al próximo evento `online`.
 */
export async function notifyIncidentEnqueued(): Promise<void> {
  await useOfflineQueueStore.getState().refresh()
  if (navigator.onLine) useOfflineQueueStore.getState().syncTrigger?.()
}
