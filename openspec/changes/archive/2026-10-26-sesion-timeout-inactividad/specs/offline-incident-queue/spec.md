## MODIFIED Requirements

### Requirement: Esquema de cola local en IndexedDB
El sistema SHALL persistir reportes de incidencia creados sin conexión en un object store `incident-queue` de IndexedDB (vía `idb`), con key autoincremental local `localId` y campos `payload`, `photoBlobs` (array de `Blob`, posiblemente vacío), `photoCaptions` (array opcional de `string | undefined`, alineado por índice con `photoBlobs` — el caption de cada foto, o `undefined` si esa foto no tiene caption), `geoUbicacion` (opcional), `empresaId`, `usuarioId` (opcional — id del usuario logueado al encolar), `status` (`'pending' | 'syncing' | 'synced' | 'error'`), `createdAt`, `lastAttemptAt`, `errorMessage` (opcional) y `retryCount` (número, cuenta intentos fallidos consecutivos clasificados como error de red — ver capability `offline-incident-sync`). Una entrada sin `retryCount` persistida por una versión anterior del esquema SHALL tratarse como `retryCount: 0`. Una entrada sin `photoCaptions` persistida por una versión anterior del esquema SHALL tratarse como si ninguna de sus fotos tuviera caption (equivalente a un array de `undefined` del mismo largo que `photoBlobs`), sin lanzar error. `photoBlobs` y `photoCaptions` SHALL construirse siempre en el mismo punto de código, a partir de la misma lista fuente, para garantizar su alineación por índice — nunca mutarse por separado. `listPending(usuarioId)` y `listVisible(usuarioId)` SHALL devolver solo las entradas con ese `usuarioId` o sin `usuarioId` (entradas persistidas por una versión anterior del esquema, que conservan el comportamiento previo). El cierre de sesión (manual, por inactividad o por duración máxima) SHALL NOT borrar ni modificar las entradas de la cola: se sincronizan cuando el mismo usuario vuelve a iniciar sesión. El sistema SHALL NOT persistir `accessToken` ni ningún otro credential en el object store.

#### Scenario: Encolar un reporte nuevo
- **WHEN** `enqueue()` se invoca con el payload de un reporte de incidencia, sus fotos comprimidas (con captions opcionales alineados por índice) y su ubicación GPS opcional
- **THEN** el sistema crea una entrada nueva en `incident-queue` con `status: 'pending'`, `usuarioId` del usuario logueado, `createdAt` con la fecha/hora actual, `retryCount: 0`, `photoCaptions` alineado con `photoBlobs` y un `localId` autoincremental asignado

#### Scenario: Listar reportes pendientes
- **WHEN** `listPending(usuarioId)` se invoca
- **THEN** el sistema retorna las entradas de ese usuario (o sin `usuarioId`) con `status` en `'pending'` o `'error'`, ordenadas por `createdAt` ascendente

#### Scenario: Encolar un reporte con fotos sin caption
- **WHEN** `enqueue()` se invoca con fotos donde ninguna tiene caption
- **THEN** el sistema crea la entrada con `photoCaptions` conteniendo `undefined` en cada posición correspondiente, no strings vacíos

#### Scenario: Leer una entrada encolada antes de este cambio
- **WHEN** el sistema lee una entrada de `incident-queue` persistida por una versión anterior del esquema, sin el campo `photoCaptions`
- **THEN** el sistema la trata como si ninguna de sus fotos tuviera caption, sin lanzar error ni bloquear su sincronización

#### Scenario: Entradas de otro usuario no se sincronizan
- **WHEN** la cola tiene una entrada con `usuarioId: 'u1'` y el usuario logueado es `u2`
- **THEN** `listPending('u2')` no la incluye y el ciclo de sincronización no la envía con la identidad de `u2`

#### Scenario: La cola sobrevive al cierre de sesión
- **WHEN** hay entradas pendientes y la sesión se cierra por inactividad
- **THEN** las entradas siguen en `incident-queue` sin cambios y se sincronizan cuando el mismo usuario vuelve a iniciar sesión
