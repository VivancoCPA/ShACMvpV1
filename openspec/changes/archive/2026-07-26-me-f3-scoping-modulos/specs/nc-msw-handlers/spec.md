## MODIFIED Requirements

### Requirement: GET /api/nonconformities handler with pagination and filters
The system SHALL implement an MSW v2 handler for `GET /api/nonconformities` in `src/mocks/handlers/nonconformities.handlers.ts` that applies all `NCFilters` fields in memory over the `nonconformityFixtures` array and returns a paginated `ApiResponse<NoConformidad[]>`. Supported filter parameters: `estado`, `tipo`, `severidad`, `dominio`, `areaAfectada`, `search` (substring match on `descripcion` and `numero`), `fechaDesde`, `fechaHasta` (filter on `fechaDeteccion`), `page` (default 1), `pageSize` (default 20). Before any other filter is applied, the handler SHALL restrict the candidate set to NCs whose `empresaId` matches the `empresaActivaId` of the requesting session; NCs belonging to any other `empresaId` SHALL never appear in `data` or count toward `pagination.totalItems`, regardless of other filters. The handler SHALL simulate 400 ms latency using `delay(400)`.

#### Scenario: GET list returns all fixtures for the active empresa when no filters applied
- **WHEN** a client calls `GET /api/nonconformities` with no query parameters
- **THEN** the handler returns HTTP 200 with `data` containing only fixture NCs whose `empresaId` matches the session's active empresa, and `pagination.totalItems` equal to that count

#### Scenario: GET list filters by estado
- **WHEN** a client calls `GET /api/nonconformities?estado=DETECTADA`
- **THEN** the handler returns only NCs with `estado === 'DETECTADA'` and `empresaId` equal to the session's active empresa

#### Scenario: GET list filters by dominio
- **WHEN** a client calls `GET /api/nonconformities?dominio=SST`
- **THEN** the handler returns only NCs with `dominio === 'SST'` and `empresaId` equal to the session's active empresa

#### Scenario: GET list filters by search substring
- **WHEN** a client calls `GET /api/nonconformities?search=NC-CAL`
- **THEN** the handler returns only NCs whose `numero` or `descripcion` contains `'NC-CAL'` and `empresaId` equal to the session's active empresa

#### Scenario: GET list paginates results correctly
- **WHEN** a client calls `GET /api/nonconformities?page=1&pageSize=3`
- **THEN** the handler returns at most 3 NCs, scoped to the active empresa, and sets `pagination.totalPages` to `Math.ceil(totalItems / 3)` based on that scoped count

#### Scenario: GET list filters by date range
- **WHEN** a client calls `GET /api/nonconformities?fechaDesde=2025-01-01&fechaHasta=2025-06-30`
- **THEN** the handler returns only NCs with `fechaDeteccion` falling within the specified range and `empresaId` equal to the session's active empresa

#### Scenario: GET list excludes NCs from another empresa
- **WHEN** the session's active empresa is `empresa-001` and `GET /api/nonconformities` is requested with no filters
- **THEN** no NC with `empresaId === 'empresa-002'` appears anywhere in `data`, even if it would otherwise match every other filter

---

### Requirement: GET /api/nonconformities/:id handler returning NC with ACs embedded
The system SHALL implement an MSW v2 handler for `GET /api/nonconformities/:id` that finds the NC by `id` in the in-memory array. If found and its `empresaId` matches the session's active empresa, returns HTTP 200 with the full `NoConformidad` including `accionesCorrectivas`. If not found, or found but its `empresaId` does not match the session's active empresa, returns HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }` — both cases are indistinguishable to the caller.

#### Scenario: GET detail returns NC with embedded ACs
- **WHEN** a client calls `GET /api/nonconformities/nc-001`, that NC exists, and its `empresaId` matches the session's active empresa
- **THEN** the handler returns HTTP 200 with `data.accionesCorrectivas` populated

#### Scenario: GET detail returns 404 for unknown id
- **WHEN** a client calls `GET /api/nonconformities/nc-unknown`
- **THEN** the handler returns HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`

#### Scenario: GET detail returns 404 for an NC belonging to another empresa
- **WHEN** a client calls `GET /api/nonconformities/:id` for an id that exists in the store but whose `empresaId` differs from the session's active empresa
- **THEN** the handler returns HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`, identical to the unknown-id response

---

### Requirement: POST /api/nonconformities handler with duplicate detection (RN-NC-005)
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities` that: (1) validates required fields (`origen`, `tipo`, `severidad`, `areaAfectada`, `descripcion`, `fechaDeteccion`, `dominio`); (2) generates a new `id` (UUID) and `numero` (e.g., `NC-CAL-2025-009`) based on `dominio`, with the correlative count scoped to the session's active empresa (RN-EMP-003 — two empresas can each have an independent `numero` sequence per `dominio` without colliding); (3) sets `empresaId` to the session's active empresa (never a client-supplied value) and initializes the NC in `DETECTADA` state with `accionesCorrectivas: []` and an initial `auditTrail` entry; (4) checks for potential duplicates among NCs with the same `dominio` + `areaAfectada` created within the last 30 days **and belonging to the same active empresa** — an NC in another empresa with the same `dominio`/`areaAfectada` SHALL never trigger the duplicate warning; (5) returns HTTP 201 with the created NC and, if duplicates found, includes `{ warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }` in the response. If the requesting session has no active empresa, the handler SHALL reject the request with 401 instead of creating an NC.

