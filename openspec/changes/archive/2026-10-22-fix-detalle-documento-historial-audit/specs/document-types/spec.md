## REMOVED Requirements

### Requirement: VersionEntry interface
**Reason**: `historialVersiones`/`VersionEntry` no tiene equivalente en la entidad real `Documento.cs` — el backend modela versiones como filas separadas enlazadas por `VersionAnteriorId`, nunca como un array embebido, y no lo va a construir (duplicaría lo que ya resuelve `DocumentVersionesTab`). El campo tumbaba el detalle de cualquier documento real (`documento.historialVersiones.map(...)` sobre `undefined`).
**Migration**: El historial de versiones reales se consulta con `useDocumentVersiones(codigo)` (`GET /api/documents?codigo=`), ya usado por `DocumentVersionesTab`. La sección "Historial de estados" (`DocumentHistorial`) se reconstruye desde `documento.auditTrail` — ver el requirement modificado en `document-detail`.

## MODIFIED Requirements

### Requirement: Documento interface
The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `empresaId` (string — FK to `Empresa.id`, required and immutable after creation per RN-EMP-001), `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `ncVinculados`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL NOT include `historialVersiones` — there is no backend equivalent (see the removed `VersionEntry interface` requirement). The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: DocumentAuthorizedRole[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`). The interface SHALL NOT include an `area` field — it is replaced by `areaId`.

`qeVinculados` SHALL be typed as `QeVinculadoResumen[]` (`{ id: string; numero: string; tipo: QEType; severidad: QESeverity; estado: QEStatus }`), not `string[]` — a document's linked Quality Events carry enough summary data to render a badge/label without a second lookup. This is a breaking change from the previous `string[]` (raw id list) shape.

`ncVinculados` SHALL be typed as `NcVinculadoResumen[]` (`{ id: string; numero: string; tipo: NCTipo; severidad: NCSeveridad; estado: NCStatus }`) — a new required field, not a breaking change of a prior shape since no equivalent field existed before.

`empresaId` SHALL NOT appear in any update/edit Zod schema or form payload type for `Documento` — it is set only once, at creation time, by the MSW create handler. No production UI in this phase exposes `empresaId` for editing (multi-company UI is Fase 2-4).

#### Scenario: Documento interface rejects missing required fields
- **WHEN** a developer constructs a `Documento` object without `codigo` or `titulo`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Documento interface accepts valid optional fields as undefined
- **WHEN** a developer constructs a `Documento` with `revisorId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: Documento interface has no historialVersiones field
- **WHEN** a developer accesses `documento.historialVersiones`
- **THEN** TypeScript emits a compile error — the property does not exist on `Documento`

### Requirement: Document-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface scoped to the document domain with fields: `id`, `entidadTipo?` (union literal `'Documento' | 'NoConformidad'`), `entidadId?`, `accion`, `estadoAnterior?`, `estadoNuevo?`, `campoModificado?`, `valorAnterior?`, `valorNuevo?`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `ipOrigen?`, `generadoPorIA`. `entidadTipo`, `entidadId`, and `ipOrigen` are optional (not required): the real backend entity `DocumentoAuditTrail` has no equivalent columns and never sends them — the type reflects that rather than the backend inventing values for them.

#### Scenario: AuditTrailEntry entidadTipo accepts NoConformidad
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'NoConformidad'`
- **THEN** TypeScript accepts the value without error

#### Scenario: AuditTrailEntry entidadTipo rejects unknown entity types
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'QualityEvent'`
- **THEN** TypeScript emits a compile error (QualityEvent is not yet a valid value at this spec stage)

#### Scenario: AuditTrailEntry entidadTipo accepts Documento
- **WHEN** a developer constructs an `AuditTrailEntry` with `entidadTipo: 'Documento'`
- **THEN** TypeScript accepts the value without error (existing behavior preserved)

#### Scenario: AuditTrailEntry accepts an entry without entidadTipo/entidadId/ipOrigen
- **WHEN** a developer constructs an `AuditTrailEntry` with only `id`, `accion`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `generadoPorIA` (matching what the real backend sends)
- **THEN** TypeScript accepts the object without error
