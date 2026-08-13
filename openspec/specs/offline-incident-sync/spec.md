# offline-incident-sync

## Purpose

Sincronización FIFO de un solo intento a la vez de los reportes de incidencia encolados en `offline-incident-queue`, disparada por el evento `online` del navegador y por Background Sync, reutilizando la mutation de creación de incidentes existente y exponiendo estado y reintento manual vía `useOfflineIncidentSync()`.

## Requirements

### Requirement: Sincronización FIFO de un solo intento a la vez
El sistema SHALL sincronizar los reportes encolados en orden de creación (`createdAt` ascendente), procesando un único reporte a la vez. El sistema SHALL NOT sincronizar dos o más reportes en paralelo.

#### Scenario: Dos reportes en cola al recuperar conexión
- **WHEN** hay dos reportes con `status: 'pending'` y el dispositivo recupera conexión
- **THEN** el sistema sincroniza primero el reporte con `createdAt` más antiguo, y solo inicia el segundo una vez que el primero terminó (exitosa o fallidamente)

### Requirement: Un reporte fallido no bloquea a los siguientes
Si la sincronización de un reporte falla con un error clasificado como de **backend** (validación, permisos, o el bug de coordinación de Service Workers `ERR_INVALID_RESPONSE_ENVELOPE`), el sistema SHALL marcarlo en `status: 'error'` de forma independiente en ese mismo intento. Si el fallo se clasifica como error de **red** y la entrada no agotó sus reintentos automáticos (ver Requirement: Clasificación de errores de sincronización y reintento automático), el sistema SHALL devolverla a `status: 'pending'` en vez de `'error'`. En ambos casos, el sistema SHALL continuar procesando el resto de la cola en orden, sin tratar la cola como una transacción atómica ni bloquear a los reportes siguientes por el fallo de uno.

#### Scenario: El primer reporte de la cola falla por error de servidor
- **WHEN** el primer reporte pendiente falla la sincronización por un error de validación del servidor
- **THEN** el sistema lo marca en `status: 'error'` con el mensaje correspondiente y continúa sincronizando el siguiente reporte pendiente de la cola

#### Scenario: El primer reporte de la cola falla por corte de señal
- **WHEN** el primer reporte pendiente falla la sincronización por un error de red (sin agotar sus reintentos automáticos)
- **THEN** el sistema lo devuelve a `status: 'pending'` (no `'error'`) y continúa sincronizando el siguiente reporte pendiente de la cola en el mismo ciclo

### Requirement: Clasificación de errores de sincronización y reintento automático ante fallos de red
Ante cada intento fallido de sincronización de una entrada, el sistema SHALL clasificar el error reutilizando el mismo criterio que `classifySubmitError()` (red / envelope inválido / servidor). Si la clasificación es **red**, el sistema SHALL reintentar automáticamente en ciclos de sincronización posteriores hasta un máximo de 3 intentos fallidos consecutivos por causa de red; al superar ese máximo, SHALL marcar la entrada en `status: 'error'` con un mensaje que indique que se agotaron los reintentos automáticos. Si la clasificación es **envelope inválido** o **servidor**, el sistema SHALL marcar la entrada en `status: 'error'` de inmediato, sin reintento automático. El sistema SHALL NOT mostrar una notificación (`toast`) de error mientras una entrada permanece en reintento automático (`status: 'pending'` tras un fallo de red bajo el límite) — solo al llegar efectivamente a `status: 'error'`.

#### Scenario: Fallo de red por debajo del límite de reintentos
- **WHEN** la sincronización de una entrada falla con un error clasificado como red y su `retryCount` es menor a 3
- **THEN** el sistema incrementa `retryCount`, devuelve la entrada a `status: 'pending'` y NO muestra una notificación de error al usuario

#### Scenario: Fallo de red que agota los reintentos automáticos
- **WHEN** la sincronización de una entrada falla con un error clasificado como red y su `retryCount` ya es 3
- **THEN** el sistema marca la entrada en `status: 'error'` con un mensaje indicando que se agotaron los reintentos automáticos, y muestra una notificación de error al usuario

#### Scenario: Fallo de backend no se reintenta automáticamente
- **WHEN** la sincronización de una entrada falla con un error clasificado como servidor (4xx/5xx con `error.response`) o como envelope inválido
- **THEN** el sistema marca la entrada en `status: 'error'` en ese mismo intento, sin incrementar `retryCount`, y muestra una notificación de error al usuario

