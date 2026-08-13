## Context

`shc-controldoc` es una SPA React 19 + Vite servida sin backend real: MSW v2 (`mocks/browser.ts`) registra un Service Worker (`public/mockServiceWorker.js`) que intercepta todo `fetch`/XHR de la app cuando `VITE_ENABLE_MSW=true`. Todas las rutas protegidas hoy cuelgan de un único árbol `RoleGuard → AppShell` (`router/index.tsx:53-58`) que renderiza Sidebar + TopNav de escritorio — no existe ningún layout mobile-first en el repo.

El formulario de incidentes de escritorio (`IncidentNewPage`, `createIncidentSchema`) ya cubre un superset de campos y ya delega el folio (`numero`) y `empresaId` al servidor (`incidents.handlers.ts:181,209` — `generateNumero`/`getActiveEmpresaId` se evalúan en el handler, no en el cliente). `Incidente.ubicacion: {x,y}` son coordenadas de pixel sobre `Local.planoPngUrl` (posición en un plano, no GPS) — confirmado leyendo `incident.types.ts:101-104` y su uso en `createIncidentSchema`. No hay ningún campo de coordenadas geográficas en el modelo actual.

## Goals / Non-Goals

**Goals:**
- Ruta mobile instalable como PWA (`/m/incidentes/nuevo`) que reporta un incidente con foto y GPS opcional, con conexión activa, contra el mock MSW existente.
- Que el Service Worker de la PWA y el de MSW coexistan sin que la instalación de uno rompa el interceptado de `/api/*` que la app entera (incluida la ruta mobile) sigue necesitando en desarrollo.

**Non-Goals (explícitamente diferido a Fase 2/3, cambios separados):**
- Cola offline, IndexedDB, compresión de fotos, Background Sync, reintentos.
- Cualquier lógica de folio/empresa "asignado en sync" — en esta fase todo es síncrono, folio y empresa ya se resuelven server-side en el mismo request.
- Edición offline, investigación/causa raíz mobile, vinculación a QE mobile, push notifications.

## Decisions

### D1 — La ruta mobile vive fuera del árbol `AppShell`, no dentro

`AppShell` renderiza Sidebar + TopNav de escritorio (`router/index.tsx:57`); no es mobile-first y no debe adaptarse condicionalmente (mezclaría dos layouts en un mismo componente). Se agrega una rama nueva, hermana de la rama `AppShell`, ambas bajo el `RoleGuard` raíz (solo exige sesión):

```
{ element: <RoleGuard />, children: [
  { element: <AppShell />, children: [ ...rutas de escritorio existentes... ] },
  { element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.incidentsView} />, children: [
    { path: '/m/incidentes/nuevo', element: <IncidentQuickReportPage /> }
  ]},
]}
```

`ROUTE_ROLE_GROUPS.incidentsView` es el mismo grupo que ya protege `/incidents/nuevo` — no se crea un grupo de roles nuevo. Se registra explícitamente en `PUBLIC_OR_GUARDED_ROUTES`/`routeAccess.ts` (patrón auditado en M6-S01: ninguna ruta nueva queda sin `requiredRoles` explícito).

**Alternativa descartada:** meter la ruta dentro de `AppShell` y ocultar Sidebar/TopNav vía CSS condicional según el path. Descartada por acoplar dos layouts no relacionados en un mismo componente compartido y complicar el dark mode / breakpoints del shell existente sin necesidad.

### D2 — Nuevo campo `geoUbicacion`, no reutilizar `ubicacion`

`ubicacion: {x,y}` es una coordenada relativa a un plano PNG de un `Local` — semánticamente incompatible con `{lat, lng}` de `navigator.geolocation`. Se agrega:

```typescript
interface IncidenteGeoUbicacion {
  lat: number
  lng: number
  capturadoEn: string // ISO 8601, momento de la captura GPS, no de fechaEvento
}
// Incidente.geoUbicacion?: IncidenteGeoUbicacion
```

