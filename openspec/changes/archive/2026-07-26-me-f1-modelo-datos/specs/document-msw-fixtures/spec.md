## ADDED Requirements

### Requirement: Document fixtures carry empresaId
Every element of `documentFixtures` (`src/mocks/fixtures/documents.fixtures.ts`) existing prior to this change SHALL have `empresaId: 'empresa-001'`. No pre-existing fixture's `id`, `codigo`, or any other field SHALL change as a result of adding this field.

#### Scenario: All pre-existing document fixtures belong to empresa-001
- **WHEN** `documentFixtures` is filtered to only the fixtures that existed before this change (identified by their pre-existing `id` values)
- **THEN** every one of them has `empresaId === 'empresa-001'`

---

### Requirement: New empresa-002 document fixtures
The system SHALL add at least 4 new `Documento` fixtures to `documentFixtures` with `empresaId: 'empresa-002'`, using ids in the `doc-e2-NNN` range to avoid colliding with existing ids. Each new fixture's `autorId`/`revisorId`/`aprobadorId` SHALL reference only users that exist in `authFixtures` and are assigned to `empresa-002` via `usuarioEmpresaFixtures` (`empresa-msw-fixtures`).

#### Scenario: At least 4 empresa-002 document fixtures exist
- **WHEN** `documentFixtures` is filtered by `empresaId === 'empresa-002'`
- **THEN** at least 4 elements are returned

#### Scenario: empresa-002 document fixtures reference valid empresa-002 users
- **WHEN** the `autorId` of an `empresa-002` document fixture is looked up in `usuarioEmpresaFixtures`
- **THEN** an entry exists with that `usuarioId` and `empresaId === 'empresa-002'`
