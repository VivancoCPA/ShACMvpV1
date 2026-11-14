# Spec: dashboard-jefecalidad-view

## Purpose

Define the `JefeCalidadDashboard` page: how it renders the 9 system KPIs (`KpiResult[]`) for the `JEFE_CALIDAD_SYST` / `JEFE_CONTROL_DOCUMENTARIO` roles, including per-`unidad` value formatting, semaforo-driven visual treatment (light/dark mode), and the special-cased rendering for `KPI-04` (`metaTipo: 'REDUCCION_INTERANUAL'`) and `KPI-09` (`semaforo: 'INFORMATIVO'`, area distribution).

---

## Requirements

### Requirement: JefeCalidadDashboard renderiza los 9 KPIs completos
El sistema SHALL implementar `JefeCalidadDashboard` en `src/features/dashboard/pages/JefeCalidadDashboard.tsx` sobre `DashboardLayout` (`dashboard-layout`). La zona "Indicadores" SHALL renderizar `KpiGridWidget` con los `KpiResult` de `useDashboardKpis(periodo)` (con `periodo` de `usePeriodoKpi()`, no del summary), y `PeriodoSelector` a la derecha del label. `KpiGridWidget` SHALL recibir la lista de KPIs a mostrar y renderizar una `KpiRingCard` por cada uno, en el orden dado, sin `<section>` ni `h2` propios (el label lo pone la zona). El JCA SHALL ver 6 anillos, en este orden: KPI-01, KPI-02, KPI-03, KPI-05, KPI-07 y KPI-06. KPI-08 se muestra como alerta ("AC vencidas") y KPI-04 y KPI-09 no se muestran como tarjeta en este dashboard (ver `design.md` D7). Cada `KpiRingCard` SHALL recibir como `tendencia` los últimos 6 valores de `tendenciaMensualKpis[kpiId]` del summary, cuando existen. El valor SHALL formatearse según `unidad` (`PORCENTAJE` con `%`, `DIAS` con sufijo de días, `TASA` con 2 decimales, `CONTEO` como entero), en Light Mode y en Dark Mode. Mientras `useDashboardKpis` carga por primera vez, la zona SHALL mostrar 6 skeletons del tamaño de la tarjeta.

#### Scenario: Se renderizan los 6 anillos en orden
- **WHEN** `useDashboardKpis` resuelve con los 9 `KpiResult`
- **THEN** la zona "Indicadores" tiene exactamente 6 tarjetas, para KPI-01, KPI-02, KPI-03, KPI-05, KPI-07 y KPI-06, en ese orden

#### Scenario: Valor de KPI en PORCENTAJE se formatea con símbolo
- **WHEN** KPI-01 tiene `valor: 87.5`
- **THEN** el centro del anillo muestra el valor con el símbolo `%`

#### Scenario: Semáforo ROJO se refleja visualmente
- **WHEN** un `KpiResult` tiene `semaforo: 'ROJO'`
- **THEN** el arco de su anillo usa el color semántico de error

#### Scenario: Minigráfico desde la tendencia del summary
- **WHEN** el summary trae `tendenciaMensualKpis['KPI-01']` con 12 entradas
- **THEN** la tarjeta de KPI-01 dibuja un minigráfico con los 6 últimos valores, y la de KPI-06 (sin serie) no dibuja minigráfico

#### Scenario: El período elegido cambia los KPIs consultados
- **WHEN** la URL tiene `?periodo=anio` y el año actual en Lima es 2026
- **THEN** `JefeCalidadDashboard` consulta `GET /api/dashboard/kpis?periodo=2026`

### Requirement: AccionesRequeridasWidget es el primer widget de JefeCalidadDashboard
`JefeCalidadDashboard.tsx` SHALL componer `DashboardLayout` así:
- **alertas:** 4 `AlertaCard`, según `design.md` D9: "AC vencidas" (error; KPI-08 de `data.data.kpis` del summary; `#acs-por-vencer`), "Incidentes sin QE vencidos" (error; `incidentesSinQeVencidosTotal`; `#incidentes-sin-qe`), "Esperan mi firma o aprobación" (warning; ítems `QE_APROBAR_CAUSA_RAIZ` y `QE_CERRAR` de `useAccionesRequeridas`; `#acciones-requeridas`) y "QE críticos activos" (info; `qeCriticosAbiertos.length`; `/quality-events?severidad=CRITICA`);
- **indicadores:** ver "JefeCalidadDashboard renderiza los 9 KPIs completos";
- **trabajoPrincipal:** `AccionesRequeridasWidget` (en un contenedor `id="acciones-requeridas"`) y `TendenciaMensualWidget`;
- **trabajoLateral:** `QEPorEstadoWidget`, `ACsPorVencerWidget` (`id="acs-por-vencer"`) e `IncidentesSinQeVencidosWidget` (`id="incidentes-sin-qe"`);
- **mapa:** `HeatmapIncidentesWidget`.

