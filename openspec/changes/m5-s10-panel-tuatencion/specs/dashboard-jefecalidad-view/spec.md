## ADDED Requirements

### Requirement: AccionesRequeridasWidget es el primer widget de JefeCalidadDashboard
`JefeCalidadDashboard.tsx` SHALL montar `AccionesRequeridasWidget` como el primer elemento visible, antes de `KpiGridWidget`, fuera del bloque condicional de `isLoading`/`data.rol !== 'JEFE_CALIDAD'` — el widget gestiona su propio estado de carga de forma independiente de `useDashboardSummary()`.

Con la introducción de `JefeControlDocumentarioDashboard` (`dashboard-jefecontroldoc-view`) y el fix de `dashboardRoleMapping.ts` (`dashboard-types`), `JefeCalidadDashboard` deja de ser el dashboard que ve `JEFE_CONTROL_DOCUMENTARIO` — el rol objetivo de esta página vuelve a ser exclusivamente `JEFE_CALIDAD_SYST`.

#### Scenario: Widget visible antes de que carguen los KPIs
- **WHEN** `JefeCalidadDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga de `KpiGridWidget`

#### Scenario: Widget precede a KpiGridWidget en el árbol renderizado
- **WHEN** `data.rol === 'JEFE_CALIDAD'` y los datos ya cargaron
- **THEN** `AccionesRequeridasWidget` aparece antes que `KpiGridWidget` en el DOM
