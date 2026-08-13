## Why

`m7-f1-pwa-formulario-mobile` entregó el reporte rápido de incidencias en `/m/incidentes/nuevo` como flujo **online-only**: sin conexión, el envío falla visiblemente y el usuario de campo pierde el reporte (debe recordarlo y reintentarlo manualmente más tarde). En patio de almacén / zona de carga de minerales la señal es intermitente por diseño del entorno — esa fue una limitación aceptada explícitamente como Non-Goal de Fase 1, no un defecto. Esta Fase 2 cierra ese gap: un reporte creado sin conexión debe quedar guardado localmente y sincronizarse solo, sin que el usuario tenga que hacer nada salvo, en el peor caso, reintentar.

## What Changes

- Nuevo módulo `lib/offlineQueue.ts`: wrapper sobre IndexedDB (vía `idb`) con un object store `incident-queue` (key autoincremental `localId`) y operaciones `enqueue()`, `listPending()`, `markSyncing()`, `markSynced()`, `markError()`, `retry(localId)`.
- Nuevo hook `useOfflineIncidentSync()`: orquesta sincronización FIFO (un intento a la vez, en orden de creación), escucha el evento `online` del navegador y el mensaje de Background Sync reenviado por el Service Worker vía `postMessage`; expone `pendingCount`, `syncingId`, `retry()`.
- Compresión de fotos (`browser-image-compression`, en Web Worker) en el momento de adjuntar la foto en `IncidentQuickReportPage` — antes de encolar, no al sincronizar — para que lo persistido en IndexedDB ya sea el Blob final y liviano.
- `IncidentQuickReportPage`: cuando `navigator.onLine === false`, o el `POST /api/incidents` falla por error de red (no de validación), el formulario ya no muestra un `toast` de error — encola el reporte (`enqueue()`) y confirma "guardado, se enviará cuando haya conexión". La sincronización real reutiliza `useCreateIncident` sin reimplementar la llamada a la API.
- Indicador de estado de cola en la UI mobile: badge con `pendingCount` y botón "Reintentar" visible cuando hay reportes en `status: 'error'`.
- Registro de un `sync` event (tag `sync-incidents`) en el Service Worker de la PWA donde el navegador lo soporte (Chrome/Edge Android), sin romper el invariante ya establecido en Fase 1 (D4 del design.md anterior): el SW sigue sin interceptar `/api/**` para runtime-caching, para no competir con MSW.
- Nuevas claves i18n `incidents.mobile.offline.*` (guardado sin conexión, sincronizando, error, reintentar) en `es-PE.json` y `en-US.json`.
- **BREAKING (spec-level, no de API):** el comportamiento de "envío falla sin conexión" descrito en el `Requirement: Envío online-only contra el mock existente` de `mobile-incident-report` (Fase 1) queda reemplazado por el comportamiento de encolado — ese requirement se modifica en esta fase, no queda vigente tal cual.

## Capabilities

### New Capabilities
- `offline-incident-queue`: módulo `lib/offlineQueue.ts` — esquema IndexedDB del object store `incident-queue` y las operaciones CRUD (`enqueue`, `listPending`, `markSyncing`, `markSynced`, `markError`, `retry`) que gestionan el ciclo de vida local de un reporte encolado, incluyendo la compresión de fotos antes de encolar.
- `offline-incident-sync`: hook `useOfflineIncidentSync()` y su integración con Background Sync API / fallback `online` — orquestación FIFO de la sincronización, un intento a la vez, con reintento individual por reporte y sin bloqueo entre reportes.

### Modified Capabilities
- `mobile-incident-report`: el requirement de envío ante fallo de red cambia de "mostrar error sin encolar" (Fase 1) a "encolar localmente y confirmar guardado, sin que se sienta como un error"; se agrega el indicador de estado de cola (badge + botón "Reintentar") a la UI del formulario mobile.
- `pwa-shell`: el Service Worker gana el registro de un evento `sync` (tag `sync-incidents`) además de su configuración existente de Fase 1; se mantiene sin cambios el invariante de no interceptar `/api/**`.

## Impact

- **Nuevos archivos:** `src/lib/offlineQueue.ts`, `src/features/incidents/hooks/useOfflineIncidentSync.ts` (o ruta equivalente), componente de indicador de cola (badge + botón reintentar) dentro de `features/incidents/components/mobile/` o similar.
- **Dependencias nuevas:** `idb`, `browser-image-compression`.
- **Archivos modificados:** `IncidentQuickReportPage.tsx` (flujo offline/error de red), Service Worker generado por `vite-plugin-pwa` (`vite.config.ts`, registro de `sync` event), `es-PE.json`/`en-US.json` (namespace `incidents.mobile.offline`).
- **Sin cambios de contrato de API:** `POST /api/incidents` y `useCreateIncident` se reutilizan tal cual; el `empresaId` se congela al momento de crear el reporte offline, no se re-lee de la sesión al sincronizar.
- **Fuera de alcance de esta fase:** edición de un reporte ya encolado, cancelar un reporte en cola, resolución de conflictos (no aplica — folio server-side), soporte multi-pestaña avanzado más allá de `BroadcastChannel`/storage events, comportamiento definitivo ante cuota de IndexedDB agotada (Fase 3 — hardening).
