## Context

`m7-f1-pwa-formulario-mobile` ya está implementado en el repo (`shc-controldoc/src/features/incidents/pages/IncidentQuickReportPage.tsx`, `components/IncidentQuickReportForm.tsx`, `hooks/useGeolocationCapture.ts`, `schemas/mobileIncidentReport.schema.ts`) y verificado funcionalmente salvo los ítems de `tasks.md` que exigen dispositivo físico/DevTools reales (esos siguen pendientes de checklist, no bloquean esta fase). Puntos confirmados leyendo el código actual, relevantes para el diseño de Fase 2:

- `IncidentQuickReportForm.onSubmit` llama `createMutation.mutateAsync(payload)` sin `try/catch` propio. `createMutation` viene de `useCreateIncident()` (`hooks/useIncidents.ts:44-58`), cuyo `onError` de nivel de hook siempre dispara `toast.error(t('toasts.createError'))` — este hook es **compartido** con `IncidentNewPage` (escritorio). En TanStack Query v5, un `onError` pasado a `mutateAsync(vars, { onError })` se ejecuta *además de* (no en lugar de) el `onError` del hook — no hay forma de silenciar el toast del hook desde el call-site sin tocar el hook. Esto choca con el requirement de Fase 1 (`mobile-incident-report`, "Envío falla sin conexión") que ya asumía mostrar el toast, pero **no** con el nuevo comportamiento que pide esta fase (encolar sin que se sienta como error) — ver Decisión D6.
- `lib/axios.ts` documenta un bug real ya enfrentado en Fase 1 (comentario en `interceptors.response`, líneas 43-49): si el SW de la PWA termina controlando la página en vez del SW de MSW, un `fetch` a `/api/**` no es interceptado y cae al fallback SPA (`index.html`, HTTP 200). El interceptor detecta que el body no tiene forma `ApiResponse<T>` y lo convierte en un `AxiosError` sintético con `code: 'ERR_INVALID_RESPONSE_ENVELOPE'`. Esto es distinto de un error de red real (`error.code === 'ERR_NETWORK'` / sin `error.response`) — ver Decisión D6.
- `empresaId` **nunca** viaja en el body de `POST /api/incidents` hoy: el handler (`mocks/handlers/incidents.handlers.ts:158-209`) lo resuelve con `getActiveEmpresaId()`, que lee `useAuthStore.getState().empresaActivaId` **en el momento de procesar el request**, no en el momento en que el cliente arma el payload. El diseño original (D1 de esta fase, "empresaId se congela al crear, no se re-lee al sincronizar") asume una capacidad de override que el mock **no tiene todavía** — ver Decisión D8 / Open Questions.
- `vite.config.ts` configura `VitePWA` en modo `generateSW` (Workbox autogenerado a partir de `workbox: { globPatterns, navigateFallback, runtimeCaching: [] }`, sin `strategies: 'injectManifest'` ni archivo `src/sw.ts` propio). `generateSW` no permite añadir listeners de eventos arbitrarios (como `sync`) al Service Worker generado — ver Decisión D7.
- No existen aún `idb` ni `browser-image-compression` en `package.json` (confirmado). El scope `/m/` y la ausencia de `runtimeCaching` para `/api/**` (D4 heredado de Fase 1) siguen vigentes y no se tocan en esta fase salvo por lo que exige D7.

## Goals / Non-Goals

**Goals:**
- Un reporte creado en `/m/incidentes/nuevo` sin conexión (o con el fetch fallando por red) queda guardado en IndexedDB y se sincroniza automáticamente al recuperar conexión, sin acción manual del usuario salvo reintentar un ítem en error.
- La detección de "sin conexión" distingue explícitamente entre: sin conectividad real, error de validación/negocio del servidor, y el bug ya documentado de coordinación de Service Workers (`ERR_INVALID_RESPONSE_ENVELOPE`) — solo el primer caso encola silenciosamente; los otros dos siguen mostrando error, para no enmascarar bugs reales de Fase 1 detrás de la cola offline.
- Background Sync API se usa donde el navegador lo soporte, con el listener `online` + botón "Reintentar" como fallback universal.

