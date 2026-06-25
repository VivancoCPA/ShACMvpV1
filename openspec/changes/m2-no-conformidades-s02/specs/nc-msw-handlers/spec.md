# nc-msw-handlers

MSW v2 request handlers for the M2 Non-Conformities domain. Simulate the backend for all NC and AccionCorrectiva endpoints, enforcing business rules RN-NC-001..007 at the mock layer. All handlers use `http.*` (never `rest.*`) and simulate 400 ms network latency. Exported from `src/mocks/handlers/nonconformities.handlers.ts` and wired into `src/mocks/handlers/index.ts`.

## ADDED Requirements

### Requirement: GET /api/nonconformities handler with pagination and filters
The system SHALL implement an MSW v2 handler for `GET /api/nonconformities` in `src/mocks/handlers/nonconformities.handlers.ts` that applies all `NCFilters` fields in memory over the `nonconformityFixtures` array and returns a paginated `ApiResponse<NoConformidad[]>`. Supported filter parameters: `estado`, `tipo`, `severidad`, `dominio`, `areaAfectada`, `search` (substring match on `descripcion` and `numero`), `fechaDesde`, `fechaHasta` (filter on `fechaDeteccion`), `page` (default 1), `pageSize` (default 20). The handler SHALL simulate 400 ms latency using `delay(400)`.

#### Scenario: GET list returns all fixtures when no filters applied
- **WHEN** a client calls `GET /api/nonconformities` with no query parameters
- **THEN** the handler returns HTTP 200 with `data` containing all fixture NCs and `pagination.totalItems` equal to the fixture count

#### Scenario: GET list filters by estado
- **WHEN** a client calls `GET /api/nonconformities?estado=DETECTADA`
- **THEN** the handler returns only NCs with `estado === 'DETECTADA'`

#### Scenario: GET list filters by dominio
- **WHEN** a client calls `GET /api/nonconformities?dominio=SST`
- **THEN** the handler returns only NCs with `dominio === 'SST'`

#### Scenario: GET list filters by search substring
- **WHEN** a client calls `GET /api/nonconformities?search=NC-CAL`
- **THEN** the handler returns only NCs whose `numero` or `descripcion` contains `'NC-CAL'`

#### Scenario: GET list paginates results correctly
- **WHEN** a client calls `GET /api/nonconformities?page=1&pageSize=3`
- **THEN** the handler returns at most 3 NCs and sets `pagination.totalPages` to `Math.ceil(totalItems / 3)`

#### Scenario: GET list filters by date range
- **WHEN** a client calls `GET /api/nonconformities?fechaDesde=2025-01-01&fechaHasta=2025-06-30`
- **THEN** the handler returns only NCs with `fechaDeteccion` falling within the specified range

### Requirement: GET /api/nonconformities/:id handler returning NC with ACs embedded
The system SHALL implement an MSW v2 handler for `GET /api/nonconformities/:id` that finds the NC by `id` in the in-memory array. If found, returns HTTP 200 with the full `NoConformidad` including `accionesCorrectivas`. If not found, returns HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`.

#### Scenario: GET detail returns NC with embedded ACs
- **WHEN** a client calls `GET /api/nonconformities/nc-001` and that NC exists
- **THEN** the handler returns HTTP 200 with `data.accionesCorrectivas` populated

#### Scenario: GET detail returns 404 for unknown id
- **WHEN** a client calls `GET /api/nonconformities/nc-unknown`
- **THEN** the handler returns HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`

