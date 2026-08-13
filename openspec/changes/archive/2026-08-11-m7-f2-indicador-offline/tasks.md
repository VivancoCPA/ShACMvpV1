## 1. Store de estado de cola offline

- [x] 1.1 Crear `src/features/incidents/stores/offlineQueueStore.ts` (Zustand) con `items: QueuedIncident[]`, `pendingCount`, `syncingId`, `hasErrors`, `refresh()` y `retry(localId)` (design.md D1, D3; spec `offline-queue-store`).
- [x] 1.2 En `offlineQueue.ts`, ajustar (o agregar) la consulta que alimenta `refresh()` para incluir `status: 'syncing'` además de `'pending'`/`'error'`, ordenada por `by-createdAt` — `listPending()` hoy solo filtra a `pending`/`error` (design.md D3). Implementado como función nueva `listVisible()`, sin tocar el contrato de `listPending()` (lo sigue consumiendo el ciclo FIFO, que no debe incluir `syncing`).
- [x] 1.3 Escribir tests unitarios del store: cola vacía, con pendientes, con error, `retry(localId)` delega en `offlineQueue.retry` y refresca.

## 2. Migrar `useOfflineIncidentSync` al store

- [x] 2.1 Reemplazar los `useState` de `pendingCount`/`hasErrors`/`syncingId` en `useOfflineIncidentSync.ts` por lecturas/escrituras sobre `offlineQueueStore` (design.md D2) — conservar `runSyncCycle` y los listeners `online`/mensaje `sync` sin cambios de lógica. Desviación respecto al enunciado original: `retryAll` se eliminó (su único consumidor, el banner inline, se retira en la tarea 5) y `notifyEnqueued` se movió fuera del hook — ver 2.3.
- [x] 2.2 Mover la invocación de `useOfflineIncidentSync()` de `IncidentQuickReportForm.tsx` a `MobileShell.tsx`, de forma que los listeners vivan mientras el usuario está en cualquier vista bajo `/m/*`, no solo en el form.
- [x] 2.3 Actualizar `IncidentQuickReportForm.tsx` para no volver a invocar `useOfflineIncidentSync()` (evita una segunda instancia de sus listeners). Desviación respecto al enunciado original: en vez de pasar `notifyEnqueued` por `Outlet` context de React Router (rompía los tests existentes del form, que lo renderizan sin `Router`), el hook registra su `runSyncCycle` como `syncTrigger` del store al montar/desmontar, y el form llama a la función standalone `notifyIncidentEnqueued()` (`offlineQueueStore.ts`), que refresca el store y dispara ese trigger si `navigator.onLine`.
- [x] 2.4 Actualizar `useOfflineIncidentSync.test.ts`: nuevo mount point, test de que no queda una segunda instancia corriendo en paralelo, test de registro/limpieza de `syncTrigger`, test de `notifyIncidentEnqueued()`.

## 3. Header de `MobileShell` y `SyncQueueBadge`

- [x] 3.1 Agregar un `<header>` a `MobileShell.tsx` (sticky, mismo `max-w-md` que el `<main>`) como slot para el badge.
- [x] 3.2 Crear `SyncQueueBadge` en `src/features/incidents/components/` — oculto si `items.length === 0` (equivalente a `pendingCount + (syncingId !== null ? 1 : 0) === 0` sin `hasErrors`, ver spec); ámbar si hay pendientes/sincronizando sin error; rojo si `hasErrors === true` (spec `offline-queue-indicator`).
- [x] 3.3 Montar `SyncQueueBadge` en el header de `MobileShell.tsx`.
- [x] 3.4 Test: badge oculto en cola vacía, ámbar con pendientes, rojo con error, abre el panel y reintenta un item específico.

## 4. `SyncQueuePanel`

- [x] 4.1 Crear `SyncQueuePanel` en `src/features/incidents/components/`, reusando el patrón popover de `NotificationBell.tsx` (design.md D5).
- [x] 4.2 Listar en el panel las entradas de `items` (store) en orden FIFO, mostrando fecha (`formatDateTime`, `Intl.DateTimeFormat` con locale actual — CLAUDE.md regla 5), estado y `errorMessage` cuando `status === 'error'`.
- [x] 4.3 Agregar estado vacío cuando `items` esté vacío.
- [x] 4.4 Agregar botón "Reintentar" solo en entradas `status === 'error'`, que invoca `onRetry(localId)` (prop desde `SyncQueueBadge`, que a su vez viene de `useOfflineIncidentSync().retry` en `MobileShell`).
- [x] 4.5 Test: orden FIFO con 2-3 reportes en estados distintos, estado vacío, botón "Reintentar" solo visible en `error` e invocado con el `localId` correcto.