**Non-Goals (explícitamente diferido a Fase 3 o fuera de alcance):**
- Edición o cancelación de un reporte ya encolado.
- Resolución de conflictos (no aplica: folio server-side).
- Comportamiento definitivo ante cuota de IndexedDB agotada (solo "no crashear, mostrar error" en esta fase).
- Sincronización con la app completamente cerrada (sin ningún tab/cliente abierto) — ver Riesgo en D3/D7.
- Cambiar cómo el backend real (futuro, .NET) resolverá `empresaId` por request — esta fase solo cubre el mock.

## Decisions

### D1 — Esquema IndexedDB (vía `idb`)

Un solo object store `incident-queue`, key autoincremental local (`localId`), con campos: `payload` (el DTO que hoy recibe `useCreateIncident`/`createIncident`), `photoBlobs` (array de `Blob` comprimidos, o `[]` — el campo se llama en plural porque el formulario ya soporta múltiples fotos, `MAX_FILES = 5`), `geoUbicacion`, `empresaId` (ver D8 — capturado explícitamente al encolar), `status` (`'pending' | 'syncing' | 'synced' | 'error'`), `createdAt`, `lastAttemptAt`, `errorMessage`. No se persiste `accessToken`: la sincronización usa la sesión activa al momento de sincronizar, vía el mismo `axios` interceptor que ya maneja refresh.

**Nota de compatibilidad con el patrón actual de evidencias:** `IncidentQuickReportForm.onSubmit` hoy arma `evidencias: IncidentEvidencia[]` usando `URL.createObjectURL(file)` como `url` — un object URL que **no sobrevive a un reload de página** (se invalida). Un reporte encolado en IndexedDB puede sobrevivir un reload (o el cierre del navegador) antes de sincronizar, así que el flujo de encolado **no puede** depender de `previewUrl`/object URLs generados en el submit original: debe persistir el `Blob` real (`photoBlobs`) y, recién en el momento de sincronizar, reconstruir `IncidentEvidencia[]` (nuevo `URL.createObjectURL` sobre el blob recuperado de IndexedDB, o el equivalente que el mock espere) para armar el payload que `useCreateIncident` envía.

### D2 — Compresión de fotos antes de encolar, no al sincronizar

`browser-image-compression` corre en Web Worker en el momento de adjuntar la foto (mismo punto donde hoy `onPhotoChange` arma `PhotoPreview[]` en `IncidentQuickReportForm.tsx`), no al momento de sync. Si se comprime al sincronizar, un usuario con batería baja o que cierra la app pierde la oportunidad; comprimiendo al capturar, lo que se guarda en IndexedDB ya es lo final y liviano. La preview en pantalla (`photos` state, `PhotoPreview[]`) sigue usando `URL.createObjectURL` como hoy — solo lo que se persiste en IndexedDB al encolar usa el Blob comprimido.

### D3 — Background Sync API con fallback, no como única vía

Se registra un `sync` event (tag `sync-incidents`) en el Service Worker de la PWA donde el navegador lo soporte (Chrome/Edge Android; no iOS Safari, no Firefox). Fallback universal: listener de evento `online` en el hilo principal + botón manual "Reintentar" en la UI si hay reportes en `status: 'error'`.

**Restricción heredada de D4 (no se toca):** el handler `sync` del SW **no debe hacer `fetch('/api/incidents')` directamente desde dentro del Service Worker** — un SW no puede interceptar el `fetch` de otro SW (el de MSW), así que un fetch disparado desde el SW de la PWA iría a la red real y fallaría en el entorno mock (y, en producción real, duplicaría lógica de auth/idempotencia que hoy vive en el cliente vía `axios`). En su lugar, el handler `sync` hace `self.clients.matchAll()` y `client.postMessage({ type: 'sync-incidents' })` a cada cliente abierto; `useOfflineIncidentSync()` escucha ese mensaje en el hilo principal y dispara la sincronización real con el `axios`/`useCreateIncident` de siempre (mismo camino que el listener `online`).

