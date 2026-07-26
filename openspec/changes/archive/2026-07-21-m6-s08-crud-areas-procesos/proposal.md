## Why

"Área/Proceso afectado" es hoy la constante estática `AREAS_SHAC` (19 valores hardcodeados en `src/constants/shared.constants.ts`), consumida como texto libre sin validación de catálogo por Quality Events, No Conformidades, Incidentes y `areasAsignadas` de Supervisor. A diferencia de Local/Zona (CRUD completo desde M6-S01–M6-S04), Área nunca tuvo mantenimiento administrable pese a que el PRD la describe como "lista configurable". Cualquier cambio de nombre, alta o baja de área requiere hoy un despliegue de código. Esta spec cierra ese gap replicando el patrón ya validado de Locales/Zonas.

## What Changes

- Nueva entidad `Area` (lista plana, sin jerarquía) con CRUD completo (`/admin/areas`) restringido a `ADMINISTRADOR_SISTEMA`, siguiendo el mismo patrón de capas que Locales/Zonas: types, API client Axios, handlers MSW con store mutable, fixtures, schemas Zod, hooks TanStack Query, permisos, páginas de listado/alta/edición.
- Regla de bloqueo de desactivación (RN-ARE-001) con desglose por módulo (QE / NC / Incidentes) de cuántos registros activos en estado no-terminal referencian el Área — extiende el patrón de mensaje agregado de `BloqueoIncidentesModal` a un desglose real de 3 fuentes, ya que Área (a diferencia de Local/Zona) es consumida por tres dominios distintos simultáneamente.
- **BREAKING (dato)**: migración de `QualityEvent.areaAfectada`, `NoConformidad.areaAfectada`, `Incidente.areaId` y `Documento.area` (M1 — el campo SÍ está persistido en `Documento`, a diferencia de lo que se asumió inicialmente) de string libre a `areaId` (FK al catálogo `Area`). Fixtures existentes de los cuatro dominios se migran para resolver contra el `id` real del área correspondiente, sin renombrar ni inventar áreas nuevas — los 19 valores actuales de `AREAS_SHAC` se convierten en la semilla (`areas.fixtures.ts`) del catálogo.
- `areasAsignadas` de Supervisor (alta/edición de usuario, M6-S07) pasa de checkbox-grid contra `AREAS_SHAC` a multi-select contra el catálogo `Area` real (`areaIds`); `User.area` (área propia, todos los roles) pasa igualmente a `areaId`.
- El filtrado por área del dashboard de Supervisor (`GET /api/dashboard/summary`, M5) se ajusta para comparar `areaIds`/`areaId` en vez de `areasAsignadas`/`areaAfectada`/`Documento.area` por nombre.
- `AREAS_SHAC` como constante estática se elimina de `src/constants/shared.constants.ts` una vez todos los consumidores (incluyendo Documentos) leen del catálogo vía hook (`useAreas`).
- Ítem de sidebar "Áreas" visible solo para `ADMINISTRADOR_SISTEMA`, junto al de "Usuarios".

## Capabilities

### New Capabilities
- `area-types`: Tipos TypeScript de la entidad `Area` y DTOs de request/response del CRUD admin.
- `area-admin-api`: Cliente Axios (`areas.api.ts`) con las operaciones CRUD + activar/desactivar.
- `area-admin-mocks`: Handlers MSW (store mutable, seed desde fixtures) y fixtures iniciales (`areas.fixtures.ts`) migradas 1:1 desde `AREAS_SHAC`.
- `area-schemas`: Schemas Zod de alta/edición de Área (RN-ARE-004, unicidad de nombre no case-sensitive).
- `area-admin-hooks`: Hooks TanStack Query (`useAreas`, `useArea`, `useCrearArea`, `useActualizarArea`, `useDesactivarArea`, `useReactivarArea`).
- `area-business-rules`: Función pura `puedeDesactivarArea(area, qes, ncs, incidentes)` con desglose de bloqueo por módulo (RN-ARE-001).
- `area-permissions`: `puedeAdministrarAreas` / `puedeConsultarAreas`, exclusivo `ADMINISTRADOR_SISTEMA` para mutación (RN-ARE-003).
- `area-list-view`: Página de listado `/admin/areas` (tabla simple, sin filas expandibles) con acciones inline editar/desactivar/reactivar.
- `area-form`: Formulario de alta/edición (nombre + descripción opcional) y modal de bloqueo con desglose por módulo.

