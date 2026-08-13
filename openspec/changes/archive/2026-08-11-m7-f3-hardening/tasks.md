## 1. Esquema de cola (`offlineQueue.ts`)

- [x] 1.1 Agregar `retryCount?: number` a la interfaz `QueuedIncident` (`lib/offlineQueue.ts`). No requiere bump de `DB_VERSION` (design.md D2/Migration Plan).
- [x] 1.2 Poner `retryCount: 0` al construir la entrada en `enqueue()`.
- [x] 1.3 Cambiar `markSynced(localId)` de `patch(localId, { status: 'synced' })` a `db.delete(STORE_NAME, localId)` (design.md D2).
- [x] 1.4 Implementar `markRetryPending(localId)`: `patch(localId, { status: 'pending', retryCount: (existing.retryCount ?? 0) + 1, lastAttemptAt: <ahora> })`, sin tocar `errorMessage`.
- [x] 1.5 Actualizar `retry(localId)` (reintento manual) para además resetear `retryCount` a 0 junto con limpiar `errorMessage`.
- [x] 1.6 Actualizar cualquier lectura de `entry.retryCount` en el resto del código para usar `entry.retryCount ?? 0` (compatibilidad con entradas encoladas antes de este cambio). (Aplicado en `useOfflineIncidentSync.ts`, grupo 3.)

## 2. Tests de `offlineQueue.ts`

- [x] 2.1 Test: `enqueue()` inicializa `retryCount: 0`.
- [x] 2.2 Test: `markSynced()` elimina la entrada del store (`getById()` retorna `undefined` después).
- [x] 2.3 Test: `markRetryPending()` incrementa `retryCount`, vuelve a `status: 'pending'`, no toca `errorMessage`.
- [x] 2.4 Test: `retry()` manual resetea `retryCount` a 0 además de limpiar `errorMessage` y volver a `'pending'`.
- [x] 2.5 Test: una entrada sin `retryCount` (simulando dato de una versión anterior del esquema) se trata como `0` sin lanzar error. 14/14 tests pasan en `offlineQueue.test.ts`.

## 3. Clasificación de errores en el ciclo de sync (`useOfflineIncidentSync.ts`)

- [x] 3.1 Importar `classifySubmitError` (`features/incidents/utils/classifySubmitError.ts`) en `useOfflineIncidentSync.ts`, reemplazando el `catch` genérico de `syncOne()`.
- [x] 3.2 Clasificación `'network'` con `entry.retryCount < 3`: invocar `markRetryPending(entry.localId)` y NO mostrar `toast.error`.
- [x] 3.3 Clasificación `'network'` con `entry.retryCount >= 3`: invocar `markError(entry.localId, <mensaje "reintentos agotados">)` y mostrar `toast.error`.
- [x] 3.4 Clasificación `'invalid-envelope'` o `'server'`: invocar `markError(entry.localId, <mensaje existente>)` de inmediato (sin tocar `retryCount`) y mostrar `toast.error`, igual que el comportamiento actual.
- [x] 3.5 Agregar las claves i18n nuevas del mensaje de "reintentos agotados" bajo `incidents:mobile.offline.*` en `es-PE.json` y `en-US.json` (reusar el prefijo ya establecido por Fase 2, CLAUDE.md regla 4). Clave `retriesExhaustedError` agregada en ambos locales.
- [x] 3.6 Revisar que `runSyncCycle()` siga tratando una entrada devuelta a `'pending'` por `markRetryPending` igual que cualquier otra `pending` en el siguiente ciclo (evento `online`, mensaje `sync` del SW, o al montar `MobileShell`) — no debería requerir cambios en `runSyncCycle()` en sí, solo verificar que el `Set` de `attempted` por ciclo (design.md Context) no bloquee el reintento en un ciclo *futuro*. Verificado por lectura: `attempted` se recrea vacío en cada invocación de `runSyncCycle()`, sin cambios necesarios.

## 4. Tests de `useOfflineIncidentSync.ts`

