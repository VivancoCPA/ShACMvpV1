## ADDED Requirements

### Requirement: Fixture documents carry an ncVinculados field
Every fixture document SHALL have an `ncVinculados` field (defaulting to `[]` where no linkage is simulated), typed as `NcVinculadoResumen[]`. At least one fixture document SHALL have a non-empty `ncVinculados` array containing at least one `NcVinculadoResumen` object (`{ id, numero, tipo, severidad, estado }`, matching an existing NC fixture in `nonconformities.fixtures.ts`).

#### Scenario: NC-linked document is identifiable
- **WHEN** the `documentFixtures` array is filtered for `ncVinculados.length > 0`
- **THEN** at least one document is returned

#### Scenario: Linked NC resumen matches an existing NC fixture
- **WHEN** a document fixture has a non-empty `ncVinculados`
- **THEN** each entry's `id` corresponds to an existing fixture in `nonconformities.fixtures.ts`, and that NC fixture's own `documentosVinculados` includes this document's `id` (bidirectional consistency)

#### Scenario: ncVinculados entries are typed objects, not strings
- **WHEN** a developer reads `documentFixtures[i].ncVinculados[0]`
- **THEN** TypeScript infers an `NcVinculadoResumen` object, not a bare `string`