**Limitación aceptada:** esto significa que Background Sync en este diseño **no logra sincronizar con la app completamente cerrada** (si `clients.matchAll()` no devuelve ningún cliente, no hay a quién avisarle) — solo cubre el caso "la pestaña sigue abierta/en background cuando vuelve la señal". Sincronizar con la app cerrada requeriría que el propio SW hiciera el POST y gestionara el token, lo cual queda fuera de alcance de esta fase (ver Non-Goals).

### D4 — El SW sigue sin interceptar `/api/**` (heredado de Fase 1, sin cambios)

Se mantiene el invariante ya decidido en Fase 1 D3/D4: el `runtimeCaching` de Workbox sigue vacío para rutas `/api/**`. La cola offline vive en IndexedDB gestionada por la app, no en el cache del SW.

### D5 — Un solo intento de sync a la vez, en orden de creación (FIFO)

Nada de paralelizar sincronizaciones: si el primer reporte en cola falla (ej. error de validación de servidor, no de red), los siguientes no se bloquean indefinidamente pero sí se procesan en orden, y cada uno pasa a `error` de forma independiente si falla. Se reintenta cada uno individualmente, no como transacción atómica.

### D6 — Clasificación del error de envío: cuándo encolar y cuándo mostrar el toast existente

Dado el hallazgo de Context (el `onError` de `useCreateIncident` es compartido con escritorio y no se puede silenciar desde el call-site), el submit inicial de `IncidentQuickReportForm` **no puede seguir usando `createMutation.mutateAsync()` a ciegas** si se quiere evitar el toast de error en el caso "sin conexión, encolar". Opciones consideradas:

1. **Elegida:** extender `useCreateIncident` con un parámetro opcional (p.ej. `useCreateIncident({ onNetworkError？ })` o, más simple, revisar `error.code` dentro del propio `onError` del hook y omitir el toast cuando el caller marcó la mutación como "candidata a cola offline" vía una bandera en `meta` de la propia llamada — TanStack Query v5 permite pasar `meta` en las opciones de `mutate`/`mutateAsync`, y `onError(error, variables, context)` puede leer `context`/`meta`). Concretamente: el formulario mobile pasa `mutateAsync(payload, { onError: (error) => { if (isQueueableError(error)) { enqueue(...); return } } })` **y además** se modifica el `onError` del hook para no duplicar el toast cuando detecta que el caller ya manejó el error como "encolable" (p.ej. usando `mutation.reset()` antes del catch, o una bandera simple `error.__handledOffline = true` seteada por el catch del call-site antes de que el hook-level `onError` corra — requiere confirmar el orden de ejecución real en pruebas, ya que TanStack Query no garantiza orden entre callbacks de distinto nivel de forma documentada).
   Alternativa más simple y robusta, **recomendada para implementación**: el submit del formulario mobile llama directamente a la función `createIncident` de `api/incidents.api.ts` (la misma que usa `useCreateIncident` como `mutationFn`) dentro de su propio `try/catch`, **sin pasar por el hook compartido**, y solo si el envío directo tiene éxito invalida la query cache manualmente (`queryClient.invalidateQueries`) y muestra su propio toast de éxito — replicando en ~5 líneas lo que el hook ya hace, pero sin heredar su `onError`. `useOfflineIncidentSync()` (el que corre en sync automático) sí puede seguir usando `useCreateIncident()` tal cual, porque en ese contexto el toast de error genérico es aceptable (no hay UI de "guardado offline" que proteger — el ítem ya está en la cola y su estado se refleja en el badge, no en un toast).
2. Modificar `useCreateIncident` globalmente para nunca tostar en error de red — descartada: rompería el comportamiento esperado en escritorio, donde no existe cola offline y el usuario necesita saber que el envío falló.

