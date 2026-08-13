## Context

`m7-f2-offline-sync` dejó implementados y verificados:
- `src/lib/offlineQueue.ts`: acceso a IndexedDB (`incident-queue`), con `enqueue`, `listPending` (filtra a `pending`/`error`, ordena por `by-createdAt`), `markSyncing`, `markSynced`, `markError`, `retry(localId)`.
- `src/features/incidents/hooks/useOfflineIncidentSync.ts`: hook que hidrata `pendingCount`/`hasErrors`/`syncingId` con `useState` local, corre el ciclo FIFO (`runSyncCycle`) disparado por el listener `online` y por el mensaje `SYNC_MESSAGE_TYPE` que `src/sw.ts` reenvía tras el evento `sync` de Background Sync, y expone `retry(localId)`, `retryAll()` y `notifyEnqueued()` (llamado por el form tras encolar).
- `src/features/incidents/components/OfflineQueueIndicator.tsx`: banner inline con el contador y un botón "Reintentar todos", montado solo dentro de `IncidentQuickReportForm.tsx` (única vista bajo `MobileShell` hoy).
- `MobileShell.tsx` no tiene header — es un contenedor de una columna con `<Outlet />` directo.
- El patrón de badge + panel popover ya existe en escritorio: `NotificationBell.tsx` (badge con contador, `useState<boolean>` `open`, panel absoluto anclado bajo el botón, sin librería de overlay).

El pendiente 1 del handoff pide un indicador global (visible desde cualquier vista mobile, no solo el form) con detalle por reporte y reintento individual. El estado que hoy existe (`useOfflineIncidentSync`) está atado al árbol de componentes del formulario y no es accesible desde `MobileShell`, que es un ancestro fuera de ese árbol en el router (`MobileShell` es hermano de `AppShell`, y el form es hijo de `MobileShell`, pero el hook solo se invoca dentro del form).

## Goals / Non-Goals

**Goals:**
- Estado de cola offline accesible desde `MobileShell` (badge de header) y desde el panel, sin duplicar la lógica de refresco que ya existe en `useOfflineIncidentSync`.
- Panel con detalle por reporte (fecha, estado, error) y reintento individual, reusando `retry(localId)` ya existente en `offlineQueue.ts`.
- Reusar el patrón popover de `NotificationBell` para el panel — cero dependencias nuevas.

**Non-Goals:**
- Cambiar el esquema de IndexedDB, el ciclo FIFO de sincronización o el mensaje `postMessage` del Service Worker — Fase 2 ya los implementó y verificó; este cambio es puramente de UI/estado compartido sobre lo existente.
- Purga de registros `synced`, notificación Sonner al completar sync en background, manejo de cuota agotada de IndexedDB — fuera de alcance (ver proposal.md, "Fuera de alcance" del handoff original).
- Listar reportes `synced` en el panel — se filtran igual que hoy filtra `listPending()`.

## Decisions

### D1: Mover el estado de `useState` local a un store de Zustand feature-local
`pendingCount`/`hasErrors`/`syncingId` pasan de `useState` dentro de `useOfflineIncidentSync` a un store Zustand nuevo, `src/features/incidents/stores/offlineQueueStore.ts`. Es el primer store feature-local del repo (los tres existentes — `authStore`, `uiStore`, `preferencesStore` — son cross-cutting en `src/stores/`); se justifica porque este estado es específico del dominio de incidentes (tipado sobre `QueuedIncident`) y no tiene ningún consumidor fuera de `features/incidents` — mismo criterio de scoping que ya aplica el repo a hooks y componentes por feature. `MobileShell` importa el badge de `features/incidents/components/`, no el store directamente, siguiendo el precedente ya establecido por `TopNav.tsx` (importa `NotificationBell` de `features/notifications/components/`) y `Sidebar.tsx` (importa un hook de `features/documents/hooks/`) — layout ya importa de features en este repo, no hace falta invertir esa dependencia.

Alternativa descartada: lift state up pasando el resultado de `useOfflineIncidentSync()` por props/contexto desde una ruta padre común. Se descarta porque `MobileShell` y el form están en ramas separadas del router (`MobileShell` envuelve al form vía `<Outlet />`, pero no hay wrapper intermedio natural para inyectar el hook sin volver a montarlo dos veces con estado desincronizado) — Zustand ya es el mecanismo estándar del proyecto para este caso exacto (CLAUDE.md: "Estado global → Zustand").

