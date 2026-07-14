## 1. Fix de fixtures (bloqueante para KPI-03/KPI-09)

- [x] 1.1 En `src/mocks/fixtures/quality-events.fixtures.ts`, agregar `fechaCierre` top-level a `qe-2026-004` (`2025-12-15T10:00:00Z`), `qe-2026-008` (`2026-06-25T10:00:00Z`), `qe-2026-009` (`2026-01-20T10:00:00Z`), `qe-2026-010` (`2025-11-15T10:00:00Z`), `qe-2026-016` (`2026-03-15T10:00:00Z`), `qe-2026-020` (`2026-05-20T10:00:00Z`), `qe-2026-021` (`2026-07-04T10:00:00Z`).
- [x] 1.2 Cambiar `severidad` de `qe-2026-020` de `'BAJA'` a `'CRITICA'` (único QE `CRITICA` cerrado/verificado del seed; necesario para que KPI-09 deje de ser estructuralmente `0`).
- [x] 1.3 Correr la suite de fixtures/handlers existente (`quality-events.fixtures`, `dashboard.handlers.test.ts`) y confirmar que ningún test que dependa de conteos por severidad o por `estado` se rompe por el cambio de 1.2.

## 2. Tipos (`dashboard-types`)

- [x] 2.1 En `src/features/dashboard/types/dashboardData.types.ts`, agregar `qePorEstado: Record<QEStatus, number>` y `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]` a `JefeCalidadDashboardData`.

## 3. MSW handler (`dashboard-msw-handlers`)

- [x] 3.1 En `src/mocks/handlers/dashboard.handlers.ts`, extender `buildJefeCalidadData` para calcular `qePorEstado` (reduce sobre `getQeStore()` completo por las 9 claves de `QEStatus`, inicializando todas a `0`).
- [x] 3.2 En la misma función, calcular `accionesCorrectivasPorVencer` con `collectACsWithOrigin(qes, ncs, [])` (incidentes vacío a propósito) filtrando `ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA'` y `calcularDiasHabilesRestantes(...) <= 5` (reutilizar `calcularEstadoSemaforoFila`/`calcularDiasHabilesRestantes` de `dashboard/utils/semaforoPendientes.ts` y `utils/businessDays.ts` — no reimplementar el cálculo).
- [x] 3.3 Actualizar `dashboard.handlers.test.ts` con casos para: `qePorEstado` sin filtro de área/usuario para `JEFE_CALIDAD_SYST`; `accionesCorrectivasPorVencer` excluye origen `INCIDENTE`; incluye vencidas (`ROJO`) y próximas (`AMARILLO`) sin comparar contra un valor puntual de `estado`.

## 4. i18n

- [x] 4.1 Agregar namespace `dashboard.jefeCalidad` en `src/i18n/es-PE.json` y `en-US.json`: `title`, `kpis.title`, `qePorEstado.title`, `qePorEstado.estados.<cada uno de los 9 QEStatus>`, `acsPorVencer.title`, `acsPorVencer.empty`.

## 5. Componentes/widgets nuevos

- [x] 5.1 Crear `src/features/dashboard/components/KpiGridWidget.tsx` (+ test): recibe `kpis: KpiResult[]`, renderiza 9 tarjetas usando `KPI_DEFINITIONS` para nombre/unidad, formatea `valor`/`meta` según `unidad`, colorea por `semaforo` (VERDE→success/teal, AMARILLO→warning/amber, ROJO→error), con `dark:` en cada clase.
- [x] 5.2 Crear `src/features/dashboard/components/QEPorEstadoWidget.tsx` (+ test): recibe `qePorEstado: Record<QEStatus, number>`, renderiza 9 filas con `QEStatusBadge`, filas `ANALISIS_COMPLETADO` y `PENDIENTE_CIERRE` navegan a `/quality-events?estado=<estado>` vía `useNavigate`, el resto no son clicables.
- [x] 5.3 Crear `src/features/dashboard/components/ACsPorVencerWidget.tsx` (+ test): recibe `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]`, separa por `calcularEstadoSemaforoDesdeFecha` en subconjunto `ROJO` (renderizado con `SemaforoCriticoBanner`) y `AMARILLO` (renderizado con `SemaforoRow`, mismo `ORIGEN_ROUTE` que `MisACsWidget`/`ACsVencidasWidget`), estado vacío centrado cuando ambos subconjuntos están vacíos.

## 6. Página y wiring

- [x] 6.1 Crear `src/features/dashboard/pages/JefeCalidadDashboard.tsx` (+ test): usa `useDashboardSummary()`, esqueleto de carga mientras `isLoading || !data || data.rol !== 'JEFE_CALIDAD'`, renderiza `KpiGridWidget`, `QEPorEstadoWidget`, `ACsPorVencerWidget` con los datos de `data.data`.
- [x] 6.2 En `src/features/dashboard/pages/DashboardPage.tsx`, agregar rama `if (dashboardType === 'JEFE_CALIDAD') return <JefeCalidadDashboard />` antes del fallback `ComingSoon`.
- [x] 6.3 Actualizar `DashboardPage.test.tsx` con casos para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` renderizando `JefeCalidadDashboard`.

## 7. Documentación y verificación cruzada

- [x] 7.1 Actualizar la tabla de "Páginas de referencia visual" en `CLAUDE.md`: `SemaforoCriticoBanner` deja de estar exclusivamente en `/dev/semaforo-preview` (ya tiene consumidor real en `ACsPorVencerWidget`); dejar nota de qué queda igual (`SemaforoRow` standalone) y qué cambió.
- [x] 7.2 Levantar la app con `VITE_ENABLE_MSW=true`, iniciar sesión como `JEFE_CALIDAD_SYST` y como `JEFE_CONTROL_DOCUMENTARIO`, y verificar en navegador: los 9 KPIs con valores distintos de cero para KPI-03/KPI-09, las 9 filas de estado con conteos correctos, el banner crítico y las filas de semáforo del widget de ACs por vencer, y la navegación de las filas `ANALISIS_COMPLETADO`/`PENDIENTE_CIERRE` hacia `/quality-events` filtrado.
- [x] 7.3 Confirmar que ningún dato de `JefeCalidadDashboard` está filtrado por `usuario.id` o `usuario.area` (alcance organizacional completo, a diferencia de `OperarioDashboard`/`SupervisorDashboard`).
- [x] 7.4 Correr typecheck, lint y la suite completa de tests del proyecto (`npm run typecheck`, `npm run lint`, `npm test`) antes de dar la spec por completa.
