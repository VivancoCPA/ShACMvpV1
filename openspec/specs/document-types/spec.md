# document-types

Core TypeScript type definitions for the M1 Control Documentario domain. Consumed by all features, hooks, API clients, and MSW handlers that deal with documents.

## Requirements

### Requirement: DocStatus union type
The system SHALL define `DocStatus` as a TypeScript string literal union covering all valid document lifecycle states: `BORRADOR | EN_REVISION | EN_APROBACION | PUBLICADO | OBSOLETO | EN_REVISION_PERIODICA`.

#### Scenario: DocStatus covers all M1 lifecycle states
- **WHEN** a developer imports `DocStatus` from `src/types/documents.types.ts`
- **THEN** the union includes exactly the six values: `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `PUBLICADO`, `OBSOLETO`, `EN_REVISION_PERIODICA` and TypeScript rejects any other string

### Requirement: DocType union type
The system SHALL define `DocType` as a string literal union: `POL | PRC | INS | REG | INF | MAT | PLAN`.

#### Scenario: DocType is exhaustive for M1 document categories
- **WHEN** a developer assigns a document type value
- **THEN** TypeScript accepts only the seven defined abbreviations and rejects any other string

### Requirement: DocRole union type
The system SHALL define `DocRole` as a string literal union for permission resolution: `AUTOR | REVISOR | APROBADOR | JEFE_CALIDAD | OPERARIO`.

#### Scenario: DocRole covers all M1 actors
- **WHEN** the permissions helper receives a `DocRole` argument
- **THEN** TypeScript enforces the five-value union and rejects unknown roles

### Requirement: DocumentPermissions interface
The system SHALL define a `DocumentPermissions` interface in `src/types/documents.types.ts` with boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview`, `canCancelReview`. All flags SHALL be required booleans with no optional members.

#### Scenario: DocumentPermissions has all nine flags as required booleans
- **WHEN** a developer constructs a `DocumentPermissions` object
- **THEN** TypeScript requires all nine flags to be explicitly assigned and rejects any extra properties

#### Scenario: canCancelReview is present alongside canStartReview
- **WHEN** a developer reads `DocumentPermissions`
- **THEN** both `canStartReview` and `canCancelReview` are available as distinct boolean flags

### Requirement: DocConfidencialidad union type
The system SHALL define `DocConfidencialidad` as a TypeScript string literal union: `PUBLICO | INTERNO | CONFIDENCIAL | RESTRINGIDO`. This type SHALL be exported from `src/features/documents/types/document.types.ts` (or the canonical types file for M1).

#### Scenario: DocConfidencialidad covers all four access levels
- **WHEN** a developer imports `DocConfidencialidad`
- **THEN** the union includes exactly `PUBLICO`, `INTERNO`, `CONFIDENCIAL`, and `RESTRINGIDO`; TypeScript rejects any other string

#### Scenario: DocConfidencialidad is used in Documento interface
- **WHEN** a developer reads `documento.confidencialidad`
- **THEN** TypeScript infers the type as `DocConfidencialidad`, not `string`

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `area`, `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: string[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`).

#### Scenario: Documento interface rejects missing required fields
- **WHEN** a developer constructs a `Documento` object without `codigo` or `titulo`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Documento interface accepts valid optional fields as undefined
- **WHEN** a developer constructs a `Documento` with `revisorId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: Documento requires confidencialidad field
- **WHEN** a developer constructs a `Documento` object without `confidencialidad`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: Documento requires rolesAutorizados field
- **WHEN** a developer constructs a `Documento` object without `rolesAutorizados`
- **THEN** TypeScript emits a compile error for the missing field

#### Scenario: rolesAutorizados is typed as string array
- **WHEN** a developer reads `documento.rolesAutorizados`
- **THEN** TypeScript infers the type as `string[]`, not `any`

### Requirement: VersionEntry interface
The system SHALL define a `VersionEntry` interface with fields: `version`, `fechaPublicacion`, `autorId`, `descripcionCambios`, `hashArchivo?`.

#### Scenario: VersionEntry is typed and used in Documento
- **WHEN** a developer accesses `documento.historialVersiones`
- **THEN** TypeScript infers the element type as `VersionEntry`

### Requirement: Document-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface scoped to the document domain with fields: `id`, `entidadTipo` (union literal `'Documento' | 'NoConformidad'`), `entidadId`, `accion`, `estadoAnterior?`, `estadoNuevo?`, `campoModificado?`, `valorAnterior?`, `valorNuevo?`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `ipOrigen?`, `generadoPorIA`.

#### Scenario: AuditTrailEntry entidadTipo accepts NoConformidad
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'NoConformidad'`
- **THEN** TypeScript accepts the value without error

#### Scenario: AuditTrailEntry entidadTipo rejects unknown entity types
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'QualityEvent'`
- **THEN** TypeScript emits a compile error (QualityEvent is not yet a valid value at this spec stage)

#### Scenario: AuditTrailEntry entidadTipo accepts Documento
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'Documento'`
- **THEN** TypeScript accepts the value without error (existing behavior preserved)

### Requirement: DocFilters interface
The system SHALL define a `DocFilters` interface for list queries: `estado?`, `tipo?`, `area?`, `autorId?`, `search?`, `page?`, `pageSize?`.

#### Scenario: DocFilters is used as a query key parameter
- **WHEN** a developer passes a `DocFilters` object to a query key factory
- **THEN** TypeScript accepts it without casting
