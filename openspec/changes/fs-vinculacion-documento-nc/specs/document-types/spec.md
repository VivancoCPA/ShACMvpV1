## MODIFIED Requirements

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `empresaId` (string — FK to `Empresa.id`, required and immutable after creation per RN-EMP-001), `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `ncVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: DocumentAuthorizedRole[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`). The interface SHALL NOT include an `area` field — it is replaced by `areaId`.

`qeVinculados` SHALL be typed as `QeVinculadoResumen[]` (`{ id: string; numero: string; tipo: QEType; severidad: QESeverity; estado: QEStatus }`), not `string[]` — a document's linked Quality Events carry enough summary data to render a badge/label without a second lookup. This is a breaking change from the previous `string[]` (raw id list) shape.

`ncVinculados` SHALL be typed as `NcVinculadoResumen[]` (`{ id: string; numero: string; tipo: NCTipo; severidad: NCSeveridad; estado: NCStatus }`) — a new required field (this change), not a breaking change of a prior shape since no equivalent field existed before.

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

#### Scenario: rolesAutorizados is typed as DocumentAuthorizedRole array
- **WHEN** a developer reads `documento.rolesAutorizados`
- **THEN** TypeScript infers the type as `DocumentAuthorizedRole[]`, not `string[]`, `UserRole[]`, or `any`

#### Scenario: rolesAutorizados rejects system-level roles at the type level
- **WHEN** a developer attempts to construct a `Documento` with `rolesAutorizados: ['ADMINISTRADOR_SISTEMA']`
- **THEN** TypeScript emits a compile error, since `'ADMINISTRADOR_SISTEMA'` is not a `DocumentAuthorizedRole`

#### Scenario: Documento requires empresaId field
- **WHEN** a developer constructs a `Documento` object without `empresaId`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: empresaId is typed as a required string
- **WHEN** a developer reads `documento.empresaId`
- **THEN** TypeScript infers the type as `string`, not `string | undefined`

#### Scenario: qeVinculados is typed as QeVinculadoResumen array, not string array
- **WHEN** a developer reads `documento.qeVinculados[0]`
- **THEN** TypeScript infers a `QeVinculadoResumen` object with `id`, `numero`, `tipo`, `severidad`, `estado` — not a bare `string`

#### Scenario: qeVinculados as string[] is a compile error
- **WHEN** a developer constructs a `Documento` with `qeVinculados: ['qe-001']`
- **THEN** TypeScript emits a compile error, since `'qe-001'` is not assignable to `QeVinculadoResumen`

#### Scenario: Documento requires ncVinculados field
- **WHEN** a developer constructs a `Documento` object without `ncVinculados`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: ncVinculados is typed as NcVinculadoResumen array, not string array
- **WHEN** a developer reads `documento.ncVinculados[0]`
- **THEN** TypeScript infers an `NcVinculadoResumen` object with `id`, `numero`, `tipo`, `severidad`, `estado` — not a bare `string`

## ADDED Requirements

### Requirement: NcVinculadoResumen interface
The system SHALL define an `NcVinculadoResumen` interface in `src/types/documents.types.ts` with required fields: `id` (string), `numero` (string), `tipo` (`NCTipo`), `severidad` (`NCSeveridad`), `estado` (`NCStatus`). It SHALL be used as the element type of `Documento.ncVinculados`.

#### Scenario: NcVinculadoResumen requires all five fields
- **WHEN** a developer constructs an `NcVinculadoResumen` without `severidad`
- **THEN** TypeScript emits a compile error for the missing required field
