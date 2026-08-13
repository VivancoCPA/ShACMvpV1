## Why

`m7-f2-offline-sync` implementó la cola offline y su sincronización FIFO, pero cualquier fallo de sync (corte de red a mitad de subida, timeout, 4xx/5xx real del backend) degrada la entrada a `status: 'error'` en el primer intento, sin distinguir causa ni reintentar automáticamente — un supervisor de campo con señal intermitente ve reportes "en error" que en realidad solo necesitaban una reconexión, y tiene que tocar "Reintentar" a mano por cada corte de señal. Además, las entradas `synced` nunca se eliminan de IndexedDB (se acumulan indefinidamente, incluyendo los blobs de fotos ya sincronizados), y no hay ninguna decisión registrada sobre qué pasa cuando el dispositivo de campo se comparte entre turnos/usuarios con acceso a distintas empresas mientras hay reportes sin sincronizar. Esta fase cierra esos tres huecos de robustez ("hardening") dejados abiertos deliberadamente en Fase 2.

## What Changes

- Clasificar el fallo de sincronización de una entrada en `syncing` en dos categorías: **red** (timeout del `axios` existente, `ERR_NETWORK`, sin `error.response`) y **backend** (`error.response` presente — 4xx de validación/permisos, 5xx). Reutiliza el mismo criterio que `classifySubmitError` (`features/incidents/utils/classifySubmitError.ts`, ya usado en el submit inicial) en vez de duplicar lógica de clasificación.
- Un fallo de **red** vuelve la entrada a `pending` (no a `error`) y cuenta un intento en un contador nuevo (`retryCount`) persistido en la entrada; se reintenta automáticamente en el siguiente ciclo de sync (`online`/mensaje `sync` del SW/apertura de la vista), sin acción del usuario. Al superar 3 intentos consecutivos fallidos por causa de red, la entrada pasa a `error` con un mensaje que invita a reintento manual (evita loop infinito con señal "flapping").
- Un fallo de **backend** pasa a `error` inmediatamente en el primer intento (sin contar contra `retryCount`), igual que hoy — un 403 (usuario sin acceso a la empresa congelada, ver D8 de `m7-f2-offline-sync`) o un 4xx de validación no se arregla solo con reintentar.
- Al confirmarse `status: 'synced'`, la entrada se elimina de IndexedDB (incluyendo sus `photoBlobs`) en vez de conservarse indefinidamente — hoy ninguna entrada `synced` se purga nunca, lo que hace crecer sin límite el uso de cuota en dispositivos de campo con turnos largos sin señal. No se agrega un mecanismo separado de purga por antigüedad; basta con no retener lo que ya no tiene ningún propósito una vez sincronizado, dado que la UI (`listVisible()`) ya las excluye de la vista.
- `QuotaExceededError` al encolar un reporte nuevo (`OfflineQueueError` en `lib/offlineQueue.ts`) ya muestra un mensaje claro en vez de fallar en silencio (implementado en Fase 2) — sin cambios funcionales aquí, se documenta como resuelto para no reabrirlo.
- Documentar explícitamente (spec + comentario técnico) que la cola offline es de dispositivo, no de usuario/sesión: no existe scoping por `userId`, por lo que cualquier usuario logueado en ese dispositivo ve y puede reintentar reportes encolados por otro usuario/turno anterior, incluso de otra empresa. El `empresaId` congelado (D8, Fase 2) y la validación de membresía server-side (403) siguen siendo la única salvaguarda: un usuario sin acceso a la empresa congelada no puede lograr que un reintento tenga éxito, y ese 403 se trata como fallo de backend (no reintenta solo). Se acepta como comportamiento intencional de un dispositivo de campo compartido, no como bug — no se agrega scoping por usuario en esta fase.

## Capabilities

### New Capabilities

(ninguna — esta fase modifica el comportamiento de robustez de capacidades ya introducidas por `m7-f2-offline-sync`, sin agregar superficie nueva de UI ni endpoints)

### Modified Capabilities

- `offline-incident-queue`: el esquema de `QueuedIncident` gana `retryCount`; `markError`/`markSyncing`/`retry` distinguen la causa del fallo; una entrada `synced` se elimina del store en vez de conservarse indefinidamente.
- `offline-incident-sync`: el ciclo FIFO (`syncOne`/`runSyncCycle`) clasifica el error de cada intento fallido (red vs backend) y decide `pending` (reintento automático) vs `error` (requiere acción manual) en función de esa clasificación y de `retryCount`, en vez de ir a `error` en el primer fallo sin importar la causa.

## Impact

- **Archivos modificados:** `src/lib/offlineQueue.ts` (esquema `QueuedIncident` + `retryCount`, purga en `markSynced`), `src/features/incidents/hooks/useOfflineIncidentSync.ts` (clasificación de error en `syncOne`, decisión `pending` vs `error`), posible bump de `DB_VERSION` en `offlineQueue.ts` si el cambio de esquema requiere migración de IndexedDB.
- **Sin cambios de UI nueva:** `SyncQueueBadge`/`SyncQueuePanel` (`m7-f2-indicador-offline`) siguen funcionando igual — un ítem que vuelve a `pending` automáticamente ya se refleja hoy en el badge (ámbar, sin error) sin cambios en esos componentes; el panel ya muestra `errorMessage` cuando `status === 'error'`, solo cambia cuándo se llega a ese estado.
- **Sin cambios de contrato de API:** `POST /api/incidents` (con `empresaId` opcional, D8 de Fase 2) se reutiliza sin modificar el handler MSW.
- **Fuera de alcance de esta fase:** sincronización con la app completamente cerrada (Background Sync real sin cliente abierto, sigue pendiente de verificación en dispositivo real desde Fase 2), scoping de la cola por usuario/sesión, purga de entradas `pending`/`error` muy antiguas (solo se purgan las ya `synced`), backend .NET real.
