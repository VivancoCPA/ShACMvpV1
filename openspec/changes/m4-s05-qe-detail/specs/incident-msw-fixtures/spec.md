## ADDED Requirements

### Requirement: ACs of QE-referenced incident fixtures carry qeId
`inc-001` and `inc-002` — the two incident fixtures cross-referenced from `quality-events.fixtures.ts` via `incidenteId` (by `qe-2026-005` and `qe-2026-001` respectively) — currently have `accionesCorrectivas: []`. The system SHALL add at least one `AccionCorrectivaIncidente` to each, with `qeId` set to the id of the QE that references it.

#### Scenario: inc-001 has an AC carrying qe-2026-005's id
- **WHEN** `incidentFixtures` entry `id === 'inc-001'` is inspected
- **THEN** `accionesCorrectivas` is non-empty and at least one entry has `qeId === 'qe-2026-005'`

#### Scenario: inc-002 has an AC carrying qe-2026-001's id
- **WHEN** `incidentFixtures` entry `id === 'inc-002'` is inspected
- **THEN** `accionesCorrectivas` is non-empty and at least one entry has `qeId === 'qe-2026-001'`
