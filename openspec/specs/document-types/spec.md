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

### Requirement: DocumentAuthorizedRole union type
The system SHALL define `DocumentAuthorizedRole` as a TypeScript string literal union of the six operational roles eligible to be listed as an authorized reader of a `RESTRINGIDO`/`CONFIDENCIAL` document: `OPERARIO | SUPERVISOR | JEFE_CALIDAD_SYST | JEFE_CONTROL_DOCUMENTARIO | AUDITOR_INTERNO | ALTA_DIRECCION`. This type SHALL NOT include `ADMINISTRADOR_SISTEMA`, `ADMINISTRADOR_EMPRESA`, or `SUPERADMIN` — per the project-wide rule that system-level and multi-tenant administrative roles never receive access to any operational module, including M1 Control Documentario.

#### Scenario: DocumentAuthorizedRole excludes system-level roles
- **WHEN** a developer attempts to assign `'ADMINISTRADOR_SISTEMA'`, `'ADMINISTRADOR_EMPRESA'`, or `'SUPERADMIN'` to a `DocumentAuthorizedRole` value
- **THEN** TypeScript emits a compile error, as none of those three roles is a member of the union

#### Scenario: DocumentAuthorizedRole accepts all six operational roles
- **WHEN** a developer assigns any of `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, or `ALTA_DIRECCION` to a `DocumentAuthorizedRole` value
- **THEN** TypeScript accepts the assignment without error

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `empresaId` (string — FK to `Empresa.id`, required and immutable after creation per RN-EMP-001), `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: DocumentAuthorizedRole[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`). The interface SHALL NOT include an `area` field — it is replaced by `areaId`.

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
The system SHALL define a `DocFilters` interface for list queries: `estado?`, `tipo?`, `areaId?`, `autorId?`, `search?`, `page?`, `pageSize?`.

#### Scenario: DocFilters is used as a query key parameter
- **WHEN** a developer passes a `DocFilters` object to a query key factory
- **THEN** TypeScript accepts it without casting

#### Scenario: DocFilters accepts areaId as an optional filter
- **WHEN** a developer passes `{ areaId: 'area-001' }` as `DocFilters`
- **THEN** TypeScript accepts it without error
