## MODIFIED Requirements

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `empresaId` (string — FK to `Empresa.id`, required and immutable after creation per RN-EMP-001), `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: string[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`). The interface SHALL NOT include an `area` field — it is replaced by `areaId`.

`empresaId` SHALL NOT appear in any update/edit Zod schema or form payload type for `Documento` — it is set only once, at creation time, by the MSW create handler. No production UI in this phase exposes `empresaId` for editing (multi-company UI is Fase 2-4).

#### Scenario: Documento interface rejects missing required fields
- **WHEN** a developer constructs a `Documento` object without `codigo` or `titulo`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Documento interface accepts valid optional fields as undefined
- **WHEN** a developer constructs a `Documento` with `revisorId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: Documento no longer has an area field
- **WHEN** a developer attempts to read or assign `documento.area`
- **THEN** TypeScript emits a compile error, as the property does not exist on `Documento` — the field is `areaId`

#### Scenario: Documento requires confidencialidad field
- **WHEN** a developer constructs a `Documento` object without `confidencialidad`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: Documento requires rolesAutorizados field
- **WHEN** a developer constructs a `Documento` object without `rolesAutorizados`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: rolesAutorizados is typed as string array
- **WHEN** a developer reads `documento.rolesAutorizados`
- **THEN** TypeScript infers the type as `string[]`, not `any`

#### Scenario: Documento requires empresaId field
- **WHEN** a developer constructs a `Documento` object without `empresaId`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: empresaId is typed as a required string
- **WHEN** a developer reads `documento.empresaId`
- **THEN** TypeScript infers the type as `string`, not `string | undefined`
