## ADDED Requirements

### Requirement: QEList supports row selection for batch PDF export
`QEList` SHALL render a checkbox in a new leading column of each row, plus a "Seleccionar todos los visibles" checkbox in the table header that selects/deselects every row currently rendered (i.e. respecting the active filters from `QEListFilters`, not the full unfiltered dataset). Selection state SHALL be held in local component state (not URL search params) and SHALL reset when the filtered result set changes (e.g. a filter is applied or `page` changes).

#### Scenario: Selecting a row's checkbox adds it to the selection
- **WHEN** a user checks the row checkbox for `QE-2026-005`
- **THEN** `QE-2026-005` is added to the current selection and its checkbox renders checked

#### Scenario: Seleccionar todos los visibles selects only the filtered, currently-rendered rows
- **WHEN** `QEList` is showing 12 rows after applying `estado=ABIERTO` and the user checks "Seleccionar todos los visibles"
- **THEN** exactly those 12 rows are selected, not QEs excluded by the `estado=ABIERTO` filter

#### Scenario: Changing a filter clears the selection
- **WHEN** a user has 5 rows selected and then changes the `severidad` filter
- **THEN** the selection is cleared to 0 rows

---

### Requirement: QEList toolbar exposes "Exportar seleccionados"
`QEList` SHALL render a toolbar above the table containing an "Exportar seleccionados" button. The button SHALL be disabled when the selection count is 0, and SHALL show the selected count (e.g. "Exportar seleccionados (5)") when enabled. Clicking it SHALL trigger the batch export flow defined in `quality-event-batch-pdf-export`. The toolbar SHALL only render for roles for which `puedeExportarPDF(rol)` is `true`; for other roles neither the toolbar nor the selection checkboxes SHALL render.

#### Scenario: Button disabled with no selection
- **WHEN** `QEList` renders with 0 rows selected
- **THEN** "Exportar seleccionados" is disabled

#### Scenario: Button shows selected count
- **WHEN** a user has 5 rows selected
- **THEN** the button label reads "Exportar seleccionados (5)" and is enabled

#### Scenario: OPERARIO sees no selection UI
- **WHEN** a user with role `OPERARIO` renders `QEList`
- **THEN** no selection checkboxes and no export toolbar are rendered
