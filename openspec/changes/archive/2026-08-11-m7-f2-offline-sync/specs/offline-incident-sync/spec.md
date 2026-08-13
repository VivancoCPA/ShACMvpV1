## ADDED Requirements

### Requirement: Sincronización FIFO de un solo intento a la vez
El sistema SHALL sincronizar los reportes encolados en orden de creación (`createdAt` ascendente), procesando un único reporte a la vez. El sistema SHALL NOT sincronizar dos o más reportes en paralelo.

#### Scenario: Dos reportes en cola al recuperar conexión
- **WHEN** hay dos reportes con `status: 'pending'` y el dispositivo recupera conexión
- **THEN** el sistema sincroniza primero el reporte con `createdAt` más antiguo, y solo inicia el segundo una vez que el primero terminó (exitosa o fallidamente)

### Requirement: Un reporte fallido no bloquea a los siguientes
Si la sincronización de un reporte falla, el sistema SHALL marcarlo en `status: 'error'` de forma independiente y SHALL continuar procesando el resto de la cola en orden, sin tratar la cola como una transacción atómica.

#### Scenario: El primer reporte de la cola falla por error de servidor
- **WHEN** el primer reporte pendiente falla la sincronización por un error de validación del servidor
- **THEN** el sistema lo marca en `status: 'error'` con el mensaje correspondiente y continúa sincronizando el siguiente reporte pendiente de la cola

### Requirement: Reutilización de la mutation de creación de incidentes existente
La sincronización de un reporte encolado SHALL reutilizar la misma mutation de creación de incidentes (`useCreateIncident`) que usa el formulario de escritorio y el envío online del formulario mobile, reconstruyendo el payload (incluyendo evidencias a partir de los `Blob` persistidos) sin reimplementar la llamada a la API.

#### Scenario: Sincronización exitosa de un reporte con fotos
- **WHEN** un reporte encolado con `photoBlobs` no vacío sincroniza exitosamente
- **THEN** el sistema reconstruye las evidencias del incidente a partir de los `Blob` persistidos y las envía en el mismo payload que usaría un envío online directo, sin duplicar la lógica de la llamada HTTP

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