#### Scenario: POST creates a new NC in DETECTADA state
- **WHEN** a client calls `POST /api/nonconformities` with a valid payload
- **THEN** the handler returns HTTP 201 with `data.estado === 'DETECTADA'`, `data.accionesCorrectivas` as an empty array, and `data.empresaId` equal to the session's active empresa

#### Scenario: POST adds an auditTrail entry on creation
- **WHEN** a client calls `POST /api/nonconformities` with a valid payload
- **THEN** the response NC has `auditTrail` with exactly one entry with `accion === 'CREADA'`

#### Scenario: POST returns 400 for missing required field
- **WHEN** a client calls `POST /api/nonconformities` without `descripcion`
- **THEN** the handler returns HTTP 400 with `{ success: false, errors: ['descripcion is required'] }`

#### Scenario: POST detects potential duplicate within the same empresa and returns warning
- **WHEN** a client creates a NC with `dominio='CALIDAD'` and `areaAfectada='Almacén Norte'` and there is an existing NC with the same `dominio` + `areaAfectada`, `creadoEn` within the last 30 days, and the same `empresaId` as the active session
- **THEN** the handler returns HTTP 201 with both the created NC and `{ warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }` in the response body

#### Scenario: POST does not set warning when no recent duplicate exists
- **WHEN** a client creates a NC with a unique `dominio` + `areaAfectada` combination
- **THEN** the handler returns HTTP 201 with no `warning` field in the response

#### Scenario: POST does not flag a matching NC from another empresa as a duplicate
- **WHEN** a client creates a NC with `dominio='CALIDAD'` and `areaAfectada='Almacén Norte'` from a session whose active empresa is `empresa-002`, and the only matching recent NC with that `dominio`/`areaAfectada` belongs to `empresa-001`
- **THEN** the handler returns HTTP 201 with no `warning` field in the response

#### Scenario: Numero sequence is independent per empresa
- **WHEN** two `CALIDAD` NCs already exist for `empresa-001` and none exist yet for `empresa-002`, and `POST /api/nonconformities` is requested with `dominio: 'CALIDAD'` from a session whose active empresa is `empresa-002`
- **THEN** the created NC's `numero` is the first correlative for `empresa-002` (e.g. `NC-CAL-2025-001`), not the third overall

#### Scenario: Create rejects when session has no active empresa
- **WHEN** `POST /api/nonconformities` is requested and the session's `empresaActivaId` is `null`
- **THEN** the response status is 401 and no NC is added to the store

## ADDED Requirements

### Requirement: Empresa-scoped isolation across all by-id nonconformity operations
Every MSW handler in `nonconformities.handlers.ts` that operates on an existing NC identified by `:id` or `:ncId` — including `PATCH /api/nonconformities/:id`, `DELETE /api/nonconformities/:id`, `PATCH /api/nonconformities/:id/restore`, `POST /api/nonconformities/:id/anular`, `POST /api/nonconformities/:ncId/acciones-correctivas`, `PATCH /api/nonconformities/:id/acciones-correctivas/:acId`, and `POST /api/nonconformities/:id/acciones-correctivas/:acId/cerrar` — SHALL first verify that the NC's `empresaId` matches the session's active empresa before performing any further validation or mutation. Accion correctiva sub-resources do not carry their own `empresaId`; their isolation SHALL be enforced entirely through the parent NC lookup. When the parent NC's `empresaId` does not match, the handler SHALL respond exactly as it would for a non-existent NC id (`404` with `{ success: false, message: 'nonconformities:errors.notFound' }`), without performing the requested operation.

#### Scenario: Edit on another empresa's NC is rejected as not found
- **WHEN** `PATCH /api/nonconformities/:id` is requested for an NC id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`, and the NC is unchanged

#### Scenario: Anular on another empresa's NC is rejected as not found
- **WHEN** `POST /api/nonconformities/:id/anular` is requested for an NC id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`, and the NC's `estado` is unchanged

#### Scenario: Accion correctiva sub-resource on another empresa's NC is rejected as not found
- **WHEN** `POST /api/nonconformities/:ncId/acciones-correctivas` is requested for an `:ncId` that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is HTTP 404 with `{ success: false, message: 'nonconformities:errors.notFound' }`, and no accion correctiva is created
