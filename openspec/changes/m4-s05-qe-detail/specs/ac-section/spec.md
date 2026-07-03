## ADDED Requirements

### Requirement: ACSection renders a Ver QE link when the AC has qeId
When an `AccionCorrectiva` row has `qeId` set, `ACSection` SHALL render a "Ver QE → QE-2026-00N" link (using the QE's `numero`, resolved via the QE list/detail lookup) navigating to `/quality-events/{qeId}`. Rows without `qeId` SHALL NOT render this link.

#### Scenario: AC with qeId shows the Ver QE link
- **WHEN** an `AccionCorrectiva` row has `qeId: 'qe-2026-002'` resolving to `numero: 'QE-2026-002'`
- **THEN** a "Ver QE → QE-2026-002" link is visible on that row, navigating to `/quality-events/qe-2026-002`

#### Scenario: AC without qeId shows no Ver QE link
- **WHEN** an `AccionCorrectiva` row has `qeId` undefined
- **THEN** no "Ver QE" link is rendered on that row
