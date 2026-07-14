## Why

`/dashboard` ya resuelve el rol `ALTA_DIRECCION` en el mapeo de tipos (`dashboardRoleMapping.ts`) y el backend mock ya construye `AltaDireccionDashboardData` completo (`buildAltaDireccionData` en `dashboard.handlers.ts`), pero `DashboardPage.tsx` no tiene una rama para ese tipo de dashboard y cae al placeholder `<ComingSoon />`. Alta Dirección necesita visibilidad ejecutiva real: QEs abiertos/vencidos, tendencia de sus 3 KPIs críticos, QEs críticos activos, reaperturas y ACs de alto riesgo con solicitud de extensión de plazo pendiente — sin lo cual la gerencia no tiene forma de monitorear el sistema de calidad/SyST desde la UI.

## What Changes

- Nuevo componente `AltaDireccionDashboard` en `features/dashboard/pages/`, cableado en `DashboardPage.tsx` para el tipo `'ALTA_DIRECCION'` (reemplaza el `<ComingSoon />` actual para ese rol).
- Widget de **KPIs ejecutivos**: QEs abiertos (conteo, estado ≠ `VERIFICADO`, incluye `REABIERTO`), QEs vencidos (mismo universo, plazo por severidad vencido contra la fecha actual), KPI-01, KPI-04, KPI-05.
- Widget de **comparativa vs mes anterior** para KPI-01/04/05, reutilizando `calcularKpi01/04/05` ya existentes (M5-S05b) sobre los 2 últimos períodos mensuales, con indicador ↑/↓/= y umbral de "estable" (< 2 puntos porcentuales).
- Widget de **QEs críticos activos** (severidad `CRITICA`, estado no terminal) con enlace a `QEDetail` — reutiliza `alertasCriticas`, ya calculado en el backend mock.
- Widget de **alertas de reaperturas** (`ciclo > 1`), ordenado por fecha de reapertura más reciente.
- Widget de **AC pendientes de extensión de plazo** (severidad Alta/Crítica del QE padre) — requiere un campo mínimo de solo lectura nuevo en `AccionCorrectivaQE` (`solicitudAjustePlazo`) más datos semilla, ya que QE-AC-007 no existe hoy en ninguna forma. El formulario real de aprobación (justificación + validación de umbral 50%) queda fuera de alcance — gap de M4.
- Extensión de `AltaDireccionDashboardData` (`resumenPorModulo.qualityEvents`) con `abiertos` y `vencidos`; nuevo tipo de resumen para reaperturas y para ACs con solicitud pendiente.
- Sin cambios de RBAC/routing: `/dashboard` ya admite `ALTA_DIRECCION` en `RoleGuard` desde M5-S01.

## Capabilities

### New Capabilities
- `dashboard-altadireccion-view`: dashboard ejecutivo para `ALTA_DIRECCION` — KPIs ejecutivos, comparativa mensual, QEs críticos, reaperturas y ACs con solicitud de extensión de plazo pendiente.

### Modified Capabilities
- `dashboard-types`: `AltaDireccionDashboardData.resumenPorModulo.qualityEvents` gana `abiertos`/`vencidos`; nuevos tipos `QEReaperturaResumen` y `ACSolicitudAjustePlazoResumen` en `dashboardSummary.types.ts`.
- `dashboard-msw-handlers`: `buildAltaDireccionData()` calcula QEs abiertos/vencidos, reaperturas ordenadas y ACs con solicitud de ajuste de plazo pendiente para QEs Alta/Crítica.
- `quality-event-types`: `AccionCorrectivaQE` gana el campo opcional de solo lectura `solicitudAjustePlazo` (fecha solicitada, justificación, estado, solicitante) — sin flujo de aprobación.
- `quality-event-msw-fixtures`: semilla de al menos 2-3 ACs de QEs Alta/Crítica con `solicitudAjustePlazo.estado = 'PENDIENTE'`.

## Impact

- **Frontend**: `src/features/dashboard/pages/DashboardPage.tsx`, nuevo `AltaDireccionDashboard.tsx` + componentes de widget nuevos (KPIs ejecutivos, comparativa mensual, reaperturas, AC-extensión-plazo); reutiliza `KpiGridWidget`/`SemaforoCriticoBanner`/patrones de `ACsPorVencerWidget` donde aplique.
- **Tipos**: `dashboardData.types.ts`, `dashboardSummary.types.ts`, `qualityEvent.types.ts` (`AccionCorrectivaQE`).
- **Mocks**: `dashboard.handlers.ts` (`buildAltaDireccionData`), `quality-events.fixtures.ts` (seed de `solicitudAjustePlazo`).
- **Sin cambios**: routing/RBAC (`router/index.tsx`), `dashboardRoleMapping.ts` (ya correcto).
- **Gaps documentados** (no se resuelven en este spec): exportar informe ejecutivo (S09/v1.1), formulario real de aprobación de extensión de plazo con justificación + umbral 50% (gap de M4), resumen automático por email mensual (requiere sistema de notificaciones, gap ya documentado desde M5-S03).
