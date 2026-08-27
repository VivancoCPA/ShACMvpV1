## ADDED Requirements

### Requirement: Documentos vinculados section on NonconformityDetailPage
`NonconformityDetailPage` SHALL render a section (`NCDocumentosVinculadosSection`) placed between the "Acciones Correctivas" section and the collapsible "Audit Trail" section, listing every document in `nc.documentosVinculados` (código, título, estado — using the same `StatusBadge` used elsewhere for document state) plus a combobox (`documento-nc-vinculacion`) to add more.

#### Scenario: Section lists linked documents with their status
- **WHEN** an NC has 2 linked documents
- **THEN** the section renders 2 rows, each showing `codigo`, `titulo`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked documents
- **WHEN** an NC has no linked documents
- **THEN** the section renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add a document is visible only with edit permission
- **WHEN** the current user has `canEdit` per `getNCPermissions(nc, userRole)`
- **THEN** the combobox to search and link a new document is rendered

#### Scenario: Combobox to add a document is hidden without edit permission
- **WHEN** the current user lacks `canEdit` per `getNCPermissions(nc, userRole)` (e.g. the NC is `CERRADA`)
- **THEN** the combobox is not rendered, but the read-only list of linked documents still is
