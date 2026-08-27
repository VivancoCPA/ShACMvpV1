## MODIFIED Requirements

### Requirement: At least one fixture with linked QEs
At least one fixture document SHALL have a non-empty `qeVinculados` array containing at least one `QeVinculadoResumen` object (`{ id, numero, tipo, severidad, estado }`, matching an existing QE fixture in `quality-events.fixtures.ts`), simulating RN-DOC-005 linkage. This replaces the previous shape (`string[]` of raw QE ids).

#### Scenario: QE-linked document is identifiable
- **WHEN** the `documentFixtures` array is filtered for `qeVinculados.length > 0`
- **THEN** at least one document is returned

#### Scenario: Linked QE resumen matches an existing QE fixture
- **WHEN** a document fixture has a non-empty `qeVinculados`
- **THEN** each entry's `id` corresponds to an existing fixture in `quality-events.fixtures.ts`, and that QE fixture's own `documentosVinculados` includes this document's `id` (bidirectional consistency)

#### Scenario: qeVinculados entries are typed objects, not strings
- **WHEN** a developer reads `documentFixtures[i].qeVinculados[0]`
- **THEN** TypeScript infers a `QeVinculadoResumen` object, not a bare `string`
