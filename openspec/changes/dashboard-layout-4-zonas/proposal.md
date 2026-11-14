## Why

Los seis dashboards de rol muestran la información clave, pero apilan todos los widgets en una sola columna (`space-y-8`) y los KPIs en tarjetas planas de hasta 3 columnas, sin meta visual ni tendencia. A 1280 px el Jefe de Calidad tiene que hacer scroll para llegar a lo que requiere atención. Toño aprobó una maqueta (`Claude outputs/SHAC-Dashboard-Combinado.html`) con un layout común de 4 zonas, KPIs en anillo y un filtro de período.

## What Changes

- Nuevo layout común `DashboardLayout` con 4 zonas en orden fijo: **Requiere atención** (tarjetas de alerta), **Indicadores** (KPIs en anillo con selector de período), **Mi trabajo y contexto** (2/3 + 1/3) y **Dónde ocurre** (mapa de calor). Una zona sin contenido no se renderiza.
- Nuevos componentes base: `AlertaCard`, `KpiRingCard` (anillo SVG contra la meta, variación ▲▼ contra el período anterior y minigráfico de 6 meses), `PeriodoSelector` (Mes / Trimestre / Año en `?periodo=`).
- `KpiGridWidget` y `KpisEjecutivosWidget` pasan a ser grillas de `KpiRingCard` alimentadas por `GET /api/dashboard/kpis?periodo=…` (no por el summary). El Jefe de Calidad ve los 6 KPIs de la maqueta en anillo (KPI-01, 02, 03, 05, 06 y 07). KPI-08 pasa a la alerta "AC vencidas". **BREAKING (visual):** KPI-04 y KPI-09 dejan de mostrarse como tarjeta en el dashboard del JCA.
- Los seis dashboards de rol (`Operario`, `Supervisor`, `JefeCalidad`, `JefeControlDocumentario`, `Auditor`, `AltaDireccion`) se recomponen sobre `DashboardLayout`. Cada rol llena las zonas con sus widgets actuales y con 2 a 4 alertas calculadas con datos que ya llegan. Los widgets reubicados conservan su lógica y solo cambian de contenedor.
- **Backend** `GET /api/dashboard/kpis`: `periodo` acepta `yyyy-MM`, `yyyy-Qn` o `yyyy`; por defecto, el mes actual en hora de Lima; un formato inválido devuelve 400. `ValorPeriodoAnterior` se calcula para el período equivalente anterior. KPI-04 suma las horas de los meses del período y marca `datosIncompletos` si falta alguno.
- **Backend** summary: `AltaDireccion` incorpora `tendenciaMensualKpis`, y `JefeControlDoc` deja de ser `{}` y trae los conteos de revisión periódica vencida y próxima (30 días o menos).
- MSW replica los tres formatos de `periodo`, `valorPeriodoAnterior`, `datosIncompletos` y los campos nuevos del summary.
- i18n `dashboard`: claves `layout.*`, `kpi.meta`, `kpi.datosIncompletos` y `alertas.*` por rol, en es-PE y en-US.

## Capabilities

### New Capabilities
- `dashboard-layout`: el layout de 4 zonas y sus componentes base (`DashboardLayout`, `AlertaCard`, `KpiRingCard` y `PeriodoSelector`), con el cálculo del avance contra la meta, la variación y el minigráfico.

### Modified Capabilities
- `be-dashboard-api`: `GET /api/dashboard/kpis` acepta período mensual, trimestral o anual, calcula `valorPeriodoAnterior` y `datosIncompletos`, y valida el formato. El resumen de ALTA_DIRECCION suma `tendenciaMensualKpis` y el de JEFE_CONTROL_DOC suma conteos de revisión.
- `dashboard-types`: `KpiResult.datosIncompletos`, `KpiDefinition.direccion`, `KpiPeriodoTipo`, `tendenciaMensualKpis` en ALTA_DIRECCION y conteos en `JefeControlDocDashboardData`.
- `dashboard-query-hooks`: `useDashboardKpis` recibe el período derivado de la URL y lo incluye en la queryKey.
- `dashboard-msw-handlers`: `/api/dashboard/kpis` acepta los tres formatos de período, y el summary trae los campos nuevos.
- `dashboard-jefecalidad-view`: los KPIs en anillo (6) desde el endpoint de KPIs, y la composición en 4 zonas.
- `dashboard-altadireccion-view`: la composición en 4 zonas, y `KpisEjecutivosWidget` con anillos.
- `dashboard-supervisor-view`: la composición en 4 zonas, con alertas.
- `dashboard-operario-view`: la composición en 4 zonas, con alertas.
- `dashboard-auditor-view`: la composición en 4 zonas, con alertas.
- `dashboard-jefecontroldoc-view`: alertas de revisión periódica, además de las acciones requeridas.
- `dashboard-acciones-requeridas`: `AccionesRequeridasWidget` deja de ser el primer elemento de la página y pasa a la columna principal de "Mi trabajo y contexto".

## Impact

- **Frontend:** `features/dashboard/components/layout/` (nuevo); `KpiGridWidget`, `KpisEjecutivosWidget` y el contenedor de los widgets reubicados; las 6 páginas `*Dashboard.tsx` y sus tests; `kpi.types.ts`, `kpi.constants.ts`, `dashboardData.types.ts`, `useDashboardKpis` y `dashboardQueryKeys`; `i18n/es-PE.json` y `en-US.json`.
- **MSW:** `mocks/handlers/dashboard.handlers.ts` y su test.
- **Backend:** `ObtenerKpisEndpoint`/`Handler`, `DashboardKpiCalculator` (cálculo por rango), `KpiModels` (`DatosIncompletos`), `DashboardSummaryDtos`/`Builder`/`Handler` (ALTA_DIRECCION y JEFE_CONTROL_DOC), y tests de dashboard.
- **Sin migración.** Sin cambios en otros módulos.
- **Depende de** `pendientes-qe-asignacion-y-menus` (tipos `QE_APROBAR_CAUSA_RAIZ`, `QE_CERRAR`, `QE_FIRMAR_CIERRE` y `QE_VERIFICAR` de `useAccionesRequeridas`).
