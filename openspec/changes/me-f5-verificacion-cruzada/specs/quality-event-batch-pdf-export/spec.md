## ADDED Requirements

### Requirement: Batch export never mixes QEs from more than one empresa (RN-EMP-004)
Because `QEList`'s selection is built from the results of `GET /api/quality-events`, which is scoped to the session's active empresa (per `quality-event-msw-handlers`), the set of ids passed to a batch export SHALL never include a QE from a different empresa than the one active when the selection was made. Independently, and regardless of how a selection was constructed, each per-QE call to `POST /api/quality-events/:id/export-pdf` within the batch loop SHALL still reject (404) any id that does not belong to the currently active empresa — the batch export SHALL NOT bypass that per-item empresa check.

#### Scenario: Selecting all visible rows never spans two empresas
- **WHEN** a user authenticated against `empresa-001` uses "Seleccionar todos los visibles" in `QEList` and clicks "Exportar seleccionados"
- **THEN** every id included in the batch belongs to `empresa-001`, because `GET /api/quality-events` never returned an `empresa-002` row to select from

#### Scenario: A foreign-empresa id smuggled into the batch fails per-item, not silently
- **WHEN** a batch export request includes an id belonging to a different empresa than the one currently active
- **THEN** the `POST /api/quality-events/:id/export-pdf` call for that id responds 404 and no PDF for that id is added to the zip, while the other QEs in the batch still export normally

#### Scenario: Switching empresa mid-session and re-opening QEList shows no leftover selection from the previous empresa
- **WHEN** a user selects QEs for batch export while in `empresa-001`, then switches active empresa to `empresa-002` without reloading
- **THEN** `QEList`'s selection is empty and no `empresa-001` id remains selectable, because the underlying list refetches scoped to `empresa-002`