**Clasificación de errores (aplica tanto al submit directo del formulario como, de forma más laxa, a la sincronización en background):**
- `navigator.onLine === false` en el momento del submit → encolar sin intentar el request.
- La request falla con `error.code === 'ERR_NETWORK'` o sin `error.response` → error de conectividad real → encolar.
- La request falla con `error.code === 'ERR_INVALID_RESPONSE_ENVELOPE'` (ver Context, bug de coordinación de SW) → **no encolar** — mostrar el toast de error existente. Encolar aquí enmascararía una regresión real de Fase 1 (SW de la PWA ganando el control de `/m/*`) detrás de un mensaje de "guardado, se sincronizará luego" que nunca se cumpliría de forma consistente.
- La request falla con `error.response` presente (4xx/5xx real del mock, ej. validación server-side) → **no encolar** — mostrar el toast de error existente, igual que hoy.

### D7 — Cambiar `VitePWA` de `generateSW` a `injectManifest` para poder registrar el `sync` event

`vite.config.ts` usa hoy `generateSW` (Workbox autogenerado desde `workbox: {...}`), que no soporta añadir un listener `self.addEventListener('sync', ...)` personalizado. Para cumplir D3 se requiere migrar a `strategies: 'injectManifest'` con un archivo fuente propio (`src/sw.ts` o similar) donde Workbox inyecta el precache manifest (`precacheAndRoute(self.__WB_MANIFEST)`) y donde se agrega a mano el listener de `sync` (D3) y el `postMessage` a los clientes. El resto de la config actual (`scope: '/m/'`, `navigateFallback`, sin runtime-caching de `/api/**`) se traslada al nuevo `src/sw.ts` de forma equivalente. Esto es un cambio de estrategia de build de la PWA, no solo una opción adicional — se documenta explícitamente porque el resto del plan de Fase 2 (tareas 1-9 del proposal) lo asume implícito y no lo nombra.

**Alternativa descartada:** quedarse en `generateSW` y renunciar a Background Sync, dependiendo solo del listener `online` + botón manual. Descartada porque el proposal pide explícitamente Background Sync donde exista soporte (D3 original) y el costo de migrar a `injectManifest` es acotado (un archivo nuevo, mismo `workbox` config trasladado).

### D8 — `empresaId` "congelado": el mock no soporta hoy un override explícito por request

El mock resuelve `empresaId` server-side desde `useAuthStore.getState().empresaActivaId` **en el momento del request**, no desde el body. Para que un reporte encolado se sincronice con la empresa activa al momento de *crear* (no al momento de *sincronizar*, si el usuario cambió de empresa activa entretanto — escenario real dado que la app es multiempresa), el handler necesita aceptar un `empresaId` explícito opcional en el body de `POST /api/incidents` proveniente exclusivamente del flujo de sincronización offline, validando que el usuario autenticado siga teniendo acceso a esa empresa (mismo chequeo de membresía que ya existe en otros puntos de scoping multiempresa) antes de confiar en él.