Campo opcional (RN-M7 implícita del plan de fases: ubicación nunca bloquea el envío). `incidents.handlers.ts` lo persiste con el mismo patrón de spread condicional que ya usa para `evidencias`/`condicionesEntorno` (líneas 219-227) — no requiere migración de fixtures existentes porque es opcional y ausente en incidentes creados antes de esta fase.

### D3 — Riesgo de colisión de Service Workers: scope distinto, no resuelto por convención

Un documento HTML solo puede tener **un** Service Worker controlador a la vez: el navegador elige el SW activo cuyo `scope` sea el prefijo más específico que matchee la URL de la página. MSW se registra hoy con scope por defecto `/` (raíz). Si el SW generado por `vite-plugin-pwa` también registra scope `/`, ambos compiten por ser controlador y el resultado es no determinístico entre reloads (exactamente el síntoma que la tarea de Fase 1 pide verificar en DevTools).

Si en cambio el SW de la PWA se registra con un scope más específico (p.ej. `/m/`) para instalar/cachear solo el shell mobile, se vuelve el controlador de `/m/incidentes/nuevo` **por ser el scope más específico** — y entonces el SW de MSW (`/`, menos específico) deja de ser el controlador de esa página, y sus `fetch` a `/api/incidents` dejan de pasar por el interceptor de MSW. Esto rompería el propio criterio de verificación de esta fase ("confirmar que aparece en el listado desktop").

**Decisión:** el SW de la PWA se registra con `scope: '/m/'` (vía `vite-plugin-pwa`, opciones `scope`/`base`) pero **configurado para no interceptar `fetch` de red** (`generateSW` con `navigateFallback` limitado a assets del shell precacheado — HTML/JS/CSS/manifest/íconos — y **sin ninguna runtime-caching route que matchee `/api/**`**, dejando esas requests sin `event.respondWith()` en su propio handler). Esto no delega la request a MSW (un SW no puede reenviar el control a otro SW): lo que evita es que Workbox capture y responda `/api/*` con su propia lógica de caché, para no enmascarar el fallo si el orden de registro deja a MSW sin controlar la página.

Aun con esta mitigación, sigue existiendo un caso borde real: si el SW de la PWA termina siendo el controlador efectivo de `/m/*` (más específico que `/`), y su fetch handler no responde a `/api/*`, el navegador deja pasar esas requests directo a la red real — **no** hay ningún mecanismo estándar por el que "vuelvan" a ser interceptadas por el SW de MSW. Es decir: la mitigación de scope resuelve la instalabilidad/cacheo del shell sin pisar a MSW en el resto de la app, pero **no garantiza per se** que MSW siga interceptando `/api/*` dentro de `/m/*` — eso depende de cuál SW gana el control de esa página específica, y es el punto exacto que la tarea de verificación en DevTools debe confirmar empíricamente, no asumir.

**Camino de mitigación si la verificación en navegador muestra que la PWA gana el control de `/m/*` y `/api/incidents` deja de interceptarse:** registrar el SW de la PWA con `injectRegister: false` y montar su propio `fetch` listener que, para requests a `/api/**`, haga `event.respondWith(fetch(event.request))` explícito (passthrough consciente) — esto no reactiva a MSW, pero al menos hace explícito el comportamiento. Si eso tampoco es suficiente porque el problema de fondo es que MSW no puede ejecutar dentro de una página controlada por otro SW, la alternativa de última instancia (fuera de alcance de esta fase si no hace falta) es **no registrar el SW de la PWA en absoluto mientras `VITE_ENABLE_MSW=true`** — la app sigue siendo usable/instalable-manualmente sin Service Worker propio en dev, y el SW de producción (`VITE_ENABLE_MSW=false`, sin MSW) se registra sin este conflicto. Esta alternativa se documenta aquí para no perder tiempo de implementación si el camino "scope distinto + sin runtime caching de `/api/**`" no resuelve la colisión en la verificación real.

