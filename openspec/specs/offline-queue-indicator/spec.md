# offline-queue-indicator

## Purpose

Indicador global de estado de la cola offline en la UI mobile: un badge de estado en el header de `MobileShell`, visible desde cualquier vista bajo `/m/*`, con un panel de detalle (popover) que lista las entradas pendientes/en sincronización/en error de la cola offline y permite reintentar entradas individuales en error.

## Requirements

### Requirement: Badge de estado de cola en el header de `MobileShell`
El layout mobile SHALL mostrar un badge de estado de la cola offline (`SyncQueueBadge`) en el header de `MobileShell`, visible desde cualquier vista bajo `/m/*` — no solo dentro del formulario de reporte de incidentes. El badge SHALL estar oculto cuando `pendingCount + (syncingId !== null ? 1 : 0)` sea `0` y no haya entradas en `status: 'error'`. El badge SHALL mostrarse en color ámbar cuando existan entradas `pending`/`syncing` sin ningún error, y en color rojo cuando exista al menos una entrada en `status: 'error'`.

#### Scenario: Cola vacía y sin errores
- **WHEN** el store de cola offline tiene `pendingCount: 0`, `syncingId: null` y `hasErrors: false`
- **THEN** el header de `MobileShell` no muestra el badge

#### Scenario: Reportes pendientes sin errores
- **WHEN** `pendingCount` es mayor a 0 y `hasErrors` es `false`
- **THEN** el badge se muestra en color ámbar con el conteo de pendientes

#### Scenario: Al menos un reporte en error
- **WHEN** `hasErrors` es `true`
- **THEN** el badge se muestra en color rojo, sin importar el valor de `pendingCount`

#### Scenario: Cola se vacía tras sincronizar sin recargar la página
- **WHEN** el ciclo de sincronización FIFO transiciona la última entrada pendiente a `status: 'synced'`
- **THEN** el badge desaparece automáticamente del header sin que el usuario recargue la página

### Requirement: Panel de detalle de la cola offline
El sistema SHALL mostrar, al presionar el badge, un panel (`SyncQueuePanel`) anclado bajo el badge (mismo patrón popover que `NotificationBell`) que lista cada entrada en `status: 'pending'`, `'syncing'` o `'error'` en orden FIFO (`by-createdAt` ascendente), mostrando su fecha de creación, su estado, y su `errorMessage` cuando `status === 'error'`. Las entradas en `status: 'synced'` SHALL NOT aparecer en el panel.

#### Scenario: Panel con reportes en distintos estados
- **WHEN** el usuario abre el panel y hay 2-3 reportes encolados en `pending`/`syncing`/`error`
- **THEN** el panel los lista en orden FIFO por `createdAt`, cada uno mostrando su propio estado de forma independiente

#### Scenario: Panel sin reportes pendientes
- **WHEN** el usuario abre el panel y no hay entradas en `pending`/`syncing`/`error`
- **THEN** el panel muestra un estado vacío en vez de una lista

### Requirement: Reintento individual desde el panel
El panel SHALL mostrar un botón "Reintentar" únicamente en las entradas con `status: 'error'`, que al presionarse invoca `retry(localId)` sobre esa entrada específica.

#### Scenario: Reintentar un reporte específico
- **WHEN** el usuario presiona "Reintentar" sobre una entrada en `status: 'error'`
- **THEN** la entrada transiciona a `'pending'` y luego a `'syncing'`, y desaparece del panel al completar la sincronización (`'synced'`), sin quedar duplicada

#### Scenario: Botón de reintento no visible en entradas sin error
- **WHEN** una entrada está en `status: 'pending'` o `'syncing'`
- **THEN** el panel no muestra un botón "Reintentar" para esa entrada