## 5. Retirar el banner inline

- [x] 5.1 Quitar el uso de `OfflineQueueIndicator` de `IncidentQuickReportForm.tsx` (las 3 apariciones de `queueIndicator` en los tres `return` del componente).
- [x] 5.2 Eliminar `OfflineQueueIndicator.tsx` y `OfflineQueueIndicator.test.tsx` (sin consumidor tras 5.1).

## 6. i18n

- [x] 6.1 Agregar bajo `incidents:mobile.offline.*` en `es-PE.json` y `en-US.json` las claves nuevas del panel: `panel.title`, `panel.empty`, `panel.status.{pending,syncing,error}` — reusando `pendingBadge`/`pendingBadge_other`/`retry`/`syncing` ya existentes para el badge (design.md D6).
- [x] 6.2 Agregar `badgeAriaLabel` (botón sin texto — CLAUDE.md regla 10).

## 7. Verificación (criterios del handoff)

Cubierto por tests automatizados equivalentes (unit/integration, vitest + Testing Library) en `offlineQueueStore.test.ts`, `useOfflineIncidentSync.test.ts`, `SyncQueueBadge.test.tsx` y `SyncQueuePanel.test.tsx`. **Verificación manual en navegador real completada (2026-08-05)** — ver detalle por tarea abajo.

Bloqueador encontrado y resuelto antes de poder ejecutar esta verificación: una navegación dura a `/m/incidentes/nuevo` (la única forma de llegar a esta ruta — no tiene link dentro de la SPA) quedaba controlada por `sw.js` en vez de `mockServiceWorker.js` (colisión de scope de Service Workers documentada y confirmada en `m7-f1-pwa-formulario-mobile/design.md` D3, nunca mitigada hasta ahora), por lo que ningún `/api/**` se interceptaba y la sesión ni siquiera lograba restaurarse. Se implementó la mitigación pendiente de D3 (`sw.js` no se registra mientras `VITE_ENABLE_MSW=true`; ver `vite.config.ts` e `src/main.tsx`) antes de continuar — sin este fix, 7.1-7.6 no eran verificables vía navegación dura, solo vía el workaround de navegación SPA client-side ya usado en `m7-f1-pwa-formulario-mobile/tasks.md` 5.3.

- [x] 7.1 Encolar un incidente offline → badge aparece con contador en 1, color ámbar. **Verificado (2026-08-05)** en `npx serve -s dist` (`VITE_ENABLE_MSW=true`, navegación dura a `/m/incidentes/nuevo`, `navigator.onLine` forzado a `false`): tras enviar el formulario, badge "1 pendiente" ámbar visible en el header, panel muestra la entrada con estado "Pendiente".
- [x] 7.2 Reconectar → badge desaparece automáticamente al sincronizar sin recargar la página. **Verificado (2026-08-05):** al restaurar `navigator.onLine`/disparar evento `online`, el badge desapareció sin reload; incidente confirmado en `GET /api/incidents` con folio real (`INC-2026-021`) y la entrada correspondiente ya no existe en IndexedDB (`incident-queue`, purga tras sync — D2 de `m7-f3-hardening`).
- [x] 7.3 Forzar un error de servidor (mock) → badge pasa a rojo, item visible en el panel con botón "Reintentar". **Verificado (2026-08-05)** interceptando `XMLHttpRequest` para responder 422 a `POST /api/incidents`: badge pasó a rojo, panel mostró "Error — No se pudo sincronizar un reporte pendiente" con botón "Reintentar".
- [x] 7.4 Click en "Reintentar" → item pasa a `pending` → `syncing` → desaparece del panel (sincronizado), sin quedar duplicado. **Verificado (2026-08-05)** tras restaurar el XHR real y click en "Reintentar": badge desapareció, folio real asignado (`INC-2026-022`), IndexedDB vacía, sin duplicados en `GET /api/incidents`.
- [x] 7.5 Encolar 2-3 reportes → aparecen en el panel en orden FIFO (`by-createdAt`), cada uno con su propio estado independiente. **Verificado (2026-08-05)** encolando 3 reportes offline consecutivos: panel los listó en orden cronológico ascendente (1:45, 1:46, 1:46 p.m.), cada uno "Pendiente" de forma independiente; confirmado también contra los `createdAt` reales en IndexedDB. Tras sincronizar los 3, folios asignados en el mismo orden (`INC-2026-023/024/025`), sin duplicados.
- [x] 7.6 Verificar Light/Dark mode del badge y el panel. **Verificado (2026-08-05)** alternando la clase `dark` en `<html>`: badge y panel se ven correctamente con buen contraste en ambos temas, tanto en el estado ámbar (pendiente) como en el rojo (error) con el botón "Reintentar" visible.
