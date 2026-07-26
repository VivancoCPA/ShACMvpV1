## MODIFIED Requirements

### Requirement: GET /api/incidents with filtering and pagination
The handler MUST filter the in-memory incidents array based on query params and return a paginated `ApiResponse`. Before any other filter is applied, the handler MUST restrict the candidate set to incidents whose `empresaId` matches the `empresaActivaId` of the requesting session; incidents belonging to any other `empresaId` MUST never appear in `data.items` or count toward `data.pagination.totalItems`, regardless of other filters.

#### Scenario: No params returns non-deleted incidents for the active empresa
- **WHEN** `GET /api/incidents` is requested with no query params
- **THEN** `data.items` contains only non-deleted incidents whose `empresaId` matches the session's active empresa, and `success: true`

#### Scenario: showDeleted=true returns all incidents for the active empresa
- **WHEN** `GET /api/incidents?showDeleted=true` is requested
- **THEN** `data.items` contains all incidents (including soft-deleted) whose `empresaId` matches the session's active empresa, and none from any other empresa

#### Scenario: Filter by tipo
- **WHEN** `GET /api/incidents?tipo=ACCIDENTE` is requested
- **THEN** only incidents with `tipo === 'ACCIDENTE'`, no `deletedAt`, and `empresaId` equal to the session's active empresa are returned

#### Scenario: Filter by fechaDesde and fechaHasta
- **WHEN** `GET /api/incidents?fechaDesde=2026-03-01&fechaHasta=2026-03-31` is requested
- **THEN** only incidents where `fechaEvento` falls within March 2026 and `empresaId` matches the session's active empresa are returned

#### Scenario: Search filters by descripcion and numero
- **WHEN** `GET /api/incidents?search=INC-2026-005` is requested
- **THEN** only fixtures whose `numero` or `descripcion` contains the search string (case-insensitive) and `empresaId` matches the session's active empresa are returned

#### Scenario: Pagination is applied
- **WHEN** `GET /api/incidents?page=1&pageSize=5` is requested
- **THEN** `data.items.length <= 5` and `data.pagination.page === 1`, scoped to the active empresa

#### Scenario: List excludes incidents from another empresa
- **WHEN** the session's active empresa is `empresa-001` and `GET /api/incidents` is requested with no filters
- **THEN** no incident with `empresaId === 'empresa-002'` appears anywhere in `data.items`, even if it would otherwise match every other filter

### Requirement: GET /api/incidents/:id
The handler MUST return the incident with the matching `id` or 404. An incident whose `empresaId` does not match the session's active empresa MUST be treated identically to a non-existent id: the handler returns 404 with no distinct error message that would reveal the incident exists in another empresa.

#### Scenario: Known id returns incident
- **WHEN** `GET /api/incidents/inc-001` is requested and `inc-001.empresaId` matches the session's active empresa
- **THEN** the response is 200 with `data` being the incident with `id === 'inc-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/incidents/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Soft-deleted incident is findable by id
- **WHEN** `GET /api/incidents/inc-014` is requested (the soft-deleted fixture) and its `empresaId` matches the session's active empresa
- **THEN** the response is 200 with the incident including `deletedAt`

#### Scenario: Incident belonging to another empresa returns 404
- **WHEN** `GET /api/incidents/:id` is requested for an id that exists in the store but whose `empresaId` differs from the session's active empresa
- **THEN** the response status is 404, `success: false`, and the response body is indistinguishable from the unknown-id case

### Requirement: POST /api/incidents
The handler MUST validate required fields, compute severidad, assign numero **scoped to the session's active empresa** (RN-EMP-003 — the correlative count considers only incidents whose `empresaId` matches the active empresa), set `empresaId` to the session's active empresa (never a hardcoded value), and return 201. If the requesting session has no active empresa, the handler MUST reject the request with 401 instead of creating an incident.

#### Scenario: Missing required field returns 400
- **WHEN** `POST /api/incidents` is called with a body that has `descripcion` shorter than 20 characters
- **THEN** the response status is 400 and `success: false`

#### Scenario: Severidad auto-calculated for ACCIDENTE with 2 lesionados
- **WHEN** `POST /api/incidents` is called with `tipo: 'ACCIDENTE'`, `huboLesionados: true`, `numPersonasAfectadas: 2`, and no `severidad`
- **THEN** the created incident has `severidad: 'CRITICA'`

#### Scenario: Numero auto-incremented within the active empresa
- **WHEN** `POST /api/incidents` is called with a valid body from a session whose active empresa is `empresa-001`
- **THEN** the response incident has `numero` starting with `INC-2026-`, `estado: 'ABIERTO'`, `empresaId: 'empresa-001'`, and the numeric suffix is the next consecutive value among `empresa-001` incidents only

#### Scenario: Reporte tardio detected
- **WHEN** `POST /api/incidents` is called with `fechaEvento` more than 24h before the current timestamp
- **THEN** the created incident's `auditTrail` includes an entry with `accion: 'REPORTE_TARDIO'`

#### Scenario: Numero sequence is independent per empresa
- **WHEN** three incidents already exist for `empresa-001` and none exist yet for `empresa-002`, and `POST /api/incidents` is requested from a session whose active empresa is `empresa-002`
- **THEN** the created incident's `numero` is the first correlative for `empresa-002` (e.g. `INC-2026-001`), not the fourth overall

#### Scenario: Create rejects when session has no active empresa
- **WHEN** `POST /api/incidents` is requested and the session's `empresaActivaId` is `null`
- **THEN** the response status is 401 and no incident is added to the store

## ADDED Requirements

### Requirement: Empresa-scoped isolation across all by-id incident operations
Every MSW handler in `incidents.handlers.ts` that operates on an existing incident identified by `:id` or `:incidenteId` — including `PATCH /api/incidents/:id`, `PATCH /api/incidents/:id/status`, `DELETE /api/incidents/:id`, `PATCH /api/incidents/:id/restore`, `POST /api/incidents/:id/acciones`, `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar`, and `PATCH /api/incidents/:incidenteId/acciones/:acId` — SHALL first verify that the incident's `empresaId` matches the session's active empresa before performing any further validation or mutation. Accion correctiva sub-resources do not carry their own `empresaId`; their isolation SHALL be enforced entirely through the parent incident lookup. When the parent incident's `empresaId` does not match, the handler SHALL respond exactly as it would for a non-existent incident id, without performing the requested operation.

#### Scenario: Status transition on another empresa's incident is rejected as not found
- **WHEN** `PATCH /api/incidents/:id/status` is requested for an incident id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the incident's `estado` is unchanged

#### Scenario: Accion correctiva sub-resource on another empresa's incident is rejected as not found
- **WHEN** `POST /api/incidents/:incidenteId/acciones` or `PATCH /api/incidents/:incidenteId/acciones/:acId` is requested for an `:incidenteId` that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown incident id, and no accion correctiva is created or modified

#### Scenario: Delete/restore on another empresa's incident is rejected as not found
- **WHEN** `DELETE /api/incidents/:id` or `PATCH /api/incidents/:id/restore` is requested for an incident id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the incident's `deletedAt` is unchanged
