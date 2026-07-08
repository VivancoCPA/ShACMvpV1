## Why

M5 (Dashboard e Indicadores) es el único módulo del MVP que sigue siendo un placeholder "Próximamente": no existen los tipos de los 9 KPIs del sistema, ni datos de dashboard por rol, ni el RBAC real de `/dashboard` (hoy solo está restringido visualmente en `Sidebar.tsx`, no en `RoleGuard`). Sin esta fundación (tipos + mocks + hooks), ninguna de las pantallas de dashboard (S02-S08) puede empezar: necesitan un contrato de datos estable y una fuente MSW que agregue sobre los dominios ya existentes (Quality Events, Documentos, No Conformidades, Incidentes).

## What Changes

- Definir tipos TypeScript para los 9 KPIs del sistema (KPI-01 a KPI-09), cada uno con fórmula, meta, frecuencia y fuente de datos, usando un tipo común parametrizado (`KpiDefinition<T>`) en vez de 9 interfaces desconectadas, dado que comparten forma (id, nombre, meta, frecuencia, semáforo) y solo difieren en la fórmula de cálculo y el tipo de valor resultante.
- Definir 5 tipos de dashboard por rol (`OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`), cada uno reflejando los widgets específicos de ese rol — no un modelo genérico de widgets.
- Aplicar el guard real de `/dashboard` en `RoleGuard` con `requiredRoles` = los 6 roles de dominio (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`); `ADMINISTRADOR_SISTEMA` queda excluido. Corregir `Sidebar.tsx`, que hoy solo muestra el ítem "dashboard" a 4 de los 6 roles con acceso real.
- Agregar el fixture `horasTrabajadas.fixtures.ts` (horas trabajadas por área y mes, ≥6 meses) para soportar el cálculo real de KPI-04 (índice de frecuencia de incidentes).
- Agregar handlers MSW y hooks TanStack Query para el cálculo de los 9 KPIs (agregación de lectura sobre QualityEvents, AccionesCorrectivas, Documentos, No Conformidades e Incidentes) y para los datos de dashboard por rol, filtrados según el usuario autenticado (p. ej. un Supervisor solo ve `areasAsignadas`).
- Todo handler que lea datos de otro dominio usa el store mutable en vivo de ese dominio (el mismo array que mutan los handlers de QE/NC/Incidentes/Documentos), nunca el fixture estático importado directamente.
- Sin UI real: no se crean páginas, gráficos ni componentes visuales de dashboard en este change (llegan en S02-S08). `DashboardPage` sigue siendo el placeholder "Próximamente" hasta S02.

## Capabilities

### New Capabilities
- `dashboard-types`: Tipos TypeScript de los 9 KPIs (`KpiId`, `KpiDefinition`, `KpiResult`) y de los 5 `*DashboardData` por rol.
- `dashboard-msw-fixtures`: Fixture `horasTrabajadas.fixtures.ts` (horas trabajadas por área/mes) y cualquier fixture auxiliar de dashboard necesaria.
- `dashboard-msw-handlers`: Handlers MSW `GET /api/dashboard/kpis` y `GET /api/dashboard/summary` (datos por rol), leyendo en vivo de los stores mutables de QE/NC/Incidentes/Documentos.
- `dashboard-query-hooks`: Hooks TanStack Query (`useDashboardKpis`, `useDashboardSummary`) y sus `QUERY_KEYS.dashboard.*`.

### Modified Capabilities
- `routing`: La ruta `/dashboard` deja de ser un placeholder sin guard de rol — se le aplica `<RoleGuard requiredRoles={[...]}>` con los 6 roles de dominio; el placeholder visual se mantiene hasta S02 pero ahora detrás del guard real.
- `app-navigation`: El ítem "dashboard" de `Sidebar.tsx` se corrige para reflejar los 6 roles con acceso real (agrega `OPERARIO` y `SUPERVISOR`, que hoy están excluidos solo visualmente).

## Impact

- **Nuevos archivos**: `src/features/dashboard/types/*.types.ts`, `src/mocks/fixtures/horasTrabajadas.fixtures.ts`, `src/mocks/handlers/dashboard.handlers.ts`, `src/features/dashboard/api/dashboard.api.ts`, `src/features/dashboard/hooks/useDashboardKpis.ts`, `src/features/dashboard/hooks/useDashboardSummary.ts`.
- **Archivos modificados**: `src/router/index.tsx` (RoleGuard real en `/dashboard`), `src/components/layout/Sidebar.tsx` (roles del ítem dashboard), `src/mocks/handlers/index.ts` (registrar `dashboardHandlers`), `src/mocks/fixtures/index.ts` (exportar `horasTrabajadas.fixtures`), `src/lib/queryClient.ts` o donde vivan `QUERY_KEYS` (agregar `dashboard`).
- **Sin impacto en UI**: no se toca `DashboardPage` (placeholder) ni se agregan gráficos/widgets visuales.
- **Dependencias de dominio**: lee de los stores mutables ya existentes de `quality-events`, `nonconformities`, `incidents` y `documents` — no introduce nuevas mutaciones ni nuevos endpoints de escritura.
