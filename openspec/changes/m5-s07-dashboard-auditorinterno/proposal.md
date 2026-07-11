## Why

`AUDITOR_INTERNO` ya puede navegar a `/dashboard` (RBAC cubierto desde M5-S01) pero `DashboardPage.tsx` no tiene una rama para el tipo `'AUDITOR'` y cae al placeholder `<ComingSoon />`. Un auditor interno necesita, desde ese dashboard, visibilidad inmediata sobre los hallazgos de auditoría (QEs de origen `O3_HALLAZGO_AUDITORIA`): dónde se concentran, en qué estado están, cuáles carecen de soporte documental, y qué áreas cierran QEs fuera de plazo — sin lo cual el rol no tiene forma de priorizar su trabajo de seguimiento desde la UI.

## What Changes

- Nuevo componente `AuditorDashboard` en `features/dashboard/pages/`, cableado en `DashboardPage.tsx` para el tipo `'AUDITOR'` (reemplaza el `<ComingSoon />` actual para ese rol).
- Widget **Hallazgos por área**: QEs `origen === 'O3_HALLAZGO_AUDITORIA'` agrupados por `areaAfectada`, conteo descendente (mismo patrón de distribución que KPI-09).
- Widget **Estado de hallazgos**: breakdown de conteo por `estado`, filtrado a `origen === 'O3_HALLAZGO_AUDITORIA'` (mismo patrón que `QEPorEstadoWidget` de M5-S05a, adaptado para navegar con el filtro `origen` además de `estado`).
- Widget **Evidencias disponibles**: conteo de hallazgos O3 con `documentosVinculados.length > 0` vs. sin ninguno — dos números, sin lista.
- Widget **Tasa de cierre en plazo por área**: `% de QE cerrados en plazo`, agrupado por `areaAfectada`, aplicado a **todos** los QE (no solo O3) — reutiliza exactamente la fórmula de KPI-01 (`calcularKpi01`/`qeCerradosEnPeriodo`/`PLAZO_MAXIMO_QE_DIAS_HABILES`, ya corregida en `m5-s01-fix-kpis-prd`), sin una fórmula nueva.
- **BREAKING** (interno, sin consumidor real hasta ahora): reemplazo completo de `AuditorDashboardData` — el placeholder actual (`hallazgosAuditoriaAbiertos`, `ncPorOrigenAuditoria`, `kpisCumplimiento`, `documentosProximaRevision`, nunca renderizado por ninguna página) se sustituye por la forma que consumen los 4 widgets de este spec.
- Enriquecimiento de fixtures: al menos 2 QE `origen O3` con `documentosVinculados` no vacío (hoy los 5 existentes tienen `documentosVinculados: []`), para que el widget de evidencias tenga contraste real con el que verificar en navegador.
- Sin cambios de RBAC/routing: `/dashboard` ya admite `AUDITOR_INTERNO` en `RoleGuard` desde M5-S01.
- **Gap de compliance documentado, fuera de alcance de este spec**: `hallazgoAuditoriaRef` (texto libre) no garantiza contener una referencia ISO/norma estructurada — un QE origen O3 puede describir un hallazgo sin ISO en absoluto (ver fixture `qe-2026-015`, "Auditoría Operacional"). Agrupar por "módulo de auditoría/normativa" (ISO_9001/ISO_45001) requeriría un campo estructurado nuevo en `QualityEvent` que no existe hoy; se documenta como pendiente para un spec correctivo de M4 (formulario de creación O3 + tipo `QualityEvent`), no se resuelve aquí. Este spec agrupa el widget 1 por `areaAfectada` en su lugar.
- Exportar evidencias para auditoría externa: diferido a S09/v1.1, documentado como gap.

## Capabilities

### New Capabilities
- `dashboard-auditor-view`: dashboard para `AUDITOR_INTERNO` — hallazgos por área, estado de hallazgos, evidencias disponibles y tasa de cierre en plazo por área, todos sobre QEs origen O3 salvo el último (transversal a todo el sistema).

### Modified Capabilities
- `dashboard-types`: `AuditorDashboardData` se reemplaza completamente por la forma que requieren los 4 widgets nuevos.
- `dashboard-msw-handlers`: `buildAuditorData()` se reescribe para calcular hallazgos por área, hallazgos por estado, evidencias disponibles y tasa de cierre en plazo por área.
- `quality-event-msw-fixtures`: al menos 2 QE `origen O3` ganan `documentosVinculados` no vacío (contraste real para el widget de evidencias).

## Impact

- **Frontend**: `src/features/dashboard/pages/DashboardPage.tsx`, nuevo `AuditorDashboard.tsx` + 4 componentes de widget nuevos (`HallazgosPorAreaWidget`, `HallazgosPorEstadoWidget`, `EvidenciasHallazgosWidget`, `TasaCierrePorAreaWidget`).
- **Tipos**: `dashboardData.types.ts` (`AuditorDashboardData`).
- **Mocks**: `dashboard.handlers.ts` (`buildAuditorData`), `quality-events.fixtures.ts` (seed de `documentosVinculados`).
- **Sin cambios**: routing/RBAC (`router/index.tsx`), `dashboardRoleMapping.ts` (ya correcto), `quality-event-types` (ver gap de compliance documentado arriba — no se toca `QualityEvent` en este spec).
- **Gaps documentados** (no se resuelven en este spec): campo estructurado `normativaVinculada`/`clausulaVinculada` para origen O3 (gap de M4, ver arriba); exportar evidencias para auditoría externa (S09/v1.1); cobertura de áreas limitada en `tasaCierreEnPlazoPorArea` para el período actual — Galpón B, Galpón C, Almacén Norte y Almacén Sur (áreas de los Supervisores mock) no aparecen mientras `AREAS_ROTACION` (M5-S05b, `quality-events.fixtures.ts`) las excluya deliberadamente para no romper `useDashboardSummary.test.ts` (ver `design.md` → Risks/Trade-offs).
