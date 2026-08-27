## ADDED Requirements

### Requirement: Documentos vinculados section on QualityEventDetail
`QualityEventDetail` SHALL render a `QEDocumentosVinculadosSection` component, placed between `QEVerificacionSection` and `QEAuditTrail`, listing every document in `qe.documentosVinculados` (código, título, estado — using the same `StatusBadge` used elsewhere for document state) plus the shared linking combobox (`documento-qe-vinculacion`) to add more.

#### Scenario: Section lists linked documents with their status
- **WHEN** a QE has 1 linked document
- **THEN** the section renders 1 row showing `codigo`, `titulo`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked documents
- **WHEN** a QE has no linked documents
- **THEN** the section renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add a document is visible only with link permission
- **WHEN** the current user is `JEFE_CALIDAD_SYST`, or is the `SUPERVISOR` responsible for the investigation, and the QE is not `CERRADO` nor `VERIFICADO` (per `documento-qe-vinculacion`)
- **THEN** the combobox to search and link a new document is rendered

#### Scenario: Combobox to add a document is hidden for a deleted or closed/verified QE
- **WHEN** the QE is soft-deleted, or is in `CERRADO`/`VERIFICADO`
- **THEN** the combobox is not rendered, but the read-only list of linked documents still is

#### Scenario: Section is read-only for roles without link permission
- **WHEN** the current user's role is not `JEFE_CALIDAD_SYST` and they are not the responsible `SUPERVISOR`
- **THEN** the section renders the linked documents list without the combobox to add more
