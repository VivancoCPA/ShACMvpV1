## ADDED Requirements

### Requirement: "Mis pendientes" filter visibility is not role-restricted
`DocumentListFilters` SHALL show the "Mis pendientes" toggle to every role with access to the Documents module (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`), since under the current pendientes rule any of them can have an assigned pendiente (own `BORRADOR`, assigned `RevisorId`/`AprobadorId`, or `EN_REVISION_PERIODICA` for the two Jefe roles). The component SHALL NOT hardcode a smaller role subset for visibility; the pendientes count itself (via `useDocumentosPendientesCount`) is what determines whether there is anything to show.

#### Scenario: AUDITOR_INTERNO sees the pendientes filter
- **WHEN** a user with role `AUDITOR_INTERNO` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered

#### Scenario: ALTA_DIRECCION sees the pendientes filter
- **WHEN** a user with role `ALTA_DIRECCION` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered

#### Scenario: OPERARIO sees the pendientes filter
- **WHEN** a user with role `OPERARIO` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered, showing `0` if they have no `BORRADOR` of their own
