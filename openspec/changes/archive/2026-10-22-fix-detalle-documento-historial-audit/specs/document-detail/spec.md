## MODIFIED Requirements

### Requirement: DocumentHistorial section
The `DocumentHistorial` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon) that shows/hides its content without unmounting the underlying query data. Its content ("Historial de estados") SHALL be built from `documento.auditTrail` (never `historialVersiones` — that field does not exist), showing one entry per relevant audit trail action: `DOCUMENTO_CREADO`, `ESTADO_CAMBIADO` (with `estadoAnterior` → `estadoNuevo`), `FIRMA_REGISTRADA`, and, when present, `NUEVA_VERSION_INICIADA` and `RESTAURADO`. Each entry SHALL show: an `t('auditTrail.actions.<accion>')` label (or, for `ESTADO_CAMBIADO`, the transition text), the entry's `timestamp` formatted as a real instant converted to the viewer's local time (`Intl.DateTimeFormat` with locale — never the timezone-naive calendar-date helpers from `fix-fechas-utc`, since these are real instants with meaningful time-of-day), and `realizadoPorNombre`. Entries SHALL be connected by a vertical timeline (border-l-2 border-hairline) and sorted descending by `timestamp`. This section covers state transitions of the current document row only; the list of past versions (a different document, sharing `codigo`, per version) is covered exclusively by the "Versiones" section (`DocumentVersionesTab`, via `useDocumentVersiones(codigo)`) and SHALL NOT be duplicated here.

The component SHALL NOT throw when `documento.auditTrail` is empty or contains none of the recognized actions — it SHALL instead show an empty state, consistent with `DocumentAuditTrail`'s own empty state.

#### Scenario: Historial panel is open by default
- **WHEN** the document detail page first renders
- **THEN** the Historial section content is visible without additional user interaction

#### Scenario: Historial panel collapses on toggle click
- **WHEN** the user clicks the Historial section's toggle trigger while it is open
- **THEN** the section content is hidden and `aria-expanded` becomes `false`

#### Scenario: State transitions shown in descending order
- **WHEN** a document's `auditTrail` has `DOCUMENTO_CREADO` followed by two `ESTADO_CAMBIADO` entries
- **THEN** the most recent transition appears first in the timeline

#### Scenario: Creation entry always shown
- **WHEN** a document was just created and its `auditTrail` has only the `DOCUMENTO_CREADO` entry
- **THEN** the Historial section shows that entry (not an empty state)

#### Scenario: Empty audit trail shows an empty state, not a crash
- **WHEN** `documento.auditTrail` is an empty array
- **THEN** the component renders without throwing and shows an empty-state message

#### Scenario: Timeline line connects all entries
- **WHEN** there are two or more history entries
- **THEN** a vertical line (border-l-2) visually connects them

#### Scenario: Version history is never duplicated here
- **WHEN** the document has multiple published versions (separate rows sharing `codigo`)
- **THEN** `DocumentHistorial` shows only this row's own state transitions, not a list of past versions