#### Scenario: Reintento manual tras agotar los reintentos automáticos
- **WHEN** el usuario reintenta manualmente una entrada que había llegado a `status: 'error'` por agotar sus reintentos automáticos de red
- **THEN** el sistema reinicia su `retryCount` a 0, de forma que un nuevo fallo de red parte de un contador limpio en vez de heredar el anterior

### Requirement: Reutilización de la mutation de creación de incidentes existente
La sincronización de un reporte encolado SHALL reutilizar la misma mutation de creación de incidentes (`useCreateIncident`) que usa el formulario de escritorio y el envío online del formulario mobile, reconstruyendo el payload (incluyendo evidencias a partir de los `Blob` persistidos, y el caption de cada foto desde `photoCaptions` alineado por índice) sin reimplementar la llamada a la API.

#### Scenario: Sincronización exitosa de un reporte con fotos
- **WHEN** un reporte encolado con `photoBlobs` no vacío sincroniza exitosamente
- **THEN** el sistema reconstruye las evidencias del incidente a partir de los `Blob` persistidos y las envía en el mismo payload que usaría un envío online directo, sin duplicar la lógica de la llamada HTTP

#### Scenario: Sincronización propaga el caption de cada foto
- **WHEN** un reporte encolado tiene `photoCaptions` con al menos un caption definido, y sincroniza exitosamente
- **THEN** cada `IncidentEvidencia` reconstruida incluye `descripcion` igual al caption correspondiente en `photoCaptions` por el mismo índice que su `Blob` en `photoBlobs`

#### Scenario: Sincronización de una entrada sin `photoCaptions` (encolada antes de este cambio)
- **WHEN** un reporte encolado no tiene el campo `photoCaptions` (persistido por una versión anterior del esquema) sincroniza exitosamente
- **THEN** el sistema reconstruye las evidencias correctamente, todas sin `descripcion`, sin lanzar error

### Requirement: Disparo de sincronización por evento `online` y por Background Sync
El sistema SHALL disparar un ciclo de sincronización cuando el hilo principal detecta el evento `online` del navegador, y SHALL disparar el mismo ciclo cuando el Service Worker de la PWA reenvía al hilo principal (vía `postMessage`) el evento de Background Sync (`sync`, tag `sync-incidents`) en los navegadores donde esa API existe. En navegadores sin soporte para Background Sync API, el listener `online` SHALL ser el único disparador automático.

#### Scenario: El dispositivo recupera conexión con la app abierta
- **WHEN** el navegador emite el evento `online` y hay reportes con `status: 'pending'` o `status: 'error'` en la cola
- **THEN** el sistema inicia el ciclo de sincronización FIFO sin acción manual del usuario

#### Scenario: Background Sync despierta a un cliente abierto
- **WHEN** el Service Worker recibe el evento `sync` con tag `sync-incidents` y encuentra al menos un cliente (pestaña) abierto
- **THEN** el Service Worker envía un mensaje a ese cliente y el hilo principal inicia el ciclo de sincronización FIFO

#### Scenario: Navegador sin soporte de Background Sync API
- **WHEN** la aplicación se ejecuta en un navegador que no implementa Background Sync API (p. ej. Safari iOS o Firefox)
- **THEN** el sistema sigue sincronizando exclusivamente a través del listener `online` del hilo principal, sin error ni degradación visible para el usuario

### Requirement: Reintento manual expuesto por el hook
El hook `useOfflineIncidentSync()` SHALL exponer `pendingCount` (cantidad de reportes en `status: 'pending'` o `'error'`), `syncingId` (el `localId` en sincronización activa, si hay alguno) y una función `retry()` que reintenta un reporte específico en `status: 'error'`.

#### Scenario: Consultar el conteo de pendientes
- **WHEN** hay tres reportes en `status: 'pending'` y uno en `status: 'error'` en la cola
- **THEN** `pendingCount` retorna 4

#### Scenario: Reintentar manualmente un reporte en error
- **WHEN** el usuario invoca `retry()` sobre un reporte en `status: 'error'`
- **THEN** el sistema lo vuelve a poner en `status: 'pending'` y lo incluye en el próximo ciclo de sincronización FIFO
