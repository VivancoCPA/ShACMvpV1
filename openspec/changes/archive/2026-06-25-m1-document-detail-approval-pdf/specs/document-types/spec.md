## ADDED Requirements

### Requirement: DocConfidencialidad union type
The system SHALL define `DocConfidencialidad` as a TypeScript string literal union: `PUBLICO | INTERNO | CONFIDENCIAL | RESTRINGIDO`. This type SHALL be exported from `src/features/documents/types/document.types.ts` (or the canonical types file for M1).

#### Scenario: DocConfidencialidad covers all four access levels
- **WHEN** a developer imports `DocConfidencialidad`
- **THEN** the union includes exactly `PUBLICO`, `INTERNO`, `CONFIDENCIAL`, and `RESTRINGIDO`; TypeScript rejects any other string

#### Scenario: DocConfidencialidad is used in Documento interface
- **WHEN** a developer reads `documento.confidencialidad`
- **THEN** TypeScript infers the type as `DocConfidencialidad`, not `string`

### Requirement: Documento interface extended with confidencialidad fields
The `Documento` interface SHALL include two new required/conditional fields from the addendum SHAC-PRD-003-ADD-01:
- `confidencialidad: DocConfidencialidad` (required, no default at type level — default `'INTERNO'` is enforced by the API).
- `rolesAutorizados: string[]` (required, empty array when `confidencialidad !== 'RESTRINGIDO'`).

#### Scenario: Documento requires confidencialidad field
- **WHEN** a developer constructs a `Documento` object without `confidencialidad`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: Documento requires rolesAutorizados field
- **WHEN** a developer constructs a `Documento` object without `rolesAutorizados`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: rolesAutorizados is typed as string array
- **WHEN** a developer reads `documento.rolesAutorizados`
- **THEN** TypeScript infers the type as `string[]`, not `any`
