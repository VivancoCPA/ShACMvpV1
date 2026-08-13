## Why

Con la Fase 1 (`me-f1-modelo-datos`, aplicada) y la Fase 2 (`me-f2-sesion-rbac-login`, aplicada) el sistema ya sabe quién es el usuario, en qué empresa está trabajando (`authStore.empresaActivaId`) y qué rol efectivo tiene ahí — pero **ningún handler MSW de los 6 módulos de negocio existentes filtra sus datos por `empresaId` todavía**. Verificado en código: los handlers de creación de Documentos, Incidentes, No Conformidades y Quality Events asignan `empresaId: 'empresa-001'` como literal fijo (no leen la sesión), y ninguno de los `GET` de listado o detalle de estos 4 módulos, ni de Locales/Zonas, aplica ningún filtro por empresa. Hoy, un usuario con empresa activa "Empresa B" sigue viendo/creando/editando registros de "Empresa A" en los mocks — el selector de empresa del TopNav (Fase 2) cambia el rol pero no el alcance de los datos.

Esta es la fase de mayor riesgo del cambio porque toca código ya en producción (los 6 módulos existentes), no código nuevo — por eso se dejó para después de tener sesión y RBAC ya probados en Fase 2.

## What Changes

- **MODIFIED**: Handlers MSW de Documentos (`documents.handlers.ts`), Incidentes (`incidents.handlers.ts`), No Conformidades (`nonconformities.handlers.ts`), Quality Events (`quality-events.handlers.ts`) y Locales/Zonas (`locales.handlers.ts`) — cada uno filtra por `empresaId` de la empresa activa de la sesión (leída vía `getSessionUserUnchecked()`/`authStore.getState().empresaActivaId`, mismo mecanismo que `getSessionUser()` ya usa para el rol efectivo desde Fase 2), tanto en listado (`GET` colección) como en operaciones individuales (`GET`/`PATCH`/`DELETE`/sub-recursos por id, con verificación de que el recurso pertenece a la empresa activa antes de permitir la operación — 404, no solo ocultarlo del listado).
- **MODIFIED**: Handlers de creación (`POST /api/documents`, `POST /api/incidents`, `POST /api/nonconformities`, `POST /api/quality-events`) — dejan de asignar el literal fijo `empresaId: 'empresa-001'` y en su lugar toman `empresaId` de la empresa activa de la sesión del creador, igual que ya hacen con `id`/`codigo`/`numero` (campos server-generated, nunca enviados por el cliente). **No requiere tocar formularios, schemas Zod ni componentes React** — verificado que ningún `CreateXInput` ni `XForm` referencia `empresaId` hoy; el campo nunca fue expuesto al cliente, así que el fix vive enteramente en la capa MSW.
- **MODIFIED**: Numeración/folios (`generateCodigo` en Documentos, `generateNumero` en Incidentes y No Conformidades, el literal `QE-2026-NNN` en Quality Events, `generateCodigoLocal`/`generateCodigoZona` en Locales/Zonas) — el contador pasa de global (`store.length + 1`) a scoped por empresa activa (RN-EMP-003, formalizada en esta fase — ver design.md).
- **MODIFIED**: Catálogo Local/Zona (`GET /api/locales`, `GET /api/zonas` en `locales.handlers.ts`) — filtra por empresa activa; el hook `useLocales()` (M3, `incident-locales`) y el selector en `IncidentForm`/`IncidentDetailPage`/`IncidentMapView` heredan el filtro sin cambio de contrato porque ya consumen esos endpoints tal cual.

