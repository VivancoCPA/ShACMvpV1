## Why

`JefeCalidadDashboardData` y `buildJefeCalidadData` existen desde M5-S01 pero no tienen ningún consumidor real en `/dashboard`: hoy `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` solo ven el placeholder "Próximamente" (M5-S04, routing spec). Además, KPI-03 y KPI-09 —ambos dependientes de `QualityEvent.fechaCierre`— retornan siempre `0` contra el seed actual porque ningún fixture de QE en `CERRADO`/`EN_VERIFICACION`/`VERIFICADO` tiene ese campo poblado (gap diferido desde M5-S01), lo que hace imposible verificar en navegador que el dashboard calcula valores reales. Esta spec cierra ambos gaps: entrega la primera mitad de M5-S05 (KPIs, estado de QEs, ACs por vencer) y corrige el fixture bloqueante.

**Corrección de alcance:** la propuesta original describe "8 estados" de QE y menciona "KPI-03 (tasa de reincidencia)" y "KPI-09 (NCs por área)". El enum real `QEStatus` (`quality-events/types/qualityEvent.types.ts`) tiene 9 valores (incluye `ANALISIS_COMPLETADO`; el estado terminal positivo es `VERIFICADO`, no `VERIFICADO_EFECTIVO`). Y según `KPI_DEFINITIONS` (`dashboard/constants/kpi.constants.ts`), KPI-03 es "Tiempo Promedio de Cierre de Quality Events" y KPI-09 es "Cumplimiento de Firma Dual en Cierre de QE Críticos"; la tasa de reincidencia es KPI-07 (no depende de `fechaCierre`) y no existe un KPI de "NCs por área". El fix de datos sigue siendo necesario porque KPI-03 y KPI-09 sí dependen de `fechaCierre`, solo se corrige la etiqueta. Este spec usa los 9 valores reales de `QEStatus` y las fórmulas reales de KPI-03/KPI-09.

## What Changes

- Agregar `qePorEstado: Record<QEStatus, number>` y `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]` a `JefeCalidadDashboardData` (tipos).
- Extender `buildJefeCalidadData` (MSW handler) para poblar ambos campos nuevos con alcance organizacional completo (sin filtro por usuario ni área): `qePorEstado` cuenta todos los QE del sistema por cada uno de los 9 `QEStatus`; `accionesCorrectivasPorVencer` agrega ACs de origen `QE` y `NC` (no incidentes) cuyo estado no sea terminal (`CERRADA`/`COMPLETADA`) y cuyo `plazoFecha` esté a 5 días hábiles o menos (incluye vencidas), replicando el patrón agnóstico al enum ya corregido en `buildSupervisorData` — nunca comparar contra un valor puntual como `EN_EJECUCION`.
- Poblar `fechaCierre` en los 7 fixtures de QE (`qe-2026-004`, `008`, `009`, `010`, `016`, `020`, `021`) en estado `CERRADO`/`EN_VERIFICACION`/`VERIFICADO` que hoy carecen de ese campo top-level, con fechas plausibles (posteriores a `causaRaizFirmadaEn`, anteriores a `fechaVerificacionProgramada`/`fechaVerificacionRealizada` cuando existan).
- Adicionalmente, ninguno de esos 7 registros tiene `severidad: 'CRITICA'` (los únicos QE `CRITICA` del seed están en `ABIERTO`/`EN_INVESTIGACION`), por lo que poblar solo `fechaCierre` no basta para desbloquear KPI-09 (requiere un QE `CRITICA` cerrado/verificado con `cierreFirmaSupervisorId`). Se cambia `severidad` de `qe-2026-020` (`CERRADO`, sin dependencias en tests existentes) de `BAJA` a `CRITICA` para que exista al menos un caso real.
- Construir `JefeCalidadDashboard` (página nueva) con 3 widgets: grid de los 9 KPIs (primer consumidor real de `KpiResult[]`/`KPI_DEFINITIONS` en UI), desglose de QEs por estado (9 filas con conteo, navegables a `/quality-events?estado=<estado>`), y ACs por vencer en 5 días (primer consumidor real de `SemaforoCriticoBanner` para las vencidas + `SemaforoRow` para las próximas a vencer).
- Wiring: `DashboardPage` renderiza `JefeCalidadDashboard` para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` (mismo tipo de datos, ver `dashboard-types`); deja de mostrarles el placeholder "Próximamente".
- Las acciones "Aprobar análisis" y "Firmar cierres" del PRD se resuelven como navegación desde las filas de `qePorEstado` (`ANALISIS_COMPLETADO`→revisión de análisis, `PENDIENTE_CIERRE`→firma) hacia `/quality-events?estado=...`, reutilizando el filtro de estado que `QEList` ya soporta desde M4. "Gestionar plazos" se resuelve con el `onClick` por fila del widget de ACs por vencer, hacia el detalle del QE/NC de origen. Ninguna lógica nueva de aprobación/firma/plazos se implementa en el dashboard.

## Capabilities

### New Capabilities
- `dashboard-jefecalidad-view`: página `JefeCalidadDashboard` y sus 3 widgets (KPIs, QEs por estado, ACs por vencer), consumidos por `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` en `/dashboard`.

### Modified Capabilities
- `dashboard-types`: `JefeCalidadDashboardData` agrega `qePorEstado` y `accionesCorrectivasPorVencer`.
- `dashboard-msw-handlers`: `buildJefeCalidadData` calcula los 2 campos nuevos con alcance global (sin filtro de usuario/área).
- `quality-event-msw-fixtures`: 7 fixtures de QE cerrados/verificados ganan `fechaCierre` top-level, hoy ausente.
- `routing`: `/dashboard` renderiza `JefeCalidadDashboard` (no el placeholder) para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO`; `AUDITOR_INTERNO` y `ALTA_DIRECCION` siguen viendo el placeholder hasta S06/S07.

## Impact

- `src/features/dashboard/types/dashboardData.types.ts`, `src/mocks/handlers/dashboard.handlers.ts`, `src/mocks/handlers/dashboard.handlers.test.ts`.
- `src/mocks/fixtures/quality-events.fixtures.ts` (solo agrega `fechaCierre`, sin cambiar `estado` ni otros campos).
- Nuevo: `src/features/dashboard/pages/JefeCalidadDashboard.tsx` (+ test), `src/features/dashboard/components/KpiGridWidget.tsx`, `QEPorEstadoWidget.tsx`, `ACsPorVencerWidget.tsx` (+ tests cada uno).
- `src/features/dashboard/pages/DashboardPage.tsx` (agrega rama `JEFE_CALIDAD`).
- `src/i18n/es-PE.json`, `src/i18n/en-US.json` (namespace `dashboard`, sección `jefeCalidad`).
- No cambia `RoleGuard` ni `router/index.tsx` (RBAC de `/dashboard` ya cubre ambos roles desde M5-S01).
- Fuera de alcance (gaps explícitos, no bloquean esta spec): tendencia mensual de cierres (`tendenciaMensualCierres`, ya en el tipo, diferida a M5-S05b), exportar informe ejecutivo (M5-S09/v1.1), y los widgets de `qeCriticosAbiertos`/`ncPendientesVerificacion`/`distribucionQEPorTipo` (campos ya existentes en el tipo desde S01 pero sin consumidor en ninguna spec hasta ahora — no se agregan en S05a por no estar en el alcance funcional pedido; quedan como gap para S05b o una spec de ajuste).