### Requirement: POST /api/nonconformities handler with duplicate detection (RN-NC-005)
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities` that: (1) validates required fields (`origen`, `tipo`, `severidad`, `areaAfectada`, `descripcion`, `fechaDeteccion`, `dominio`); (2) generates a new `id` (UUID) and `numero` (e.g., `NC-CAL-2025-009`) based on `dominio`; (3) initializes the NC in `DETECTADA` state with `accionesCorrectivas: []` and an initial `auditTrail` entry; (4) checks for potential duplicates (NCs with same `dominio` + `areaAfectada` created within the last 30 days); (5) returns HTTP 201 with the created NC and, if duplicates found, includes `{ warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }` in the response.

#### Scenario: POST creates a new NC in DETECTADA state
- **WHEN** a client calls `POST /api/nonconformities` with a valid payload
- **THEN** the handler returns HTTP 201 with `data.estado === 'DETECTADA'` and `data.accionesCorrectivas` as an empty array

#### Scenario: POST adds an auditTrail entry on creation
- **WHEN** a client calls `POST /api/nonconformities` with a valid payload
- **THEN** the response NC has `auditTrail` with exactly one entry with `accion === 'CREADA'`

#### Scenario: POST returns 400 for missing required field
- **WHEN** a client calls `POST /api/nonconformities` without `descripcion`
- **THEN** the handler returns HTTP 400 with `{ success: false, errors: ['descripcion is required'] }`

#### Scenario: POST detects potential duplicate and returns warning
- **WHEN** a client creates a NC with `dominio='CALIDAD'` and `areaAfectada='Almacén Norte'` and there is an existing NC with the same `dominio` + `areaAfectada` with `creadoEn` within the last 30 days
- **THEN** the handler returns HTTP 201 with both the created NC and `{ warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }` in the response body

#### Scenario: POST does not set warning when no recent duplicate exists
- **WHEN** a client creates a NC with a unique `dominio` + `areaAfectada` combination
- **THEN** the handler returns HTTP 201 with no `warning` field in the response

### Requirement: PATCH /api/nonconformities/:id handler blocking closed/anulada edits
The system SHALL implement an MSW v2 handler for `PATCH /api/nonconformities/:id` that: (1) returns HTTP 404 if the NC does not exist; (2) returns HTTP 409 with `{ success: false, message: 'nonconformities:errors.editBlockedByStatus' }` if the NC `estado` is `'CERRADA'` or `'ANULADA'`; (3) otherwise applies the `UpdateNCInput` fields to the NC, updates `actualizadoEn`, appends an audit trail entry for each changed field, and returns HTTP 200 with the updated NC.

#### Scenario: PATCH returns 409 when NC is in CERRADA state
- **WHEN** a client calls `PATCH /api/nonconformities/nc-cerrada` and that NC has `estado === 'CERRADA'`
- **THEN** the handler returns HTTP 409 with `message: 'nonconformities:errors.editBlockedByStatus'`

#### Scenario: PATCH returns 409 when NC is in ANULADA state
- **WHEN** a client calls `PATCH /api/nonconformities/nc-anulada` and that NC has `estado === 'ANULADA'`
- **THEN** the handler returns HTTP 409 with `message: 'nonconformities:errors.editBlockedByStatus'`

#### Scenario: PATCH updates allowed fields and records audit trail entry
- **WHEN** a client calls `PATCH /api/nonconformities/nc-001` with `{ causaRaiz: 'Falta de procedimiento' }` on an NC in `EN_INVESTIGACION` state
- **THEN** the handler returns HTTP 200 with `data.causaRaiz === 'Falta de procedimiento'` and a new `auditTrail` entry with `accion === 'CAMPO_EDITADO'` and `campoModificado === 'causaRaiz'`

### Requirement: POST /api/nonconformities/:id/anular handler with justificacion validation
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities/:id/anular` that: (1) returns HTTP 404 if the NC does not exist; (2) returns HTTP 400 with `{ success: false, errors: ['justificacion is required'] }` if the request body `justificacion` is missing or empty; (3) changes `estado` to `'ANULADA'`, appends an audit trail entry with `accion: 'ANULADA'` and `valorNuevo: justificacion`, and returns HTTP 200 with the updated NC.

#### Scenario: POST anular returns 400 when justificacion is empty string
- **WHEN** a client calls `POST /api/nonconformities/nc-001/anular` with `{ justificacion: '' }`
- **THEN** the handler returns HTTP 400 with `errors: ['justificacion is required']`

#### Scenario: POST anular returns 400 when justificacion is missing
- **WHEN** a client calls `POST /api/nonconformities/nc-001/anular` with no body
- **THEN** the handler returns HTTP 400 with `errors: ['justificacion is required']`

#### Scenario: POST anular changes estado to ANULADA
- **WHEN** a client calls `POST /api/nonconformities/nc-001/anular` with a non-empty `justificacion`
- **THEN** the handler returns HTTP 200 with `data.estado === 'ANULADA'` and a new `auditTrail` entry with `accion === 'ANULADA'`

