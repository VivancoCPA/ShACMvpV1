# Spec: incident-list-view (delta)

## Purpose

Extiende el requisito de `IncidentListPage` para agregar navegación por pestañas Lista / Mapa, con estado de tab persistido en URL param `view` y los filtros activos propagados a ambas vistas.

---

## MODIFIED Requirements

### Requirement: IncidentListPage renders the M3 module entry view
The system SHALL render an `IncidentListPage` component at the `/incidents` route that composes `IncidentList` and `IncidentMapView` wrapped in a `PageWrapper` with the title from `t('incidents:list.title')`. The page header SHALL include two tab buttons — "Lista" and "Mapa" — that set the URL search param `view` to `list` and `map` respectively. The default value of `view` SHALL be `list`. When `view=list`, `IncidentList` SHALL be rendered. When `view=map`, `IncidentMapView` SHALL be rendered. A "Nuevo incidente" button with ícono `Plus` SHALL be visible only for users whose `UserRole` is `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST`. The button SHALL navigate to `/incidents/nuevo`. `IncidentList` SHALL be wrapped in an `ErrorBoundary` and `Suspense` so filter controls remain interactive when the list fails. `IncidentMapView` SHALL also be wrapped in its own `ErrorBoundary`.

#### Scenario: Authorized user sees the Nuevo incidente button
- **WHEN** a user with role `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST` renders `IncidentListPage`
- **THEN** a "Nuevo incidente" button is visible in the page header

#### Scenario: Unauthorized user does not see the Nuevo incidente button
- **WHEN** a user with role `AUDITOR_INTERNO` or `ALTA_DIRECCION` renders `IncidentListPage`
- **THEN** no "Nuevo incidente" button appears in the page header

#### Scenario: List error does not unmount filter controls
- **WHEN** `IncidentList` throws an error caught by its `ErrorBoundary`
- **THEN** the FilterBar and page header remain mounted and interactive

#### Scenario: Default view is Lista when no view param is present
- **WHEN** `IncidentListPage` renders with no `view` search param in the URL
- **THEN** the "Lista" tab is active and `IncidentList` is rendered; `IncidentMapView` is not rendered

#### Scenario: Clicking Mapa tab switches to map view
- **WHEN** the user clicks the "Mapa" tab button
- **THEN** the URL param `view=map` is set, `IncidentMapView` is rendered, and `IncidentList` is not rendered

#### Scenario: Clicking Lista tab returns to list view
- **WHEN** the URL contains `view=map` and the user clicks the "Lista" tab
- **THEN** the URL param `view=list` is set, `IncidentList` is rendered, and `IncidentMapView` is not rendered

#### Scenario: Switching tabs preserves active filters
- **WHEN** the URL contains `tipo=ACCIDENTE&estado=ABIERTO&view=list` and the user clicks "Mapa"
- **THEN** the URL becomes `tipo=ACCIDENTE&estado=ABIERTO&view=map` (only `view` changes)

#### Scenario: Active tab has visually distinct style
- **WHEN** `view=map` is active in the URL
- **THEN** the "Mapa" tab button has an active visual style distinguishable from the inactive "Lista" tab
