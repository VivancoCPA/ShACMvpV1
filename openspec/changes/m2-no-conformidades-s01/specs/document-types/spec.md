# document-types

Delta spec — extends the existing `document-types` spec to include `'NoConformidad'` in `AuditTrailEntry.entidadTipo` as M2 comes online.

## MODIFIED Requirements

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
