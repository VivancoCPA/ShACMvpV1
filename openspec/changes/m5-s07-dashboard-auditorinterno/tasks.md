## 1. Tipos — AuditorDashboardData

- [x] 1.1 Reemplazar `AuditorDashboardData` en `src/features/dashboard/types/dashboardData.types.ts` por `{ hallazgosPorArea: { area: string; total: number }[]; hallazgosPorEstado: Record<QEStatus, number>; evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }; tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[] }`, eliminando los 4 campos placeholder (`hallazgosAuditoriaAbiertos`, `ncPorOrigenAuditoria`, `kpisCumplimiento`, `documentosProximaRevision`).
- [x] 1.2 Confirmar que ningún otro archivo referencia los campos eliminados (`grep` de `hallazgosAuditoriaAbiertos`, `ncPorOrigenAuditoria`, `kpisCumplimiento`, `documentosProximaRevision`) antes de continuar.

## 2. Fixtures — evidencia en QE origen O3

- [x] 2.1 En `src/mocks/fixtures/quality-events.fixtures.ts`, agregar `documentosVinculados` no vacío (IDs existentes de `documents.fixtures.ts`, p.ej. `doc-001`/`doc-002`) a 2 de los 5 QE `origen: 'O3_HALLAZGO_AUDITORIA'` (`qe-2026-003`, `007`, `011`, `015`, `019`), dejando al menos 2 sin ninguno.
- [x] 2.2 Confirmar que los IDs usados existen en `documents.fixtures.ts` (no inventar documentos nuevos).

## 3. Backend mock — buildAuditorData

- [x] 3.1 En `src/mocks/handlers/dashboard.handlers.ts`, reescribir `buildAuditorData()`: filtrar QE `origen === 'O3_HALLAZGO_AUDITORIA'` y calcular `hallazgosPorArea` (mismo patrón `Map<area, count>` → `.sort((a,b) => b.total - a.total)` que `calcularKpi09`) y `hallazgosPorEstado` (`Record<QEStatus, number>` inicializado en 0 para los 9 estados, no disperso).
- [x] 3.2 Calcular `evidenciasHallazgos` sobre el mismo subconjunto O3: `conEvidencia` = QE con `documentosVinculados.length > 0`, `sinEvidencia` = el resto.
- [x] 3.3 Calcular `tasaCierreEnPlazoPorArea` sobre **todos** los QE del período actual (`currentPeriodo()`/`monthRange()`), reutilizando `qeCerradosEnPeriodo` y `PLAZO_MAXIMO_QE_DIAS_HABILES` (mismas funciones/tabla que `calcularKpi01`), agrupado por `areaAfectada`; excluir áreas sin ningún QE cerrado en el período; ordenar ascendentemente por `tasaCierreEnPlazo`.
- [x] 3.4 Escribir/actualizar tests en `dashboard.handlers.test.ts` cubriendo: filtro por origen en los 3 primeros campos, `hallazgosPorEstado` sin claves ausentes, `evidenciasHallazgos` ignora `evidenciaUrl` de ACs, `tasaCierreEnPlazoPorArea` sin filtro de origen, exclusión de áreas sin cerrados, y el orden ascendente.

## 4. Componentes — widgets de Auditor Interno

- [x] 4.1 Crear `HallazgosPorAreaWidget.tsx` (lista no interactiva de área + conteo, estado vacío si `hallazgosPorArea` está vacío).
- [x] 4.2 Crear `HallazgosPorEstadoWidget.tsx` (9 filas por `QEStatus`, todas navegables a `/quality-events?estado=${estado}&origen=O3_HALLAZGO_AUDITORIA`, mismo estilo visual que `QEPorEstadoWidget` pero componente propio — no modificar el compartido).
- [x] 4.3 Crear `EvidenciasHallazgosWidget.tsx` (2 números o barra simple con/sin evidencia, sin lista ni navegación).
- [x] 4.4 Crear `TasaCierrePorAreaWidget.tsx` (lista informativa no interactiva: área, porcentaje, total cerrados).
- [x] 4.5 Test unitario por widget cubriendo su escenario principal y su estado vacío (donde aplique).

## 5. Página y routing

- [x] 5.1 Crear `AuditorDashboard.tsx` en `src/features/dashboard/pages/` (patrón de `AltaDireccionDashboard.tsx`: `useDashboardSummary()`, guard de `isLoading`/`data.rol !== 'AUDITOR'` con `WidgetSkeleton` x4, composición de los 4 widgets en `space-y-8` dentro de `PageWrapper`).
- [x] 5.2 Cablear en `src/features/dashboard/pages/DashboardPage.tsx` la rama `if (dashboardType === 'AUDITOR') return <AuditorDashboard />` (reemplaza el fallback `<ComingSoon />` para ese tipo).
- [x] 5.3 Test de `DashboardPage.test.tsx`/`AuditorDashboard.test.tsx` cubriendo el guard de carga y la composición de los 4 widgets.

## 6. i18n

- [x] 6.1 Agregar claves nuevas del namespace `dashboard` en `es-PE.json` y `en-US.json` para: título de la página, los 4 widgets, estados vacíos.

## 7. Verificación

- [x] 7.1 `npm run typecheck` / `npm run test` sin errores nuevos.
- [x] 7.2 Browser verification: iniciar sesión con `auditor@shac.pe` / `Shac2025!`, navegar a `/dashboard`, confirmar los 4 widgets con datos reales del seed (Light y Dark mode), incluyendo el contraste con/sin evidencia del widget 3.
- [x] 7.3 Confirmar que la tasa de cierre en plazo por área (widget 4) usa `fechaCierre` real y el plazo por severidad (no un umbral plano ni `actualizadoEn`) — mismo criterio ya corregido en `m5-s06-dashboard-altadireccion`.
- [x] 7.4 Confirmar que otros roles (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION`) no cambian de comportamiento en `/dashboard`.