### Modified Capabilities
- `shared-constants`: `AREAS_SHAC` deja de ser la fuente de verdad de áreas y se elimina como export una vez migrados todos sus consumidores.
- `quality-event-types`: `QualityEvent.areaAfectada` (string libre) pasa a `areaId` (FK a `Area`).
- `quality-event-schemas`: `qualityEventCreateSchema` y `qualityEventEditReporteInicialSchema` validan el campo renombrado `areaId` (sigue siendo `z.string().min(1)` a nivel de schema; la integridad referencial contra el catálogo es responsabilidad del handler mock/backend, no del schema).
- `quality-event-permissions`: `resolveQEEditAccess` (RN-QE-014) compara `usuario.areaIds` contra `qe.areaId` en vez de `usuario.areasAsignadas` contra `qe.areaAfectada` — mismo comportamiento, campos renombrados.
- `nonconformity-types`: `NoConformidad.areaAfectada` y `NCFilters.areaAfectada` pasan a `areaId`.
- `nonconformity-schemas`: `createNCSchema` valida el campo renombrado `areaId`.
- `incident-types`: `Incidente.areaId` mantiene nombre y tipo (`string`), pero la invariante documentada cambia — deja de ser texto libre sourced de `AREAS_SHAC` y pasa a ser una FK real que SHALL corresponder a un `Area.id` del catálogo.
- `document-types`: `Documento.area` pasa a `areaId`; `DocFilters.area` pasa a `areaId`.
- `document-schemas`: `createDocumentSchema` valida el campo renombrado `areaId`.
- `user-management-types` / `user-management-schemas`: `User.area` (nombre libre) pasa a `areaId` (FK); `User.areasAsignadas` (`string[]` de nombres) pasa a `areaIds` (`string[]` de FKs). `CreateUserRequest`/`UpdateUserRequest` y los schemas Zod de alta/edición (RN-USR-005/006) se ajustan en consecuencia, preservando la misma regla condicional para `rol === 'SUPERVISOR'`.
- `user-management-msw`: `PATCH /api/users/:id` actualiza los campos renombrados `areaId`/`areaIds`.
- `user-management-form`: los campos `area`/`areasAsignadas` del formulario de alta/edición de usuario pasan a poblarse desde `useAreas()` en vez de `AREAS_SHAC.map`.
- `dashboard-msw-handlers`: `GET /api/dashboard/summary` filtra datos de `SUPERVISOR` comparando `usuario.areaIds` contra `qe.areaId`/`incidente.areaId`/`nc.areaId`, y `documentosPendientesLectura` compara `Documento.areaId === usuario.areaId`, en vez de comparar por nombre.

## Impact

- **Código nuevo**: `src/features/areas/` completo (types, api, schemas, hooks, permissions, components, pages), `src/mocks/handlers/areas.handlers.ts`, `src/mocks/fixtures/areas.fixtures.ts`.
- **Código modificado**: `src/constants/shared.constants.ts` (elimina `AREAS_SHAC`), formularios y filtros que hoy mapean `AREAS_SHAC.map(...)` en `QualityEventForm.tsx`, `NCForm.tsx`, `NCListFilters.tsx`, `IncidentForm.tsx`, `IncidentList.tsx`, `UserFormModal.tsx`, `DocumentForm.tsx`, `DocumentListFilters.tsx`; `qualityEventPermissions.ts` (RN-QE-014, hoy compara `areaAfectada` contra `areasAsignadas` por nombre, pasa a comparar por `areaId`/`areaIds`); handler de `GET /api/dashboard/summary` (`dashboard.handlers.ts` o equivalente).
- **Fixtures existentes**: `quality-events.fixtures.ts`, `nonconformities.fixtures.ts` (o equivalente), `incidents.fixtures.ts`, `documents.fixtures.ts`, `auth.fixtures.ts` (`User.area`/`areasAsignadas`) — todos requieren migración de datos para resolver contra `Area.id`.
- **Router / Sidebar**: nueva ruta `/admin/areas` con `RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA']}`, nuevo ítem en `Sidebar.tsx`.
- **Sin impacto**: Local/Zona (ADD-03) no se cruza con Área — son conceptos distintos (ubicación física vs. proceso).
