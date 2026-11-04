## MODIFIED Requirements

### Requirement: DocumentListRow renders role-gated action buttons and QE warning icon
The system SHALL render a `DocumentListRow` component that calls `getDocumentPermissions(estado, rol)` to determine which action buttons are visible. Per RN-DOC-003, OBSOLETO documents SHALL NOT show an edit button for any role. Per RN-DOC-005, if a document's `qeVinculados` array contains at least one ID of an active QE, a warning icon SHALL appear in the row. Users with roles `AUDITOR_INTERNO` and `ALTA_DIRECCION` SHALL see no write-action buttons.

The "Iniciar revisión" (↻) icon SHALL be gated by `canManagePeriodicReview(userRole)`, not by the `(estado, docRole)` matrix's `canStartReview` flag — it SHALL appear for any `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` on a `PUBLICADO` document, regardless of that user's relationship (autor/revisor/aprobador) to the specific document.

#### Scenario: OBSOLETO document row has no edit button
- **WHEN** a `DocumentListRow` renders a document with `estado: 'OBSOLETO'`
- **THEN** no edit button is present in the Acciones column regardless of the viewer's role

#### Scenario: Row with active QE shows warning icon
- **WHEN** a `DocumentListRow` renders a document whose `qeVinculados` is non-empty
- **THEN** a warning icon with an accessible `aria-label` is displayed in the row

#### Scenario: AUDITOR_INTERNO sees no write actions
- **WHEN** a user with role `AUDITOR_INTERNO` renders `DocumentList`
- **THEN** no edit, delete, approve, reject, or sign buttons appear in any row

#### Scenario: JEFE_CALIDAD_SYST sees the "Iniciar revisión" icon on a PUBLICADO row
- **WHEN** a user with role `JEFE_CALIDAD_SYST` renders a `DocumentListRow` for a document with `estado: 'PUBLICADO'`
- **THEN** the "Iniciar revisión" (↻) icon is visible, regardless of whether that user is the document's `autorId`, `revisorId`, or `aprobadorId`

#### Scenario: SUPERVISOR does not see the "Iniciar revisión" icon
- **WHEN** a user with role `SUPERVISOR` renders a `DocumentListRow` for a document with `estado: 'PUBLICADO'`
- **THEN** the "Iniciar revisión" (↻) icon is not rendered
