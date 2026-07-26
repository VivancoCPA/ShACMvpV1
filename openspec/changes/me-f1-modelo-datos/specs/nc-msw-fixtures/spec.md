## ADDED Requirements

### Requirement: Nonconformity fixtures carry empresaId
Every element of `nonconformityFixtures` (`src/mocks/fixtures/nonconformities.fixtures.ts`) existing prior to this change SHALL have `empresaId: 'empresa-001'`. No pre-existing fixture's `id`, `numero`, or any other field SHALL change as a result of adding this field.

#### Scenario: All pre-existing NC fixtures belong to empresa-001
- **WHEN** `nonconformityFixtures` is filtered to only the fixtures that existed before this change (identified by their pre-existing `id` values)
- **THEN** every one of them has `empresaId === 'empresa-001'`

---

### Requirement: New empresa-002 nonconformity fixtures
The system SHALL add at least 4 new `NoConformidad` fixtures to `nonconformityFixtures` with `empresaId: 'empresa-002'`, using ids in the `nc-e2-NNN` range to avoid colliding with existing ids. Each new fixture's `reportadoPorId` SHALL reference only a user that exists in `authFixtures` and is assigned to `empresa-002` via `usuarioEmpresaFixtures` (`empresa-msw-fixtures`).

#### Scenario: At least 4 empresa-002 NC fixtures exist
- **WHEN** `nonconformityFixtures` is filtered by `empresaId === 'empresa-002'`
- **THEN** at least 4 elements are returned

#### Scenario: empresa-002 NC fixtures reference valid empresa-002 users
- **WHEN** the `reportadoPorId` of an `empresa-002` NC fixture is looked up in `usuarioEmpresaFixtures`
- **THEN** an entry exists with that `usuarioId` and `empresaId === 'empresa-002'`
