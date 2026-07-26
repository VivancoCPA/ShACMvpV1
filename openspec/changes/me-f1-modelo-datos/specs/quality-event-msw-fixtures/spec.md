## ADDED Requirements

### Requirement: Quality event fixtures carry empresaId
Every element of `qualityEventFixtures` (`src/mocks/fixtures/quality-events.fixtures.ts`) existing prior to this change SHALL have `empresaId: 'empresa-001'`. No pre-existing fixture's `id`, `numero`, or any other field SHALL change as a result of adding this field.

#### Scenario: All pre-existing QE fixtures belong to empresa-001
- **WHEN** `qualityEventFixtures` is filtered to only the fixtures that existed before this change (identified by their pre-existing `id` values)
- **THEN** every one of them has `empresaId === 'empresa-001'`

---

### Requirement: New empresa-002 quality event fixtures
The system SHALL add at least 4 new `QualityEvent` fixtures to `qualityEventFixtures` with `empresaId: 'empresa-002'`, using ids in the `qe-e2-2026-NNN` range to avoid colliding with existing ids. Each new fixture's `reportadoPorId` SHALL reference only a user that exists in `authFixtures` and is assigned to `empresa-002` via `usuarioEmpresaFixtures` (`empresa-msw-fixtures`).

#### Scenario: At least 4 empresa-002 QE fixtures exist
- **WHEN** `qualityEventFixtures` is filtered by `empresaId === 'empresa-002'`
- **THEN** at least 4 elements are returned

#### Scenario: empresa-002 QE fixtures reference valid empresa-002 users
- **WHEN** the `reportadoPorId` of an `empresa-002` QE fixture is looked up in `usuarioEmpresaFixtures`
- **THEN** an entry exists with that `usuarioId` and `empresaId === 'empresa-002'`
