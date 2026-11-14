## MODIFIED Requirements

### Requirement: AccionesRequeridasWidget es el primer widget en 5 de los 6 dashboards de rol
`AccionesRequeridasWidget` SHALL montarse como el primer widget de la columna principal de la zona "Mi trabajo y contexto" de `DashboardLayout` (`dashboard-layout`) en `OperarioDashboard.tsx`, `SupervisorDashboard.tsx`, `AltaDireccionDashboard.tsx` y `AuditorDashboard.tsx`, después de la zona de alertas y de la de indicadores, y fuera del bloque condicional de `isLoading`/`data.rol` de `useDashboardSummary()` de cada página: el widget gestiona su propio `isLoading` de forma independiente. Su contenedor SHALL tener `id="acciones-requeridas"`, destino de las alertas que enlazan a pendientes. El montaje en `JefeCalidadDashboard.tsx` y en `JefeControlDocumentarioDashboard.tsx` se cubre en sus respectivas capacidades (`dashboard-jefecalidad-view`, `dashboard-jefecontroldoc-view`).

#### Scenario: Widget visible antes de que carguen los KPIs de Operario
- **WHEN** `OperarioDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga de los demás widgets

#### Scenario: Widget es el primero de la columna principal en SupervisorDashboard
- **WHEN** se inspecciona el árbol renderizado de `SupervisorDashboard`
- **THEN** `AccionesRequeridasWidget` es el primer widget dentro de la columna principal de "Mi trabajo y contexto", antes del panel de pendientes del área
