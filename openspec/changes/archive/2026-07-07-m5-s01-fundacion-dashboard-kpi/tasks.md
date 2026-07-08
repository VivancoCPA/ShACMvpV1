## 1. Tipos (dashboard-types)

- [x] 1.1 Crear `src/features/dashboard/types/kpi.types.ts` con `KpiId`, `KpiDefinition`, `KpiResult`, `KpiFrecuencia`, `KpiUnidad`.
- [x] 1.2 Crear `src/features/dashboard/constants/kpi.constants.ts` con `KPI_DEFINITIONS: Record<KpiId, KpiDefinition>` (9 entradas, ver tabla de `design.md`).
- [x] 1.3 Crear `src/features/dashboard/types/dashboardSummary.types.ts` con `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen`, `AccionCorrectivaResumen`.
- [x] 1.4 Crear `src/features/dashboard/types/dashboardData.types.ts` con `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`, `DashboardSummaryData`.
- [x] 1.5 Crear `src/features/dashboard/utils/dashboardRoleMapping.ts` con `getDashboardDataTypeForRole(rol: UserRole)`, mapeando `JEFE_CONTROL_DOCUMENTARIO → 'JEFE_CALIDAD'`.
- [x] 1.6 Test unitario de `getDashboardDataTypeForRole` cubriendo los 6 roles con acceso y el caso `ADMINISTRADOR_SISTEMA`.

## 2. Fixture de horas trabajadas (dashboard-msw-fixtures)

- [x] 2.1 Crear `src/mocks/fixtures/horasTrabajadas.fixtures.ts` con `HorasTrabajadasEntry` y `horasTrabajadasFixtures` cubriendo las 19 áreas de `AREAS_SHAC` × ≥6 meses consecutivos, valores 200-5000 horas/mes.
- [x] 2.2 Re-exportar `horasTrabajadasFixtures` desde `src/mocks/fixtures/index.ts`.

## 3. Getters de store en vivo (prerequisito de dashboard-msw-handlers)

- [x] 3.1 Agregar `export function getQeStore(): QualityEvent[]` en `src/mocks/handlers/quality-events.handlers.ts` (retorna el `let qeStore` existente).
- [x] 3.2 Agregar `export function getDocumentsStore(): Documento[]` en `src/mocks/handlers/documents.handlers.ts` (retorna el `let store` existente).
- [x] 3.3 Agregar `export function getNonconformitiesStore(): NoConformidad[]` en `src/mocks/handlers/nonconformities.handlers.ts` (retorna el `let nonconformities` existente).
- [x] 3.4 Verificar que `getIncidentsStore()` (ya existente en `incidents.handlers.ts`) no requiere cambios.

## 4. Handlers MSW (dashboard-msw-handlers)

- [x] 4.1 Crear `src/mocks/handlers/dashboard.handlers.ts` con la lógica de cálculo de cada uno de los 9 KPIs, usando los getters del punto 3 y `horasTrabajadasFixtures`.
- [x] 4.2 Implementar `GET /api/dashboard/kpis` (query param `periodo` opcional, default mes actual), con lógica de semáforo VERDE/AMARILLO/ROJO.
- [x] 4.3 Implementar `GET /api/dashboard/summary`, resolviendo el usuario autenticado (mismo mecanismo mock-auth que otros handlers), aplicando `getDashboardDataTypeForRole` y el filtrado por `area`/`areasAsignadas` para `OPERARIO`/`SUPERVISOR`.
- [x] 4.4 Registrar `dashboardHandlers` en `src/mocks/handlers/index.ts`.
- [x] 4.5 Tests de handler: 9 KPIs presentes, filtrado por rol (`OPERARIO`, `SUPERVISOR`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION`), 401 sin token, periodo sin datos retorna `valor: 0`.

## 5. Hooks TanStack Query (dashboard-query-hooks)

- [x] 5.1 Crear `src/features/dashboard/api/dashboard.api.ts` con `getDashboardKpis(periodo?)` y `getDashboardSummary()`.
- [x] 5.2 Crear `src/features/dashboard/hooks/dashboardQueryKeys.ts` con `DASHBOARD_QUERY_KEYS`.
- [x] 5.3 Crear `src/features/dashboard/hooks/useDashboardKpis.ts`.
- [x] 5.4 Crear `src/features/dashboard/hooks/useDashboardSummary.ts` (con `enabled: Boolean(authStore.user)`).
- [x] 5.5 Tests de hooks con MSW: `useDashboardKpis` retorna 9 resultados; `useDashboardSummary` deshabilitado sin usuario y habilitado retorna la forma correcta por rol.

## 6. RBAC de ruta /dashboard (routing)

- [x] 6.1 En `src/router/index.tsx`, envolver la ruta `/dashboard` con `<RoleGuard requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']}>`, manteniendo el componente placeholder actual como children.
- [x] 6.2 Test de router: los 6 roles acceden sin redirección; `ADMINISTRADOR_SISTEMA` es redirigido a `/no-autorizado`; usuario no autenticado es redirigido a `/login`.

## 7. Sidebar (app-navigation)

- [x] 7.1 En `src/components/layout/Sidebar.tsx`, actualizar `roles` del ítem `dashboard` en `NAV_ITEMS` a `['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']`.
- [x] 7.2 Test de `Sidebar`: el ítem "Dashboard" aparece para `OPERARIO` y `SUPERVISOR` (antes ocultos) y sigue apareciendo para los 4 roles que ya lo veían.

## 8. Verificación final

- [x] 8.1 Ejecutar la suite de tests completa (`npm test` o equivalente) y confirmar que no hay regresiones en los handlers de QE/NC/Incidentes/Documentos existentes tras agregar los getters del punto 3.
- [x] 8.2 Ejecutar type-check (`tsc --noEmit`) confirmando cero `any` y cero errores en los nuevos archivos de `features/dashboard/`.
- [ ] 8.3 Confirmar manualmente en el navegador (con MSW activo) que `/dashboard` sigue mostrando el placeholder "Próximamente" para los 6 roles y redirige a `/no-autorizado` para `ADMINISTRADOR_SISTEMA`.