Esto es una excepción al patrón vigente en todo el resto del código (ningún otro handler acepta `empresaId` del cliente) y toca un invariante de seguridad/scoping — **se documenta aquí como decisión propuesta, no como hecho consumado**; ver Open Questions. Si no se aprueba el override server-side, la alternativa aceptada es documentar el riesgo tal como ya lo hace el proposal original (edge case #2: "aceptar el riesgo" de que un reporte se sincronice bajo la empresa activa al momento de sync en vez de al momento de creación) y no tocar el handler en esta fase.

## Risks / Trade-offs

- **[Riesgo] Toast de error duplicado o ausente si D6 se implementa mal** (el `onError` de nivel de hook y el del call-site pueden competir) → Mitigación: la opción recomendada en D6 evita el hook compartido por completo en el submit inicial, en vez de intentar suprimir su `onError`.
- **[Riesgo] `ERR_INVALID_RESPONSE_ENVELOPE` mal clasificado como error de red** → Mitigación: clasificación explícita por `error.code` en D6, con test unitario que cubra ambos casos por separado.
- **[Riesgo] Background Sync no sincroniza con la app cerrada** (ver D3) → Aceptado como limitación de esta fase; el listener `online` + reintento manual sigue cubriendo el 100% de los casos al reabrir la app.
- **[Riesgo] Migración a `injectManifest` (D7) introduce una superficie nueva de configuración de Workbox** que no existía en Fase 1 → Mitigación: trasladar la config `workbox` actual 1:1 al nuevo `src/sw.ts`, y repetir la verificación de DevTools de Fase 1 (tareas 1.3/1.4 de `m7-f1`, aún pendientes) sobre el nuevo SW antes de dar la fase por cerrada.
- **[Riesgo] Override de `empresaId` client-supplied (D8) es una excepción de seguridad/scoping** → No resolver unilateralmente en `tasks.md`; requiere confirmación explícita (ver Open Questions) antes de tocar el handler.
- **[Trade-off] Cuota de IndexedDB agotada** → solo se garantiza "no crashear + `status: 'error'` con mensaje claro" en esta fase; comportamiento definitivo (limpieza automática, límite de fotos, etc.) es Fase 3.
- **[Trade-off] Testing sigue limitado a MSW en el mismo navegador/origen** (sin backend .NET real) — mismo protocolo de Fase 1: build de producción (`npx vite build` + `npx serve -s`), nunca `npm run dev` ni `vite preview`.

## Migration Plan

1. Agregar dependencias (`idb`, `browser-image-compression`) — no rompe nada existente.
2. Migrar `vite.config.ts` de `generateSW` a `injectManifest` (D7) **antes** de tocar el flujo de la cola, verificando que el shell mobile sigue instalándose y precacheando igual que en Fase 1 (regresión, no feature nueva).
3. Implementar `lib/offlineQueue.ts` (D1) de forma aislada, sin conectarla aún al formulario — permite tests unitarios del wrapper IndexedDB sin depender de UI.
4. Conectar la compresión de fotos (D2) al punto de captura existente.
5. Reescribir el submit de `IncidentQuickReportForm` (D6) para no depender del `onError` compartido del hook.
6. Implementar `useOfflineIncidentSync` (D3/D5) y el listener `online` + `postMessage` del SW.
7. Agregar el indicador de cola (badge + reintentar) a la UI.
8. Resolver D8 según la decisión humana (ver Open Questions) antes de considerar cerrado el criterio "ningún reporte se duplica ni se asigna a la empresa equivocada".

No hay estrategia de rollback más allá de revertir el commit/PR — no hay datos de producción en juego (mock-only, sin backend real todavía).

## Open Questions

- ~~**D8 requiere decisión humana explícita**~~ **Resuelto (2026-08-03):** se aprueba el override server-side. `POST /api/incidents` acepta `empresaId` opcional del cliente exclusivamente para el flujo de sincronización offline, validado contra membresía activa antes de confiar en el valor. Implementado en tasks.md 8.1/8.2.
- ¿La opción elegida en D6 (submit directo sin pasar por `useCreateIncident`) debe replicar también la invalidación de queries de `IncidentListPage`/dashboard, o basta con que `useOfflineIncidentSync` (que sí usa el hook compartido) dispare esa invalidación cuando el ítem finalmente sincroniza? Se asume esto último (el submit directo exitoso sin cola ya no pasa por esta pregunta — solo aplica al ítem que fue encolado y luego sincronizado).
- Confirmar en implementación si Safari iOS (sin Background Sync API) requiere algún ajuste adicional en el listener `online` dado el comportamiento conocido de throttling de eventos en background de iOS — no verificable sin dispositivo real, mismo tipo de limitación que las tareas 5.1/5.2 pendientes de Fase 1.
