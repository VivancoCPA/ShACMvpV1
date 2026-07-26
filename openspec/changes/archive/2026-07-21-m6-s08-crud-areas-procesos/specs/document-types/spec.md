## MODIFIED Requirements

### Requirement: Documento interface

The system SHALL define a `Documento` interface with all required and optional fields: `id`, `codigo`, `titulo`, `tipo`, `version`, `estado`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `autorId`, `revisorId?`, `aprobadorId?`, `fechaEmision?`, `fechaVigencia?`, `fechaRevisionProxima?`, `archivoUrl?`, `hashArchivo?`, `qeVinculados`, `historialVersiones`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include two required fields from addendum SHAC-PRD-003-ADD-01: `confidencialidad: DocConfidencialidad` (no default at type level — default `'INTERNO'` is enforced by the API) and `rolesAutorizados: string[]` (empty array when `confidencialidad !== 'RESTRINGIDO'`). The interface SHALL NOT include an `area` field — it is replaced by `areaId`.

#### Scenario: Documento interface rejects missing required fields

- **WHEN** a developer constructs a `Documento` object without `codigo` or `titulo`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Documento interface accepts valid optional fields as undefined

- **WHEN** a developer constructs a `Documento` with `revisorId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: Documento no longer has an area field

- **WHEN** a developer attempts to read or assign `documento.area`
- **THEN** TypeScript emits a compile error, as the property does not exist on `Documento` — the field is `areaId`

---

### Requirement: DocFilters interface

The system SHALL define a `DocFilters` interface for list queries: `estado?`, `tipo?`, `areaId?`, `autorId?`, `search?`, `page?`, `pageSize?`.

#### Scenario: DocFilters is used as a query key parameter

- **WHEN** a developer passes a `DocFilters` object to a query key factory
- **THEN** TypeScript accepts it without casting

#### Scenario: DocFilters accepts areaId as an optional filter

- **WHEN** a developer passes `{ areaId: 'area-001' }` as `DocFilters`
- **THEN** TypeScript accepts it without error
