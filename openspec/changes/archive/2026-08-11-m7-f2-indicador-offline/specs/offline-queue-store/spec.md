## ADDED Requirements

### Requirement: Store Zustand con la proyección de la cola offline
El sistema SHALL exponer un store de Zustand (`offlineQueueStore`) que proyecta el contenido de `incident-queue` (IndexedDB, ver `offlineQueue.ts`) como `items` (entradas en `status: 'pending'`, `'syncing'` o `'error'`, ordenadas por `createdAt` ascendente), `pendingCount`, `syncingId` (localId de la entrada en `status: 'syncing'`, o `null`) y `hasErrors` (booleano). El store SHALL NOT persistir una copia propia de la cola — `refresh()` siempre recalcula desde IndexedDB, que sigue siendo la única fuente de verdad.

#### Scenario: Refrescar el store desde la cola
- **WHEN** `refresh()` se invoca
- **THEN** el store recalcula `items`, `pendingCount`, `syncingId` y `hasErrors` a partir de una lectura fresca de `incident-queue`, excluyendo las entradas en `status: 'synced'`

#### Scenario: Cola vacía
- **WHEN** `refresh()` se invoca y no hay entradas en `status: 'pending'`, `'syncing'` o `'error'`
- **THEN** el store queda con `items: []`, `pendingCount: 0`, `syncingId: null` y `hasErrors: false`

### Requirement: `refresh()` se dispara desde los mismos puntos que hoy refresca `useOfflineIncidentSync`
El sistema SHALL invocar `refresh()` sobre el store desde los 4 puntos donde la cola puede cambiar: (1) el mount del hook de sincronización, (2) el listener del evento `online`, (3) el listener del mensaje `SYNC_MESSAGE_TYPE` reenviado por el Service Worker tras su evento `sync`, y (4) inmediatamente después de encolar un reporte nuevo (`notifyEnqueued`) o de invocar `retry`/`retryAll`.

#### Scenario: Nuevo reporte encolado desde el formulario
- **WHEN** el formulario encola un reporte nuevo con éxito
- **THEN** el store se refresca de inmediato y `pendingCount` refleja el nuevo total sin esperar al próximo evento `online`

#### Scenario: Reconexión detectada
- **WHEN** el navegador dispara el evento `online`
- **THEN** el store se refresca antes/durante el ciclo de sincronización, de forma que `syncingId` refleje la entrada que se está procesando

### Requirement: `retry(localId)` delega en `offlineQueue.retry` y refresca el store
El sistema SHALL exponer `retry(localId)` en el store, que invoca `retry(localId)` de `offlineQueue.ts` (vuelve la entrada a `status: 'pending'`) y refresca el store. El disparo del ciclo FIFO de sincronización tras un reintento SHALL seguir siendo responsabilidad exclusiva de `useOfflineIncidentSync` (mismo camino que usan el listener `online` y el mensaje `sync` del Service Worker) — el store no depende de la mutation de TanStack Query que ese ciclo requiere, así que la UI invoca el `retry(localId)` expuesto por el hook (que a su vez llama al del store) y no el del store de forma aislada.

#### Scenario: Reintentar una entrada específica en error
- **WHEN** se invoca `retry(localId)` del hook de sincronización sobre una entrada en `status: 'error'`
- **THEN** la entrada vuelve a `status: 'pending'`, el store se refresca, y el ciclo de sincronización FIFO la procesa siguiendo el mismo orden `by-createdAt` que un ciclo automático