Explícitamente **fuera de alcance de este cambio**:
- Query keys de TanStack Query — verificado que **no requieren cambio**: la Fase 2 (D8) ya implementó `queryClient.clear()` completo al cambiar de empresa activa, que junto con el filtrado server-side de esta fase es suficiente para que ninguna vista muestre datos de la empresa anterior tras un switch. Ver design.md para el detalle de esta decisión.
- CRUD de administración de empresas y roles Superadmin/Admin de empresa (Fase 4).
- Verificación exhaustiva de exports/reportes cross-empresa, incluyendo el batch PDF de M4-S07 (Fase 5, aunque el fix de creación en esta fase ya reduce el riesgo).
- Dashboard (`dashboard.handlers.ts`) y Notificaciones (`notifications.handlers.ts`) — no forman parte del alcance original de esta fase (ver Impact/Risks); sus KPIs y notificaciones seguirán agregando datos de todas las empresas hasta una fase futura.
- Catálogo de Áreas (`features/areas/`, M6) — confirmado en Fase 1 que `Area` no lleva `empresaId`; sigue fuera de alcance también en esta fase.

## Capabilities

### New Capabilities

_Ninguna — esta fase solo modifica el comportamiento de capabilities existentes._

### Modified Capabilities

- `document-msw-handlers`: filtro por empresa activa en `GET /api/documents`, `GET /api/documents/:id` y todas las operaciones por id; `empresaId` en creación resuelto desde la sesión; `generateCodigo` scoped por empresa (RN-EMP-003).
- `incident-msw-handlers`: filtro por empresa activa en `GET /api/incidents`, `GET /api/incidents/:id` y todas las operaciones por id (incluyendo sub-recurso de acciones correctivas vía el incidente padre); `empresaId` en creación resuelto desde la sesión; `generateNumero` scoped por empresa (RN-EMP-003).
- `nc-msw-handlers`: filtro por empresa activa en `GET /api/nonconformities`, `GET /api/nonconformities/:id` y todas las operaciones por id; `empresaId` en creación resuelto desde la sesión; `generateNumero` scoped por empresa (RN-EMP-003).
- `quality-event-msw-handlers`: filtro por empresa activa en `GET /api/quality-events`, `GET /api/quality-events/:id` y todas las operaciones por id (incluyendo sub-recurso de acciones correctivas vía el QE padre); `empresaId` en creación resuelto desde la sesión; numeración `QE-2026-NNN` scoped por empresa (RN-EMP-003).
- `location-admin-mocks`: filtro por empresa activa en `GET /api/locales`, `GET /api/zonas`, `GET /api/locales/:id` y operaciones por id de Locales/Zonas; `generateCodigoLocal`/`generateCodigoZona` scoped por empresa (RN-EMP-003).

## Impact

- **Specs afectadas**: `document-msw-handlers`, `incident-msw-handlers`, `nc-msw-handlers`, `quality-event-msw-handlers`, `location-admin-mocks`. No se tocan specs de formularios (`document-form`, `incident-form`, `nc-form`, `quality-event-form`), hooks de query (`document-query-hooks`, `incident-tanstack-hooks`, `nc-query-hooks`, `quality-event-hooks`) ni `incident-locales` — sus contratos observables desde el cliente no cambian (ver design.md).
- **Código afectado**: `src/mocks/handlers/documents.handlers.ts`, `src/mocks/handlers/incidents.handlers.ts`, `src/mocks/handlers/nonconformities.handlers.ts`, `src/mocks/handlers/quality-events.handlers.ts`, `src/mocks/handlers/locales.handlers.ts`.
- **Riesgo**: alto — toca 5 handlers ya en producción con ~40 endpoints combinados. Mitigado aplicando y verificando módulo por módulo (Documentos → Incidentes → NC → QE → Locales/Zonas), siguiendo el mismo principio de diagnóstico-antes-de-fix documentado en tasks.md, con un inventario completo de endpoints por módulo hecho antes de escribir código (ver design.md).
- **Dependencias**: requiere Fase 1 y Fase 2 aplicadas (ya cumplido — `empresaId` existe en las 5 entidades transaccionales desde Fase 1; `authStore.empresaActivaId` y `getSessionUser()`/`getSessionUserUnchecked()` existen desde Fase 2).
