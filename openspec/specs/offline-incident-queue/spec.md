# offline-incident-queue

## Purpose

Cola local en IndexedDB para reportes de incidencia SyST creados sin conexión desde el formulario mobile (`/m/incidentes/nuevo`): persistencia del payload, fotos comprimidas y ubicación GPS opcional, con transiciones de estado explícitas y manejo no bloqueante de fallos de cuota de almacenamiento.

## Requirements

### Requirement: Esquema de cola local en IndexedDB
El sistema SHALL persistir reportes de incidencia creados sin conexión en un object store `incident-queue` de IndexedDB (vía `idb`), con key autoincremental local `localId` y campos `payload`, `photoBlobs` (array de `Blob`, posiblemente vacío), `photoCaptions` (array opcional de `string | undefined`, alineado por índice con `photoBlobs` — el caption de cada foto, o `undefined` si esa foto no tiene caption), `geoUbicacion` (opcional), `empresaId`, `status` (`'pending' | 'syncing' | 'synced' | 'error'`), `createdAt`, `lastAttemptAt`, `errorMessage` (opcional) y `retryCount` (número, cuenta intentos fallidos consecutivos clasificados como error de red — ver capability `offline-incident-sync`). Una entrada sin `retryCount` persistida por una versión anterior del esquema SHALL tratarse como `retryCount: 0`. Una entrada sin `photoCaptions` persistida por una versión anterior del esquema SHALL tratarse como si ninguna de sus fotos tuviera caption (equivalente a un array de `undefined` del mismo largo que `photoBlobs`), sin lanzar error. `photoBlobs` y `photoCaptions` SHALL construirse siempre en el mismo punto de código, a partir de la misma lista fuente, para garantizar su alineación por índice — nunca mutarse por separado. El sistema SHALL NOT persistir `accessToken` ni ningún otro credential en el object store.

#### Scenario: Encolar un reporte nuevo
- **WHEN** `enqueue()` se invoca con el payload de un reporte de incidencia, sus fotos comprimidas (con captions opcionales alineados por índice) y su ubicación GPS opcional
- **THEN** el sistema crea una entrada nueva en `incident-queue` con `status: 'pending'`, `createdAt` con la fecha/hora actual, `retryCount: 0`, `photoCaptions` alineado con `photoBlobs` y un `localId` autoincremental asignado

#### Scenario: Listar reportes pendientes
- **WHEN** `listPending()` se invoca
- **THEN** el sistema retorna todas las entradas con `status` en `'pending'` o `'error'`, ordenadas por `createdAt` ascendente

#### Scenario: Encolar un reporte con fotos sin caption
- **WHEN** `enqueue()` se invoca con fotos donde ninguna tiene caption
- **THEN** el sistema crea la entrada con `photoCaptions` conteniendo `undefined` en cada posición correspondiente, no strings vacíos

#### Scenario: Leer una entrada encolada antes de este cambio
- **WHEN** el sistema lee una entrada de `incident-queue` persistida por una versión anterior del esquema, sin el campo `photoCaptions`
- **THEN** el sistema la trata como si ninguna de sus fotos tuviera caption, sin lanzar error ni bloquear su sincronización

### Requirement: Compresión de fotos antes de encolar
El sistema SHALL comprimir cada foto adjunta (vía `browser-image-compression`, ejecutado en un Web Worker) en el momento en que el usuario la adjunta al formulario, antes de que el reporte se encole — no en el momento de sincronizar.

#### Scenario: Usuario adjunta una foto sin conexión
- **WHEN** el usuario selecciona una foto desde la cámara o galería mientras el dispositivo está sin conexión
- **THEN** el sistema comprime la foto de inmediato y, si el reporte se encola, persiste el `Blob` comprimido en `photoBlobs`, no el archivo original sin comprimir

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

### Requirement: Fallo de cuota de almacenamiento no bloquea la aplicación
Si `enqueue()` falla por cuota de almacenamiento de IndexedDB agotada, el sistema SHALL capturar el error, SHALL NOT dejar la aplicación en un estado roto o sin respuesta, y SHALL comunicar al usuario que el reporte no pudo guardarse localmente con un mensaje claro.

#### Scenario: Cuota de IndexedDB agotada al encolar
- **WHEN** `enqueue()` falla porque el navegador rechaza la escritura por cuota de almacenamiento agotada
- **THEN** el sistema muestra un mensaje de error claro al usuario y no pierde la aplicación en un estado inconsistente
