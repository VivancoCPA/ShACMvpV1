## Why

`m7-f2-offline-sync` ya implementó la cola offline (`incident-queue` en IndexedDB) y su sincronización FIFO automática (`useOfflineIncidentSync`), con un indicador mínimo (`OfflineQueueIndicator`) embebido dentro de `IncidentQuickReportForm`. Ese indicador solo muestra un contador agregado y un botón "Reintentar todos", y solo es visible mientras el usuario está parado en el formulario — no hay forma de ver el detalle de cada reporte encolado (fecha, estado, motivo del error) ni de reintentar uno específico sin recargar la vista. El único modo actual de inspeccionar la cola es DevTools → Application → IndexedDB, que no es viable para un supervisor de campo. Este cambio cierra el pendiente 1 del handoff de Fase 2: un indicador global (badge + panel de detalle) accesible desde cualquier vista mobile.

## What Changes

- Centralizar el estado de la cola offline (hoy `useState` local dentro de `useOfflineIncidentSync`, consumido únicamente por `IncidentQuickReportForm`) en un store de Zustand para que sea legible desde `MobileShell` (fuera del árbol del formulario) sin prop drilling.
- Agregar un slot de header a `MobileShell` (hoy no tiene ninguno) y montar ahí un badge de estado de cola (`SyncQueueBadge`), visible solo cuando hay reportes `pending`/`syncing`/`error` — ámbar si no hay errores, rojo si hay al menos uno.
- Agregar un panel desplegable (`SyncQueuePanel`), abierto desde el badge con el mismo patrón popover ya usado por `NotificationBell` (`features/notifications/components/NotificationBell.tsx`) — sin introducir un componente de overlay nuevo. Lista cada reporte `pending`/`syncing`/`error` en orden FIFO (`by-createdAt`) con fecha, estado y mensaje de error si aplica.
- Agregar reintento por reporte individual en el panel (`retry(localId)` ya existe en `useOfflineIncidentSync`/`offlineQueue.ts`, pero hoy no está cableado a ningún elemento de UI — solo `retryAll()` lo está).
- Retirar el banner inline `OfflineQueueIndicator` de `IncidentQuickReportForm`, ahora redundante con el badge global del header (evita mostrar el mismo contador dos veces en la misma pantalla).
- Nuevas claves i18next bajo el namespace y prefijo ya establecidos por Fase 2 (`incidents:mobile.offline.*`), no un namespace `offline` nuevo — reutilizando `pendingBadge`/`retry`/`syncing` donde aplica y sumando las claves específicas del panel (título, vacío, labels de estado, mensaje de error por item).

## Capabilities

### New Capabilities
- `offline-queue-store`: store Zustand que proyecta el estado de `incident-queue` (IndexedDB) — items visibles (`pending`/`syncing`/`error`, excluye `synced`), conteos por status, `refresh()` y `retry(localId)` — como fuente compartida para cualquier componente mobile que necesite leer o accionar sobre la cola offline, sin que IndexedDB deje de ser la fuente de verdad.
- `offline-queue-indicator`: `SyncQueueBadge` (badge de estado en el header de `MobileShell`) + `SyncQueuePanel` (panel popover con el detalle de cada reporte encolado y reintento individual).

### Modified Capabilities
- `mobile-incident-report`: el requirement "Indicador de estado de la cola offline en la UI mobile" (spec de `m7-f2-offline-sync`) se retira del formulario — el indicador deja de vivir inline en `IncidentQuickReportForm` y pasa a ser responsabilidad exclusiva de `offline-queue-indicator` en el header de `MobileShell`.

## Impact

- `src/features/incidents/hooks/useOfflineIncidentSync.ts`: su estado local (`pendingCount`, `hasErrors`, `syncingId`) se reemplaza por lectura/escritura sobre el store nuevo; el ciclo de sincronización FIFO (`runSyncCycle`) y los listeners (`online`, mensaje `sync` del SW) se conservan tal cual, solo cambia dónde vive el estado que exponen.
- `src/features/incidents/components/IncidentQuickReportForm.tsx` y `OfflineQueueIndicator.tsx`: se retira el uso del banner inline; `OfflineQueueIndicator.tsx` queda sin consumidor y se elimina.
- `src/components/layout/MobileShell.tsx`: gana un header con el badge nuevo.
- `src/i18n/es-PE.json` y `en-US.json`: nuevas claves bajo `incidents:mobile.offline.*`.
- No hay cambios a `src/lib/offlineQueue.ts` (API de IndexedDB) ni a `src/sw.ts` — el contrato de persistencia y el mensaje de `sync` de Fase 2 se reutilizan sin modificar.