### Requirement: POST /api/nonconformities/:id/acciones-correctivas handler
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities/:id/acciones-correctivas` that: (1) returns HTTP 404 if the NC does not exist; (2) validates that `descripcion`, `responsableId`, and `plazoFecha` are present — returns HTTP 400 if any is missing; (3) creates a new `AccionCorrectiva` with `estado: 'PENDIENTE'`, appends it to `nc.accionesCorrectivas`, appends an audit trail entry with `accion: 'AC_CREADA'`, and returns HTTP 201 with `ApiResponse<AccionCorrectiva>`.

#### Scenario: POST creates AC with PENDIENTE state
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas` with valid `{ descripcion, responsableId, plazoFecha }`
- **THEN** the handler returns HTTP 201 with `data.estado === 'PENDIENTE'`

#### Scenario: POST returns 400 when descripcion is missing
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas` without `descripcion`
- **THEN** the handler returns HTTP 400

### Requirement: PATCH /api/nonconformities/:id/acciones-correctivas/:acId handler
The system SHALL implement an MSW v2 handler for `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId` that: (1) returns HTTP 404 if the NC or AC does not exist; (2) applies `UpdateACInput` fields to the AC; (3) updates `ac.actualizadoEn` and appends an audit trail entry to the parent NC with `accion: 'AC_ACTUALIZADA'`; (4) returns HTTP 200 with `ApiResponse<AccionCorrectiva>`.

#### Scenario: PATCH AC returns 404 when AC does not exist
- **WHEN** a client calls `PATCH /api/nonconformities/nc-001/acciones-correctivas/ac-unknown`
- **THEN** the handler returns HTTP 404

#### Scenario: PATCH AC updates estado and records audit trail entry
- **WHEN** a client calls `PATCH /api/nonconformities/nc-001/acciones-correctivas/ac-1` with `{ estado: 'EN_EJECUCION' }`
- **THEN** the handler returns HTTP 200 with `data.estado === 'EN_EJECUCION'` and the parent NC has a new `auditTrail` entry with `accion === 'AC_ACTUALIZADA'`

### Requirement: POST /api/nonconformities/:id/acciones-correctivas/:acId/cerrar handler
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar` that: (1) returns HTTP 404 if the NC or AC does not exist; (2) returns HTTP 400 with `{ success: false, errors: ['descripcionEvidencia is required'] }` if `descripcionEvidencia` is missing or empty; (3) sets `ac.estado = 'COMPLETADA'`, `ac.fechaCierre = new Date().toISOString()`, sets `ac.descripcionEvidencia` and `ac.evidenciaUrl` from the request, appends an audit trail entry with `accion: 'AC_CERRADA'` to the parent NC, and returns HTTP 200 with `ApiResponse<AccionCorrectiva>`.

#### Scenario: POST cerrar returns 400 when descripcionEvidencia is empty
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas/ac-1/cerrar` with `{ descripcionEvidencia: '' }`
- **THEN** the handler returns HTTP 400 with `errors: ['descripcionEvidencia is required']`

#### Scenario: POST cerrar sets AC estado to COMPLETADA
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas/ac-1/cerrar` with valid `{ descripcionEvidencia: 'Evidencia de corrección' }`
- **THEN** the handler returns HTTP 200 with `data.estado === 'COMPLETADA'` and `data.fechaCierre` set to a non-empty ISO 8601 string

#### Scenario: POST cerrar appends AC_CERRADA to NC audit trail
- **WHEN** a client successfully closes an AC
- **THEN** the parent NC has a new `auditTrail` entry with `accion === 'AC_CERRADA'`

### Requirement: All handlers simulate 400 ms network latency
Every handler in `nonconformities.handlers.ts` SHALL call `await delay(400)` before returning any response. The constant `400` SHALL be defined as a module-level `const LATENCY = 400` to facilitate future adjustment.

#### Scenario: Handler delays response by approximately 400 ms
- **WHEN** any nonconformity handler is called
- **THEN** the response arrives after approximately 400 ms of simulated latency

### Requirement: nonconformityHandlers wired into handlers index
The system SHALL export the `nonconformityHandlers` array from `src/mocks/handlers/nonconformities.handlers.ts` and include it in the spread of handlers in `src/mocks/handlers/index.ts`.

#### Scenario: nonconformityHandlers importable from handlers index
- **WHEN** the MSW worker starts in development mode
- **THEN** all nonconformity handlers are active and intercept requests to `/api/nonconformities*`
