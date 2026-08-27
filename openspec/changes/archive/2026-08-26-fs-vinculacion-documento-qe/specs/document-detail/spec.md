## MODIFIED Requirements

### Requirement: DocumentDetailHeader contextual banners
The header SHALL render contextual banners:
- OBSOLETO banner (bg-error/10 border-error/30) when `estado === 'OBSOLETO'`.
- QE-vinculados banner (bg-amber/10 border-amber/30) when `qeVinculados.length > 0`, listing the linked QEs' `numero` (not raw ids — `qeVinculados` is a populated `QeVinculadoResumen[]`, see `document-types`).
- RESTRINGIDO info banner (bg-teal/10 border-teal/30) listing `rolesAutorizados` when `confidencialidad === 'RESTRINGIDO'`, visible only to users with role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`.

#### Scenario: OBSOLETO banner appears for obsolete documents
- **WHEN** `documento.estado === 'OBSOLETO'`
- **THEN** a red banner with key `documents:detail.banners.obsoleto` is displayed

#### Scenario: QE-vinculados banner shows QE numbers
- **WHEN** `documento.qeVinculados` contains at least one linked QE
- **THEN** an amber banner lists each linked QE's `numero` (e.g. `QE-2026-014`), not its raw `id`

#### Scenario: RESTRINGIDO banner visible to authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`
- **THEN** a teal banner listing `rolesAutorizados` is displayed

#### Scenario: RESTRINGIDO banner hidden from non-authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CALIDAD_SYST` or `AUDITOR_INTERNO`
- **THEN** the teal banner is NOT displayed

## ADDED Requirements

### Requirement: QE vinculados section on DocumentDetailPage
`DocumentDetailPage` SHALL render a collapsible section (same `useState` + `ChevronDown`/`ChevronUp` pattern as the existing "Historial"/"Audit trail" sections), placed between the "Versiones" and "Audit trail" sections, listing every QE in `documento.qeVinculados` (número, tipo, severidad, estado — using the same `StatusBadge` used elsewhere for QE state) plus the shared linking combobox (`documento-qe-vinculacion`) to add more.

#### Scenario: Section lists linked QEs with their status
- **WHEN** a document has 2 linked QEs
- **THEN** the section renders 2 rows, each showing `numero`, `tipo`, `severidad`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked QEs
- **WHEN** a document has no linked QEs
- **THEN** the section renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add a QE is visible only with edit permission
- **WHEN** the current user has `CanEdit` permission on the document (per `documento-qe-vinculacion`)
- **THEN** the combobox to search and link a new QE is rendered

#### Scenario: Combobox to add a QE is hidden without edit permission
- **WHEN** the current user lacks `CanEdit` permission on the document (e.g. the document is `PUBLICADO`)
- **THEN** the combobox is not rendered, but the read-only list of linked QEs still is
