## ADDED Requirements

### Requirement: Esquema de cola local en IndexedDB
El sistema SHALL persistir reportes de incidencia creados sin conexión en un object store `incident-queue` de IndexedDB (vía `idb`), con key autoincremental local `localId` y campos `payload`, `photoBlobs` (array de `Blob`, posiblemente vacío), `geoUbicacion` (opcional), `empresaId`, `status` (`'pending' | 'syncing' | 'synced' | 'error'`), `createdAt`, `lastAttemptAt` y `errorMessage` (opcional). El sistema SHALL NOT persistir `accessToken` ni ningún otro credential en el object store.

#### Scenario: Encolar un reporte nuevo
- **WHEN** `enqueue()` se invoca con el payload de un reporte de incidencia, sus fotos comprimidas y su ubicación GPS opcional
- **THEN** el sistema crea una entrada nueva en `incident-queue` con `status: 'pending'`, `createdAt` con la fecha/hora actual y un `localId` autoincremental asignado

#### Scenario: Listar reportes pendientes
- **WHEN** `listPending()` se invoca
- **THEN** el sistema retorna todas las entradas con `status` en `'pending'` o `'error'`, ordenadas por `createdAt` ascendente

### Requirement: Compresión de fotos antes de encolar
El sistema SHALL comprimir cada foto adjunta (vía `browser-image-compression`, ejecutado en un Web Worker) en el momento en que el usuario la adjunta al formulario, antes de que el reporte se encole — no en el momento de sincronizar.

#### Scenario: Usuario adjunta una foto sin conexión
- **WHEN** el usuario selecciona una foto desde la cámara o galería mientras el dispositivo está sin conexión
- **THEN** el sistema comprime la foto de inmediato y, si el reporte se encola, persiste el `Blob` comprimido en `photoBlobs`, no el archivo original sin comprimir

### Requirement: Transiciones de estado de una entrada encolada
El sistema SHALL exponer las operaciones `markSyncing(localId)`, `markSynced(localId)` y `markError(localId, message)` para transicionar el `status` de una entrada, y `retry(localId)` para volver a poner en `'pending'` una entrada en `status: 'error'`.

#### Scenario: Marcar una entrada como sincronizando
- **WHEN** `markSyncing(localId)` se invoca sobre una entrada en `status: 'pending'`
- **THEN** el sistema actualiza su `status` a `'syncing'` y su `lastAttemptAt` a la fecha/hora actual

#### Scenario: Marcar una entrada como sincronizada
- **WHEN** `markSynced(localId)` se invoca tras un envío exitoso
- **THEN** el sistema actualiza su `status` a `'synced'`

#### Scenario: Marcar una entrada en error
- **WHEN** `markError(localId, message)` se invoca tras un envío fallido
- **THEN** el sistema actualiza su `status` a `'error'`, guarda `message` en `errorMessage` y actualiza `lastAttemptAt`

#### Scenario: Reintentar una entrada en error
- **WHEN** el usuario invoca `retry(localId)` sobre una entrada en `status: 'error'`
- **THEN** el sistema vuelve a poner su `status` en `'pending'`, dejándola disponible para el próximo ciclo de sincronización

### Requirement: Fallo de cuota de almacenamiento no bloquea la aplicación
Si `enqueue()` falla por cuota de almacenamiento de IndexedDB agotada, el sistema SHALL capturar el error, SHALL NOT dejar la aplicación en un estado roto o sin respuesta, y SHALL comunicar al usuario que el reporte no pudo guardarse localmente con un mensaje claro.

#### Scenario: Cuota de IndexedDB agotada al encolar
- **WHEN** `enqueue()` falla porque el navegador rechaza la escritura por cuota de almacenamiento agotada
- **THEN** el sistema muestra un mensaje de error claro al usuario y no pierde la aplicación en un estado inconsistente
