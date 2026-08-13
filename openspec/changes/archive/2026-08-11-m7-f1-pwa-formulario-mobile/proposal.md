## Why

El reporte de incidentes SyST hoy solo es viable desde un puesto de escritorio (`/incidents/nuevo`, formulario denso multi-sección dentro del `AppShell`). En campo — patio de almacén, zona de carga de minerales — el usuario que presencia un incidente no tiene ese contexto disponible: necesita reportarlo desde su celular, en el momento, con foto y ubicación, sin la fricción del formulario completo de escritorio. Esta Fase 1 entrega esa ruta mobile mínima **con conexión activa**, sin resolver aún el caso sin señal (Fase 2, cambio separado) — igual que en Multiempresa, se valida el camino feliz conectado antes de sumar la complejidad de una cola offline.

**Nota de alcance:** el documento `proposal-m7-pwa-incidencias.md` referenciado como padre de este plan de fases no existe en el repositorio (`openspec/`, `docs/`) al momento de esta propuesta. Esta propuesta se escribe de forma autocontenida a partir del plan de fases entregado y del código real de `features/incidents/`; no asume ninguna decisión de ese documento padre que no esté verificable en el repo.

## What Changes

- Instalar `vite-plugin-pwa` y configurar manifest (nombre, ícono, splash, `display: standalone`), con estrategia de registro de Service Worker `autoUpdate`.
- Dar al Service Worker de la PWA un **scope propio distinto y más específico que `/`** (scope de MSW) para que ambos SW puedan coexistir sin que uno le robe el control de página al otro — ver riesgo técnico documentado en `design.md`. Verificación manual en DevTools > Application > Service Workers es criterio de aceptación de esta fase, no un detalle de implementación a asumir como resuelto.
- Nueva ruta `/m/incidentes/nuevo`, **fuera del `AppShell`** (sin Sidebar/TopNav de escritorio) pero dentro del `RoleGuard` de sesión, con un layout propio mobile-first de una columna.
- Formulario de reporte rápido (React Hook Form + Zod) con un subset de campos de `Incidente`: `tipo`, `areaId`, `descripcion`, severidad percibida (opcional, mismo comportamiento de auto-cálculo que el formulario de escritorio si se omite), fotos, ubicación GPS opcional.
- Captura de fotos vía `<input type="file" accept="image/*" capture="environment">` con preview antes de enviar.
- Captura de GPS vía `navigator.geolocation.getCurrentPosition`, no bloqueante si se niega el permiso o el dispositivo no la soporta.
- **Nuevo campo** `Incidente.geoUbicacion?: { lat: number; lng: number; capturadoEn: string }` — distinto de `Incidente.ubicacion` (coordenadas `{x,y}` sobre el plano PNG de un local, ya existente y con otro propósito). No se reutiliza `ubicacion` para GPS.
- Envío directo al endpoint MSW existente `POST /api/incidents` (mismo mock, mismo folio server-side ya vigente — ver Impact). Sin cola offline en esta fase: sin conexión, el formulario falla visiblemente y no hay reintento automático (eso es Fase 2).

## Capabilities

### New Capabilities
- `mobile-incident-report`: ruta `/m/incidentes/nuevo`, layout mobile-first, formulario de reporte rápido de incidente (subset de campos), captura de foto y GPS opcional, envío online-only contra el mock existente de incidentes.
- `pwa-shell`: instalabilidad de la aplicación como PWA (manifest, íconos, Service Worker en modo `autoUpdate`) y su convivencia verificada con el Service Worker de MSW sin pisarse de scope.

### Modified Capabilities
- (ninguna — no existe todavía spec `incidents` en `openspec/specs/`; esta propuesta añade capacidades nuevas sin modificar contratos de requirements existentes. El endpoint `POST /api/incidents` no cambia de contrato, solo gana un nuevo consumidor y un campo opcional nuevo en el payload.)

## Impact

- **Nuevos archivos:** `src/pages/mobile/IncidentQuickReportPage.tsx` (o ruta equivalente dentro de `features/incidents/`), su schema Zod dedicado, componente de layout mobile mínimo, config de `vite-plugin-pwa` en `vite.config.ts`, `public/manifest` assets.
- **Router:** nueva rama en `router/index.tsx` para `/m/incidentes/nuevo`, paralela a la rama `AppShell` (no hija de ella), con su propio `RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.incidentsView}` (mismo grupo de roles que ya protege `/incidents/nuevo` — ver `routeAccess.ts:32`) y registro explícito en `PUBLIC_OR_GUARDED_ROUTES` según el patrón ya auditado en M6-S01.
- **Tipos:** `Incidente` (`features/incidents/types/incident.types.ts`) gana el campo opcional `geoUbicacion`.
- **MSW:** `incidents.handlers.ts` (`POST /api/incidents`) acepta y persiste `geoUbicacion` si viene en el body — mismo patrón de spread condicional que ya usa para `evidencias`, `condicionesEntorno`, etc. (`incidents.handlers.ts:219-227`). El folio (`numero`) **ya se genera server-side** en este handler (`generateNumero`, línea 181) — no requiere cambio para esta fase; se documenta como invariante que Fase 2 seguirá dependiendo de.
- **Build:** nueva dependencia `vite-plugin-pwa` (y su runtime Workbox generado). Sin nuevas dependencias de `idb` / `browser-image-compression` en esta fase — esas son de Fase 2.
- **i18n:** nuevas claves bajo el namespace `incidents` (o uno nuevo `mobile`) para los textos del formulario mobile, en `es-PE.json` y `en-US.json`.
- **Fuera de alcance de esta fase (recordatorio):** cola offline / IndexedDB, sincronización en background, edición offline, investigación/causa raíz en mobile, vinculación a QE desde mobile, notificaciones push. Cualquiera de estos que aparezca durante la implementación se trata como cambio aparte (Fase 2/3), no se cuela en `tasks.md` de esta fase.
