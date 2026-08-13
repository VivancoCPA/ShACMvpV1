## MODIFIED Requirements

### Requirement: Esquema de cola local en IndexedDB
El sistema SHALL persistir reportes de incidencia creados sin conexión en un object store `incident-queue` de IndexedDB (vía `idb`), con key autoincremental local `localId` y campos `payload`, `photoBlobs` (array de `Blob`, posiblemente vacío), `geoUbicacion` (opcional), `empresaId`, `status` (`'pending' | 'syncing' | 'synced' | 'error'`), `createdAt`, `lastAttemptAt`, `errorMessage` (opcional) y `retryCount` (número, cuenta intentos fallidos consecutivos clasificados como error de red — ver capability `offline-incident-sync`). Una entrada sin `retryCount` persistida por una versión anterior del esquema SHALL tratarse como `retryCount: 0`. El sistema SHALL NOT persistir `accessToken` ni ningún otro credential en el object store.

#### Scenario: Encolar un reporte nuevo
- **WHEN** `enqueue()` se invoca con el payload de un reporte de incidencia, sus fotos comprimidas y su ubicación GPS opcional
- **THEN** el sistema crea una entrada nueva en `incident-queue` con `status: 'pending'`, `createdAt` con la fecha/hora actual, `retryCount: 0` y un `localId` autoincremental asignado

#### Scenario: Listar reportes pendientes
- **WHEN** `listPending()` se invoca
- **THEN** el sistema retorna todas las entradas con `status` en `'pending'` o `'error'`, ordenadas por `createdAt` ascendente

### Requirement: Transiciones de estado de una entrada encolada
El sistema SHALL exponer las operaciones `markSyncing(localId)`, `markSynced(localId)`, `markError(localId, message)` y `markRetryPending(localId)` para transicionar el `status` de una entrada, y `retry(localId)` para volver a poner en `'pending'` una entrada en `status: 'error'` reiniciando su `retryCount` a 0.

#### Scenario: Marcar una entrada como sincronizando
- **WHEN** `markSyncing(localId)` se invoca sobre una entrada en `status: 'pending'`
- **THEN** el sistema actualiza su `status` a `'syncing'` y su `lastAttemptAt` a la fecha/hora actual

#### Scenario: Marcar una entrada como sincronizada
- **WHEN** `markSynced(localId)` se invoca tras un envío exitoso
- **THEN** el sistema elimina la entrada de `incident-queue` (incluyendo sus `photoBlobs`) en vez de conservarla con `status: 'synced'` — una entrada sincronizada no tiene ya ningún consumidor que necesite leerla

#### Scenario: Marcar una entrada en error
- **WHEN** `markError(localId, message)` se invoca tras un envío fallido no clasificado como error de red, o tras agotar los reintentos automáticos de red
- **THEN** el sistema actualiza su `status` a `'error'`, guarda `message` en `errorMessage` y actualiza `lastAttemptAt`, sin modificar `retryCount`

#### Scenario: Marcar una entrada para reintento automático tras un fallo de red
- **WHEN** `markRetryPending(localId)` se invoca sobre una entrada cuyo intento de sincronización falló por un error clasificado como red
- **THEN** el sistema mantiene (o vuelve a poner) su `status` en `'pending'`, incrementa `retryCount` en 1, actualiza `lastAttemptAt` y NO modifica `errorMessage`

#### Scenario: Reintentar manualmente una entrada en error
- **WHEN** el usuario invoca `retry(localId)` sobre una entrada en `status: 'error'`
- **THEN** el sistema vuelve a poner su `status` en `'pending'`, reinicia `retryCount` a 0 y limpia `errorMessage`, dejándola disponible para el próximo ciclo de sincronización con un contador de reintentos automáticos nuevo