`AccionesRequeridasWidget` SHALL montarse fuera del bloque condicional de carga del summary (gestiona su propio estado de carga). Mientras el summary carga, las alertas y la columna lateral muestran skeletons dentro de su zona.

Con la introducción de `JefeControlDocumentarioDashboard` (`dashboard-jefecontroldoc-view`) y el fix de `dashboardRoleMapping.ts` (`dashboard-types`), `JefeCalidadDashboard` deja de ser el dashboard que ve `JEFE_CONTROL_DOCUMENTARIO`: el rol objetivo de esta página vuelve a ser exclusivamente `JEFE_CALIDAD_SYST`.

#### Scenario: Widget visible antes de que carguen los KPIs
- **WHEN** `JefeCalidadDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga del summary y de los KPIs

#### Scenario: Zonas del Jefe de Calidad
- **WHEN** el summary y los KPIs ya cargaron
- **THEN** se renderizan las 4 zonas, con 4 alertas, `AccionesRequeridasWidget` y `TendenciaMensualWidget` en la columna principal, y `HeatmapIncidentesWidget` en "Dónde ocurre"

#### Scenario: Alerta de firmas cuenta solo aprobar causa raíz y cerrar
- **WHEN** `useAccionesRequeridas` devuelve 2 ítems `QE_APROBAR_CAUSA_RAIZ`, 1 `QE_CERRAR` y 3 `QE_VERIFICAR`
- **THEN** la alerta "Esperan mi firma o aprobación" muestra `3`

#### Scenario: Alerta en cero
- **WHEN** `qeCriticosAbiertos` está vacío
- **THEN** la alerta "QE críticos activos" se muestra neutra, con "Todo en orden"

### Requirement: JefeCalidadDashboard monta el punto de entrada de exportación ejecutiva
`JefeCalidadDashboard.tsx` SHALL montar `ExportButton` (`dashboard-export-ejecutivo`) dentro de `PageWrapper`, visible solo para `JEFE_CALIDAD_SYST`, sin alterar el orden ni comportamiento de `AccionesRequeridasWidget` ni `KpiGridWidget` existentes.

#### Scenario: ExportButton visible en JefeCalidadDashboard
- **WHEN** un usuario `JEFE_CALIDAD_SYST` visualiza `JefeCalidadDashboard` con datos cargados
- **THEN** `ExportButton` está presente en la página

#### Scenario: Widgets existentes no cambian de orden ni comportamiento
- **WHEN** se agrega `ExportButton` a `JefeCalidadDashboard`
- **THEN** `AccionesRequeridasWidget` sigue siendo el primer widget visible y `KpiGridWidget` sigue renderizando las 9 tarjetas de KPI sin cambios

### Requirement: Widget "Incidentes sin QE vencidos"
`JefeCalidadDashboard` SHALL incluir `IncidentesSinQeVencidosWidget`, alimentado por `incidentesSinQeVencidos` e `incidentesSinQeVencidosTotal` del resumen JEFE_CALIDAD. El tipo `JefeCalidadDashboardData` del frontend SHALL declarar ambos campos.

Cada fila del widget SHALL mostrar:
- el número;
- el tipo (traducido);
- "Vencido hace {{duracion}}", calculado con `getIncidentQEPlazoInfo`;
- un enlace a `/incidents/{id}`.

Sin elementos, SHALL mostrar `dashboard:incidentesSinQeVencidos.empty`. Los textos usan `t('dashboard:incidentesSinQeVencidos.*')` y el widget funciona en modo claro y oscuro.

#### Scenario: Widget con datos
- **WHEN** el resumen trae 2 incidentes sin QE vencidos
- **THEN** el widget muestra 2 filas con número, tipo y "Vencido hace …", y cada fila enlaza a su detalle

#### Scenario: Widget vacío
- **WHEN** `incidentesSinQeVencidos` está vacío
- **THEN** el widget muestra "No hay incidentes con el plazo vencido."
