## ADDED Requirements

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

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `area`, `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`.

#### Scenario: Documento interface rejects missing required fields
- **WHEN** a developer constructs a `Documento` object without `codigo` or `titulo`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Documento interface accepts valid optional fields as undefined
- **WHEN** a developer constructs a `Documento` with `revisorId` omitted
- **THEN** TypeScript accepts the object without error

### Requirement: VersionEntry interface
The system SHALL define a `VersionEntry` interface with fields: `version`, `fechaPublicacion`, `autorId`, `descripcionCambios`, `hashArchivo?`.

#### Scenario: VersionEntry is typed and used in Documento
- **WHEN** a developer accesses `documento.historialVersiones`
- **THEN** TypeScript infers the element type as `VersionEntry`

### Requirement: Document-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface scoped to the document domain with fields: `id`, `entidadTipo` (literal `'Documento'`), `entidadId`, `accion`, `estadoAnterior?`, `estadoNuevo?`, `campoModificado?`, `valorAnterior?`, `valorNuevo?`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `ipOrigen?`, `generadoPorIA`.

#### Scenario: AuditTrailEntry entidadTipo is narrowed to Documento
- **WHEN** a developer reads `auditEntry.entidadTipo`
- **THEN** TypeScript narrows the value to the literal `'Documento'`, not the generic union

### Requirement: DocFilters interface
The system SHALL define a `DocFilters` interface for list queries: `estado?`, `tipo?`, `area?`, `autorId?`, `search?`, `page?`, `pageSize?`.

#### Scenario: DocFilters is used as a query key parameter
- **WHEN** a developer passes a `DocFilters` object to a query key factory
- **THEN** TypeScript accepts it without casting

### Requirement: DocumentPermissions interface
The system SHALL define a `DocumentPermissions` interface in `src/types/documents.types.ts` with boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview`, `canCancelReview`. All flags SHALL be required booleans with no optional members.

#### Scenario: DocumentPermissions has all nine flags as required booleans
- **WHEN** a developer constructs a `DocumentPermissions` object
- **THEN** TypeScript requires all nine flags to be explicitly assigned and rejects any extra properties

#### Scenario: canCancelReview is present alongside canStartReview
- **WHEN** a developer reads `DocumentPermissions`
- **THEN** both `canStartReview` and `canCancelReview` are available as distinct boolean flags
