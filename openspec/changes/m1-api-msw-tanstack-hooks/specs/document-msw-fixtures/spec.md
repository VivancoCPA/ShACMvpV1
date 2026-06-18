## ADDED Requirements

### Requirement: Fixture dataset covers all DocStatus values
The system SHALL provide a `documentFixtures` array exported from `src/mocks/fixtures/documents.fixtures.ts` containing at least one document in each of the five active states: `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `PUBLICADO`, `OBSOLETO`. The `EN_REVISION_PERIODICA` state MAY be included but is not required.

#### Scenario: All five required states are represented
- **WHEN** the `documentFixtures` array is imported
- **THEN** filtering by each of `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `PUBLICADO`, `OBSOLETO` returns at least one document

### Requirement: Fixture dataset covers all DocType values
The fixture dataset SHALL contain at least one document of each type: `POL`, `PRC`, `INS`, `REG`, `INF`, `MAT`, `PLAN`.

#### Scenario: All seven document types are represented
- **WHEN** the `documentFixtures` array is imported
- **THEN** filtering by each of the seven `DocType` values returns at least one document

### Requirement: Fixture documents have all required Documento fields
Every fixture document SHALL include all required fields of the `Documento` interface: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `area`, `autorId`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`.

#### Scenario: All fixtures pass TypeScript strict typing
- **WHEN** the fixtures file is compiled with `strict: true`
- **THEN** TypeScript reports no type errors for any fixture object

### Requirement: At least one fixture with multi-entry version history
At least one fixture document SHALL have a `historialVersiones` array with two or more `VersionEntry` entries to simulate a document that has been revised and published multiple times.

#### Scenario: Version history progression is realistic
- **WHEN** a fixture has two version entries
- **THEN** the first entry has an older `fechaPublicacion` than the second, and the version strings are `v1.0` and `v1.1` (or similar major progression)

### Requirement: At least one fixture with linked QEs
At least one fixture document SHALL have a non-empty `qeVinculados` array containing at least one QE ID string, simulating RN-DOC-005 linkage.

#### Scenario: QE-linked document is identifiable
- **WHEN** the `documentFixtures` array is filtered for `qeVinculados.length > 0`
- **THEN** at least one document is returned

### Requirement: Fixture codes follow M1 naming convention
Every fixture document's `codigo` field SHALL follow the pattern `<DocType>-CD-<NNN>` (e.g., `POL-CD-001`, `PRC-CD-002`). Codes within the fixture dataset SHALL be unique.

#### Scenario: Fixture codes are unique
- **WHEN** all `codigo` values from the fixture array are collected into a Set
- **THEN** the Set size equals the total number of fixtures

### Requirement: Total fixture count is exactly 10
The `documentFixtures` array SHALL contain exactly 10 documents.

#### Scenario: Fixture count is 10
- **WHEN** `documentFixtures.length` is evaluated
- **THEN** it equals 10
