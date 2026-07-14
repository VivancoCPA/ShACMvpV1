## ADDED Requirements

### Requirement: JefeControlDocumentarioDashboard renderiza el panel de acciones requeridas como único contenido v1
El sistema SHALL implementar `JefeControlDocumentarioDashboard` en `src/features/dashboard/pages/JefeControlDocumentarioDashboard.tsx`, consumiendo `useDashboardSummary()` y renderizando, cuando `data.rol === 'JEFE_CONTROL_DOC'`, únicamente `AccionesRequeridasWidget` (sin KPIs, sin widgets adicionales). Mientras `isLoading || !data || data.rol !== 'JEFE_CONTROL_DOC'`, SHALL renderizar el mismo patrón de skeleton usado por los otros 5 dashboards de rol.

#### Scenario: JEFE_CONTROL_DOCUMENTARIO ve su propio dashboard
- **WHEN** un usuario con `rol: 'JEFE_CONTROL_DOCUMENTARIO'` navega a `/dashboard`
- **THEN** se renderiza `JefeControlDocumentarioDashboard`, no `JefeCalidadDashboard`

#### Scenario: Contenido v1 es solo el panel de acciones requeridas
- **WHEN** `JefeControlDocumentarioDashboard` renderiza con `data.rol === 'JEFE_CONTROL_DOC'`
- **THEN** el único widget presente es `AccionesRequeridasWidget` — no se renderiza `KpiGridWidget` ni ningún otro widget de KPI

#### Scenario: Skeleton mientras carga
- **WHEN** `useDashboardSummary()` retorna `isLoading: true`
- **THEN** `JefeControlDocumentarioDashboard` renderiza el skeleton de carga, no el contenido final

---

### Requirement: DashboardPage enruta JEFE_CONTROL_DOC a JefeControlDocumentarioDashboard
`DashboardPage.tsx` SHALL agregar una rama `if (dashboardType === 'JEFE_CONTROL_DOC') return <JefeControlDocumentarioDashboard />` antes del fallback `<ComingSoon />`.

#### Scenario: dashboardType JEFE_CONTROL_DOC renderiza el dashboard nuevo
- **WHEN** `getDashboardDataTypeForRole(user.rol)` retorna `'JEFE_CONTROL_DOC'`
- **THEN** `DashboardPage` renderiza `<JefeControlDocumentarioDashboard />`