- [x] 4.1 Test: fallo de red con `retryCount < 3` → entrada vuelve a `'pending'`, `retryCount` incrementado, sin `toast.error`.
- [x] 4.2 Test: fallo de red con `retryCount === 3` → entrada pasa a `'error'`, con `toast.error`.
- [x] 4.3 Test: fallo de servidor (4xx) → entrada pasa a `'error'` inmediatamente en el primer intento, `retryCount` sin incrementar.
- [x] 4.4 Test: fallo `ERR_INVALID_RESPONSE_ENVELOPE` → entrada pasa a `'error'` inmediatamente, mismo criterio que servidor.
- [x] 4.5 Test: un fallo de red que vuelve a `'pending'` no bloquea la sincronización del siguiente reporte en el mismo ciclo FIFO.
- [x] 4.6 Test: sincronización exitosa → la entrada deja de existir en el store tras el ciclo (ya no se puede leer con `getById`). 27/27 tests pasan entre `offlineQueue.test.ts` y `useOfflineIncidentSync.test.ts`.

## 5. Verificación manual (equivalente a criterios del handoff de Fase 2/3)

- [x] 5.1 Build de producción (`npx vite build` + `npx serve -s`, mismo protocolo de Fases 1/2 — nunca `npm run dev` ni `vite preview`). Build exitoso, `dist/sw.js` generado en modo `injectManifest`.
- [x] 5.2 Encolar un reporte, forzar 1-2 fallos de red consecutivos (p. ej. interceptando `XMLHttpRequest`/`fetch` para rechazar con `ERR_NETWORK`) por debajo del límite: confirmar que el badge se mantiene ámbar (no rojo) y no aparece ningún `toast` de error mientras reintenta solo. **Verificado (2026-08-04)** en `npx serve -s dist` con `XMLHttpRequest.prototype.send` parcheado (mismo patrón que Fase 2): tras 1 y 2 fallos de red consecutivos, la entrada en IndexedDB confirma `status: 'pending'`, `retryCount` incrementado, sin `errorMessage`; badge se mantiene ámbar, sin toast.
- [x] 5.3 Forzar 3 fallos de red consecutivos: confirmar que la entrada pasa a `'error'` (badge rojo) recién en el cuarto intento fallido, con el mensaje de "reintentos agotados". **Verificado (2026-08-04):** `retryCount` llega a 3 manteniéndose `pending`; el 4º fallo consecutivo recién marca `status: 'error'` con `errorMessage` = clave `retriesExhaustedError`, badge pasa a rojo y se muestra el toast.
- [x] 5.4 Forzar un fallo de servidor (4xx) simulado: confirmar que la entrada pasa a `'error'` en el primer intento, sin esperar 3 fallos. **Verificado (2026-08-04)** con XHR parcheado para responder 422: la entrada pasó a `status: 'error'` en el primer intento, `retryCount` se mantuvo en 0, mensaje genérico (`syncErrorToast`), no el de reintentos agotados — confirma que la clasificación distingue red vs. servidor.
- [x] 5.5 Confirmar en el panel (`SyncQueuePanel`) que reintentar manualmente una entrada en `'error'` por reintentos agotados vuelve a intentar automáticamente hasta 3 veces más antes de volver a degradar (contador reiniciado). **Verificado (2026-08-04):** click en "Reintentar" del panel → `retry()` resetea `retryCount` a 0 y dispara sync inmediato; con la falla de red aún activa, el intento fallido resultante volvió a `retryCount: 1` (no saltó directo a error), confirmando el contador reiniciado.
- [x] 5.6 Confirmar en DevTools → Application → IndexedDB que una entrada sincronizada exitosamente desaparece de `incident-queue` (no queda con `status: 'synced'`). **Verificado (2026-08-04)** dos veces (incluida una sesión nueva tras reload/login): al desactivar la falla simulada y dejar que MSW respondiera real, las entradas se sincronizaron y desaparecieron por completo de `incident-queue` — folios reales confirmados vía `GET /api/incidents` (`INC-2026-022`, `INC-2026-023`), sin duplicados. Solo quedaron entradas `status: 'synced'` preexistentes de antes de esta fase (creadas por el código viejo), consistente con que el cambio no purga retroactivamente entradas ya `synced`.
- [x] 5.7 Verificar Light Mode y Dark Mode de cualquier mensaje/toast nuevo introducido en esta fase. **Verificado (2026-08-04)** en ambos temas (`useUIStore.setTheme`): badge ámbar/rojo, toast de "reintentos agotados" y panel con el mensaje nuevo se ven correctamente con buen contraste en light y dark, sin defectos visuales.
