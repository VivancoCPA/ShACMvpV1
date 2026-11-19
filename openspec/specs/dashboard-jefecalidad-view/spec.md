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
- **alertas:** 4 `AlertaCard`, calculadas con la tabla `ALERTAS` de la página (`dashboard-layout`, "La tarjeta de alerta seleccionada vive en la URL"):
  - "AC vencidas" (`acVencidas`; error; selectora): `valor` = `summary.accionesCorrectivasVencidas.length`. Al hacer clic, abre la pestaña "Vencidas" de `ACsVencidasPorVencerWidget`. Ya no usa el KPI-08 del summary.
  - "Incidentes sin QE vencidos" (`incidentesSinQe`; error; selectora): `valor` = `incidentesSinQeVencidosTotal`. Al hacer clic, hace scroll a `IncidentesSinQeVencidosWidget`, que ya muestra ese total.
  - "Aprobaciones y cierres pendientes" (`aprobaciones`; warning; selectora): `valor` = `filtrarAccionesPorTipo(items, ['QE_APROBAR_CAUSA_RAIZ', 'QE_FIRMAR_CIERRE_JCA', 'QE_REGISTRAR_CIERRE']).length`, con los `items` de `useAccionesRequeridas()`. Al hacer clic, filtra `AccionesRequeridasWidget` con esos mismos tipos.
  - "QE críticos activos" (info; enlace): `valor` = `qeCriticosAbiertos.length`; lleva a `/quality-events?severidad=CRITICA`.
- **indicadores:** ver "JefeCalidadDashboard renderiza los 9 KPIs completos".
- **trabajoPrincipal:** `AccionesRequeridasWidget` (en un contenedor `id="acciones-requeridas"`) y `TendenciaMensualWidget`. Con `?alerta=aprobaciones`, el widget recibe `filtroTipos` con los tres tipos de la tarjeta, `etiquetaFiltro` = el título de la tarjeta y `onQuitarFiltro` = `limpiar`.
- **trabajoLateral:** `QEPorEstadoWidget`, `ACsVencidasPorVencerWidget` (`id="acs-vencidas-por-vencer"`) e `IncidentesSinQeVencidosWidget` (`id="incidentes-sin-qe"`).
- **mapa:** `HeatmapIncidentesWidget`.

`AccionesRequeridasWidget` SHALL montarse fuera del bloque condicional de carga del summary, porque gestiona su propio estado de carga. Mientras el summary carga, las alertas y la columna lateral muestran skeletons dentro de su zona.

`JefeCalidadDashboard` no es el dashboard que ve `JEFE_CONTROL_DOCUMENTARIO`, que tiene el suyo (`dashboard-jefecontroldoc-view`). El rol objetivo de esta página es exclusivamente `JEFE_CALIDAD_SYST`.

#### Scenario: Widget visible antes de que carguen los KPIs
- **WHEN** `JefeCalidadDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga del summary y de los KPIs

#### Scenario: Zonas del Jefe de Calidad
- **WHEN** el summary y los KPIs ya cargaron
- **THEN** se renderizan las 4 zonas, con 4 alertas, `AccionesRequeridasWidget` y `TendenciaMensualWidget` en la columna principal, y `HeatmapIncidentesWidget` en "Dónde ocurre"

#### Scenario: Aprobaciones y cierres cuenta los tres tipos
- **WHEN** `useAccionesRequeridas` devuelve 2 ítems `QE_APROBAR_CAUSA_RAIZ`, 1 `QE_FIRMAR_CIERRE_JCA`, 1 `QE_REGISTRAR_CIERRE` y 3 `QE_VERIFICAR`
- **THEN** la alerta "Aprobaciones y cierres pendientes" muestra `4`

#### Scenario: Clic en aprobaciones filtra la lista con el mismo número
- **WHEN** el usuario hace clic en "Aprobaciones y cierres pendientes", que muestra `4`
- **THEN** la URL tiene `alerta=aprobaciones`, la tarjeta tiene `aria-pressed="true"`, `AccionesRequeridasWidget` muestra exactamente 4 filas y el chip "Mostrando: Aprobaciones y cierres pendientes (4)"

#### Scenario: Más de 10 aprobaciones se muestran todas
- **WHEN** la URL tiene `?alerta=aprobaciones` y hay 13 ítems de los tres tipos
- **THEN** la lista muestra las 13 filas

#### Scenario: Quitar el filtro limpia la URL
- **WHEN** la lista está filtrada por `?alerta=aprobaciones` y el usuario pulsa el ✕ del chip
- **THEN** la URL deja de tener `alerta` y la lista vuelve a mostrar todos los pendientes, cortados en 10

#### Scenario: AC vencidas abre la pestaña Vencidas con el mismo número
- **WHEN** `summary.accionesCorrectivasVencidas` tiene 3 elementos y el usuario hace clic en "AC vencidas"
- **THEN** la tarjeta muestra `3`, la URL tiene `alerta=acVencidas`, y `ACsVencidasPorVencerWidget` muestra la pestaña "Vencidas (3)" seleccionada, con 3 filas

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

### Requirement: ACsVencidasPorVencerWidget muestra AC vencidas y por vencer en pestañas
El sistema SHALL exportar `ACsVencidasPorVencerWidget` en `src/features/dashboard/components/ACsVencidasPorVencerWidget.tsx`, con las props `{ vencidas: AccionCorrectivaResumen[]; porVencer: AccionCorrectivaResumen[]; pestana: 'vencidas' | 'porVencer'; onCambiarPestana(p): void }`. SHALL renderizar un `role="tablist"` con dos `role="tab"`, rotulados `t('dashboard:acs.tabs.vencidas', { n })` y `t('dashboard:acs.tabs.porVencer', { n })`, con `aria-selected` en la pestaña activa, y un `role="tabpanel"` con las filas de la pestaña activa. Las filas SHALL reutilizar `SemaforoRow` y navegar al detalle del origen de la AC, igual que `ACsVencidasWidget` y `ACsPorVencerWidget`. Cada contador SHALL ser el `.length` del mismo arreglo que se renderiza en esa pestaña.

`JefeCalidadDashboard` SHALL pasar:
- `vencidas` = `summary.accionesCorrectivasVencidas`;
- `porVencer` = `summary.accionesCorrectivasPorVencer` sin las que ya están vencidas (`plazoFecha >= ahora`), para que las pestañas no se solapen;
- `pestana`: `'vencidas'` si `?alerta=acVencidas`; `'porVencer'` si `?alerta=acPorVencer`; sin parámetro, `'vencidas'` si tiene ítems y `'porVencer'` si no.

Cambiar de pestaña SHALL escribir `?alerta=acVencidas` o `?alerta=acPorVencer`.

#### Scenario: Contadores coinciden con las filas
- **WHEN** el widget recibe 2 AC vencidas y 3 por vencer, con la pestaña "Vencidas" activa
- **THEN** las pestañas dicen "Vencidas (2)" y "Por vencer (3)", y el panel muestra 2 filas

#### Scenario: Cambiar de pestaña
- **WHEN** el usuario pulsa "Por vencer (3)"
- **THEN** se llama a `onCambiarPestana('porVencer')` y, en la página, la URL pasa a tener `alerta=acPorVencer` y el panel muestra 3 filas

#### Scenario: Una AC vencida no aparece en Por vencer
- **WHEN** `accionesCorrectivasPorVencer` incluye una AC con `plazoFecha` de ayer
- **THEN** esa AC no aparece en la pestaña "Por vencer"
