## ADDED Requirements

### Requirement: Incident fixtures carry empresaId
Every element of `incidentFixtures` (`src/mocks/fixtures/incidents.fixtures.ts`) existing prior to this change SHALL have `empresaId: 'empresa-001'`. No pre-existing fixture's `id`, `numero`, or any other field SHALL change as a result of adding this field.

#### Scenario: All pre-existing incident fixtures belong to empresa-001
- **WHEN** `incidentFixtures` is filtered to only the fixtures that existed before this change (identified by their pre-existing `id` values)
- **THEN** every one of them has `empresaId === 'empresa-001'`

---

### Requirement: New empresa-002 incident fixtures
The system SHALL add at least 4 new `Incidente` fixtures to `incidentFixtures` with `empresaId: 'empresa-002'`, using ids in the `inc-e2-NNN` range to avoid colliding with existing ids. Each new fixture's `reportadoPorId` SHALL reference only a user that exists in `authFixtures` and is assigned to `empresa-002` via `usuarioEmpresaFixtures` (`empresa-msw-fixtures`). Each new fixture's `areaId` SHALL reference an existing `areaFixtures` entry (Área remains a shared, company-agnostic catalog in this phase).

#### Scenario: At least 4 empresa-002 incident fixtures exist
- **WHEN** `incidentFixtures` is filtered by `empresaId === 'empresa-002'`
- **THEN** at least 4 elements are returned

#### Scenario: empresa-002 incident fixtures reference valid empresa-002 users
- **WHEN** the `reportadoPorId` of an `empresa-002` incident fixture is looked up in `usuarioEmpresaFixtures`
- **THEN** an entry exists with that `usuarioId` and `empresaId === 'empresa-002'`
