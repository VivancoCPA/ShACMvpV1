## MODIFIED Requirements

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

## ADDED Requirements

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