**Verificación empírica (2026-08-04, sesión de cierre de pendientes de m7-f2-offline-sync):** confirmado en navegador real (build de producción, `npx vite build` + `npx serve -s dist`, `VITE_ENABLE_MSW=true`) que el caso borde descrito arriba SÍ ocurre. Con ambos SW registrados (`mockServiceWorker.js` en scope `/`, `sw.js` de la PWA en scope `/m/`), una navegación de documento nueva a `/m/incidentes/nuevo` (URL tipeada, F5, o el `start_url` del manifest al abrir la PWA instalada) queda controlada por `sw.js`, no por `mockServiceWorker.js` (confirmado vía `navigator.serviceWorker.controller.scriptURL` en la página). Como consecuencia, `POST /api/auth/refresh` (llamado por `authStore.bootstrap()` en cada carga de documento) y cualquier otro `/api/**` no pasan por MSW: caen directo a la red real, que en este entorno de verificación es `npx serve -s` sirviendo su fallback de SPA (`index.html`, status 200) en vez de JSON — lo que además rompe la sesión (bootstrap falla al parsear la respuesta y redirige a `/login`). La mitigación de "sin runtime-caching de `/api/**`" (implementada, tarea 1.2) evita que Workbox enmascare el problema respondiendo con caché, pero **no evita el bypass en sí** — exactamente como se anticipó en el párrafo anterior.

**Workaround usado para poder verificar el resto de Fase 2 (pendientes 2 y 3) sin bloquear en esto:** iniciar sesión en una página de scope raíz (`/login`, `/dashboard` — controlada por MSW) y navegar a `/m/incidentes/nuevo` con `history.pushState` (navegación SPA del lado del cliente, sin recargar el documento) en vez de una navegación dura. El control de Service Worker se decide una sola vez, al momento de la navegación de *documento*; una transición client-side dentro del mismo documento no lo renegocia, así que el documento permanece controlado por `mockServiceWorker.js` y `/api/**` sigue interceptado con normalidad. Esto confirma que el bug es específico de navegaciones de documento nuevas a `/m/*` (URL tipeada, reload, PWA instalada abierta desde el ícono) — no afecta a un usuario que llega a `/m/incidentes/nuevo` navegando dentro de la SPA ya cargada desde `/`.

**Decisión pendiente para Fase 3:** con el riesgo confirmado como real (no hipotético), corresponde elegir entre los dos caminos de mitigación ya documentados arriba (passthrough explícito en `src/sw.ts`, o no registrar el SW de la PWA mientras `VITE_ENABLE_MSW=true`) antes de dar por cerrado este punto — ninguno de los dos se ha implementado todavía. Sin backend real, cualquier acceso directo a `/m/incidentes/nuevo` (typed URL, ícono de PWA instalada) queda roto hasta que se resuelva.

**Resuelto (2026-08-05):** implementada la alternativa de última instancia — el SW de la PWA (`sw.js`) **no se registra en absoluto mientras `VITE_ENABLE_MSW=true`**. El passthrough explícito (`event.respondWith(fetch(event.request))` para `/api/**`) se descartó por no ser una mitigación real: una vez que `sw.js` gana el control de un documento, cualquier estrategia que ejecute dentro de su propio `fetch` handler (incluida un passthrough consciente) sigue siendo *ese* SW resolviendo la request contra la red real — un Service Worker no puede reenviar el control de un fetch a otro SW registrado para un scope distinto, así que ninguna configuración de `sw.ts` puede hacer que `mockServiceWorker.js` intercepte la request en su lugar. Solo evitar que `sw.js` se registre deja a `mockServiceWorker.js` (scope `/`) como único candidato posible, controlando también `/m/*`.

Implementación: `vite.config.ts` cambia `injectRegister: "auto"` → `injectRegister: null` (ya no se inyecta el script de auto-registro en `index.html`); `main.tsx` importa `virtual:pwa-register` y llama a `registerSW({ immediate: true })` solo si `import.meta.env.VITE_ENABLE_MSW !== 'true'`. Hoy (`.env.development` y `.env.production` con `VITE_ENABLE_MSW=true`, sin backend real todavía) esto significa que el SW de la PWA no se registra en ningún build — se reactivará solo, sin tocar este código, el día que `VITE_ENABLE_MSW=false` contra un backend real. La cola offline en sí (IndexedDB, gestionada por la app) no depende del SW para su lógica central (encolar/reintentar/FIFO vía el listener `online`), así que esta mitigación no reduce lo que Fase 2/3 pueden verificar — solo deja fuera del alcance mock la verdadera navegación-offline-con-shell-precacheado y el evento real de Background Sync, que ya eran no verificables de forma fiable bajo el bug original.

