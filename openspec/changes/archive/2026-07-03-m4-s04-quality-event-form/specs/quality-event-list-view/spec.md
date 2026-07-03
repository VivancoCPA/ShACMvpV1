## MODIFIED Requirements

### Requirement: QualityEventListPage renders the M4 module entry view
The system SHALL render a `QualityEventListPage` component at the `/quality-events` route that composes `QEListFilters` above and `QEList` below, wrapped in a `PageWrapper` with the title from `t('qualityEvents:list.title')`. A "Nuevo Quality Event" button SHALL be visible only for users with roles `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST`. The button SHALL navigate to `/quality-events/nuevo` via `useNavigate` when clicked. `QEList` SHALL be wrapped in an `ErrorBoundary` so filter controls remain interactive when the list fails.

#### Scenario: Authorized roles see the Nuevo QE button
- **WHEN** a user with role `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST` renders `QualityEventListPage`
- **THEN** a "Nuevo Quality Event" button is visible in the page header

#### Scenario: AUDITOR_INTERNO does not see the Nuevo QE button
- **WHEN** a user with role `AUDITOR_INTERNO` renders `QualityEventListPage`
- **THEN** no "Nuevo Quality Event" button appears in the page header

#### Scenario: ALTA_DIRECCION does not see the Nuevo QE button
- **WHEN** a user with role `ALTA_DIRECCION` renders `QualityEventListPage`
- **THEN** no "Nuevo Quality Event" button appears in the page header

#### Scenario: Nuevo QE button navigates to /quality-events/nuevo
- **WHEN** a user with an authorized role clicks the "Nuevo Quality Event" button
- **THEN** the router navigates to `/quality-events/nuevo`

#### Scenario: List error does not unmount filter controls
- **WHEN** `QEList` throws an error caught by its `ErrorBoundary`
- **THEN** `QEListFilters` and the page header remain mounted and interactive
