## ADDED Requirements

### Requirement: At least one fixture with linked documents
At least one fixture NC SHALL have a non-empty `documentosVinculados` array containing at least one `DocumentoVinculadoResumen` object (`{ id, codigo, titulo, estado }`, matching an existing document fixture in `documents.fixtures.ts`). This replaces the previous shape (`string[]` of raw document ids, never populated with real data).

#### Scenario: Document-linked NC is identifiable
- **WHEN** the `nonconformityFixtures` array is filtered for `documentosVinculados.length > 0`
- **THEN** at least one NC is returned

#### Scenario: Linked document resumen matches an existing document fixture
- **WHEN** an NC fixture has a non-empty `documentosVinculados`
- **THEN** each entry's `id` corresponds to an existing fixture in `documents.fixtures.ts`, and that document fixture's own `ncVinculados` includes this NC's `id` (bidirectional consistency)

#### Scenario: documentosVinculados entries are typed objects, not strings
- **WHEN** a developer reads `nonconformityFixtures[i].documentosVinculados[0]`
- **THEN** TypeScript infers a `DocumentoVinculadoResumen` object, not a bare `string`