### D2: `useOfflineIncidentSync` conserva la orquestación, solo cambia dónde escribe el estado
El ciclo FIFO (`runSyncCycle`), los listeners de `online`/mensaje `sync`, y las funciones `retry`/`retryAll`/`notifyEnqueued` se quedan en el hook tal cual — solo dejan de usar `useState` y pasan a leer/escribir en `offlineQueueStore`. El hook se sigue invocando una sola vez, ahora desde `MobileShell` (o desde un componente montado ahí) en vez de desde el form — así los listeners viven mientras el usuario está en cualquier vista bajo `/m/*`, no solo en el form. `IncidentQuickReportForm` deja de invocar `useOfflineIncidentSync()` directamente y en su lugar lee del store (`useOfflineQueueStore()`) solo lo que necesita para `notifyEnqueued()` tras encolar.

No se extrae `runSyncCycle` a una función standalone fuera del hook: ya es reusable donde hace falta (el propio hook la invoca desde los 3 puntos de disparo automáticos, y `retry`/`retryAll` la invocan para el disparo manual) — extraerla más allá de eso sería una abstracción sin consumidor adicional.

### D3: El store expone `items` (no solo conteos) para alimentar el panel
Además de `pendingCount`/`hasErrors` (ya usados por el badge), el store expone `items: QueuedIncident[]` — el resultado de `listPending()` (ya filtra a `pending`/`error`; se añade `syncing` al filtro para que un reporte en vuelo también aparezca en el panel, ver spec `offline-queue-store`) ordenado por `createdAt` ascendente. `refresh()` se sigue disparando desde los mismos 4 puntos que hoy dispara `refreshQueueState()`: mount del hook, listener `online`, mensaje `sync` del SW, y post-`retry`/`retryAll` — sin agregar un quinto punto ni un observer genérico de IndexedDB (volumen esperado: decenas de reportes por turno sin señal, no justifica paginar).

### D4: Header nuevo en `MobileShell`, badge ahí, banner inline retirado
`MobileShell.tsx` gana un `<header>` simple (borde inferior, `sticky top-0`, mismo `max-w-md`) que monta `SyncQueueBadge`. El banner `OfflineQueueIndicator` se retira de `IncidentQuickReportForm.tsx` y el archivo `OfflineQueueIndicator.tsx` (+ su test) se elimina — sin consumidor, y mostrar el mismo contador dos veces (header + inline) en la única vista mobile existente sería ruido, no redundancia útil.

### D5: Panel reusa el patrón popover de `NotificationBell`, no introduce un componente de overlay nuevo
`SyncQueuePanel` sigue el mismo patrón que `NotificationBell.tsx`: `useState<boolean>` local en `SyncQueueBadge` para `open`, panel `absolute` anclado bajo el botón, cierre al click afuera si `NotificationBell` ya resuelve ese caso (verificar al implementar; si `NotificationBell` no cierra al click-outside hoy, el panel nuevo tampoco lo hace — no se introduce esa mejora fuera de alcance). No se evalúan alternativas tipo bottom-sheet: el layout mobile ya es `max-w-md` de una columna, el popover cabe sin necesitar un patrón de overlay distinto al que ya usa el resto del sistema.

### D6: Namespace i18n existente, no uno nuevo
Las claves nuevas van bajo `incidents:mobile.offline.*` (namespace y prefijo que Fase 2 ya estableció en `es-PE.json`/`en-US.json`), reusando `pendingBadge`/`pendingBadge_other`/`retry`/`syncing` para el badge (mismo texto que ya usaba el banner retirado) y agregando claves nuevas solo para lo que el panel introduce: título, estado vacío, label de fecha, labels por `status` (`pending`/`syncing`/`error`), y el mensaje de error por item (reusa `errorMessage` ya persistido, no una clave i18n nueva por instancia).

## Risks / Trade-offs

- **[Riesgo] Doble instancia del hook si algo más además de `MobileShell` invoca `useOfflineIncidentSync()`** → Mitigación: tras este cambio, el hook se invoca una sola vez (desde `MobileShell` o un componente montado ahí); el form deja de invocarlo. Verificar en `tasks.md` que no quede una segunda invocación.
- **[Riesgo] `items` en el store crece sin límite si un dispositivo acumula muchos reportes en error sin reintentar** → Mitigación: fuera de alcance de este cambio (ver "Fuera de alcance" de la propuesta original — purga de `synced` y manejo de cuota quedan para Fase 3 hardening); el volumen de campo esperado es bajo.
- **[Trade-off] Panel sin virtualización** → aceptable: mismo criterio de volumen que D3, no decenas de miles de items como las listas de escritorio que sí exigen paginación por CLAUDE.md regla 9.