**Re-verificado (2026-08-05) en navegador real** (`npx vite build` + `npx serve -s dist`): navegación dura a `/m/incidentes/nuevo` (typed URL) queda controlada por `mockServiceWorker.js` (`navigator.serviceWorker.controller.scriptURL` confirmado), sin ningún registro en scope `/m/`. `POST /api/auth/login`, `/api/incidents` y el resto de `/api/**` se interceptan con normalidad. Ver `m7-f2-indicador-offline/tasks.md` tareas 7.1-7.6, verificadas end-to-end sobre esta misma navegación dura (no el workaround de SPA client-side).

### D4 — Envío del formulario reutiliza el hook/mutation existente de creación de incidentes, no un cliente nuevo

`useCreateIncident` (o el hook equivalente ya usado por `IncidentNewPage`) se reutiliza tal cual contra `POST /api/incidents` — el formulario mobile envía un subset de los mismos campos del mismo `createIncidentSchema` (extendiendo el schema, no creando uno paralelo desconectado), más `geoUbicacion`. Esto evita divergencia entre el contrato mobile y desktop y es lo que hace trivial, en Fase 2, que el mismo payload se pueda encolar en IndexedDB sin transformación adicional.

## Risks / Trade-offs

- **[Riesgo] Colisión de scope entre SW de MSW y SW de la PWA** (ver D3) → Mitigación: scope `/m/` sin runtime-caching de `/api/**`, con verificación obligatoria en DevTools como criterio de aceptación de esta fase (no se da por resuelto solo por configuración).
- **[Riesgo] `navigator.geolocation` y `capture="environment"` no son testeables en el emulador de DevTools con la misma fidelidad que un dispositivo real** → Mitigación: el criterio de verificación de la propuesta original ya exige instalar en un celular real (Android/iOS), no solo probar en desktop con emulación mobile.
- **[Trade-off] `geoUbicacion` queda sin UI de visualización en el detalle de escritorio en esta fase** (el `IncidentDetailPage` de escritorio no se toca) → aceptado: el dato queda persistido y disponible para una fase/spec futura que lo muestre (p.ej. un pin en mapa); no bloquea el criterio de verificación de esta fase, que solo pide que el incidente aparezca correctamente en el listado.
- **[Trade-off] Sin conexión, el envío falla sin cola de reintento** → aceptado explícitamente como Non-Goal de esta fase; la UI debe mostrar el error de red de forma clara (toast, nunca `alert()`) para no simular un éxito falso.

## Open Questions

- ¿El namespace i18n de los textos del formulario mobile va dentro de `incidents` existente o se crea `mobile` nuevo? Esta propuesta asume reutilizar `incidents` (mismas claves de tipo/severidad ya existen) más un puñado de claves nuevas de layout/CTA — a confirmar en implementación si el volumen de claves mobile-específicas justifica separarlo.
- ~~Si la verificación en navegador de D3 muestra que la PWA sí termina ganando el control de `/m/*` pese al scope `/m/`, se deberá decidir entre las dos rutas de mitigación descritas~~ — **Resuelto (2026-08-04): la verificación empírica confirma que sí ocurre** (ver nota en D3). ~~Queda abierto elegir entre las dos rutas de mitigación (passthrough explícito vs. no registrar SW de PWA en dev) — ninguna implementada aún.~~ **Resuelto (2026-08-05): implementado "no registrar el SW de la PWA mientras `VITE_ENABLE_MSW=true`"** (ver nota de resolución en D3) — re-verificado en navegador real que una navegación dura a `/m/incidentes/nuevo` queda controlada por MSW.
