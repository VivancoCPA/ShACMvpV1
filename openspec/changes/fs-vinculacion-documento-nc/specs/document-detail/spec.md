## ADDED Requirements

### Requirement: NC vinculadas section on DocumentDetailPage
`DocumentDetailPage` SHALL render a collapsible section (same `useState` + `ChevronDown`/`ChevronUp` pattern as the existing "QE vinculados" section), placed immediately after the "QE vinculados" section and before "Audit trail", listing every NC in `documento.ncVinculados` (número, tipo, severidad, estado — using the same `StatusBadge` used elsewhere for NC state) plus a combobox (`documento-nc-vinculacion`) to add more.

#### Scenario: Section lists linked NCs with their status
- **WHEN** a document has 2 linked NCs
- **THEN** the section renders 2 rows, each showing `numero`, `tipo`, `severidad`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked NCs
- **WHEN** a document has no linked NCs
- **THEN** the section renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add an NC is visible only with edit permission
- **WHEN** the current user has `CanEdit` permission on the document (per `documento-nc-vinculacion`)
- **THEN** the combobox to search and link a new NC is rendered

#### Scenario: Combobox to add an NC is hidden without edit permission
- **WHEN** the current user lacks `CanEdit` permission on the document (e.g. the document is `PUBLICADO`)
- **THEN** the combobox is not rendered, but the read-only list of linked NCs still is
