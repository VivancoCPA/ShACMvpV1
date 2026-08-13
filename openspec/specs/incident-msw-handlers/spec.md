# Spec: incident-msw-handlers

## Purpose

MSW v2 request handlers for the Incidents module (`src/mocks/handlers/incidents.handlers.ts`). Intercepts all REST endpoints for incidents and corrective actions, applying in-memory filtering, pagination, transition validation, and audit trail updates so development works without a real backend.

---

## Requirements

### Requirement: MSW v2 syntax exclusively
All handlers MUST use `http.*` from `msw`. The `rest.*` API MUST NOT be used anywhere in the file. Simulated latency MUST be `await delay(400)` at the start of every handler.

#### Scenario: Import verification
- **WHEN** `incidents.handlers.ts` is imported
- **THEN** only `http`, `HttpResponse`, and `delay` are imported from `msw` (no `rest`)

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

### Requirement: PATCH /api/incidents/:id
The handler MUST update investigation fields in memory and return 200.

#### Scenario: Update condicionesEntorno
- **WHEN** `PATCH /api/incidents/inc-003` is called with `{ condicionesEntorno: ['PISO'] }`
- **THEN** the response is 200 with `data.condicionesEntorno` containing `['PISO']`

### Requirement: PATCH /api/incidents/:id/status with transition validation
The handler MUST validate that the requested estado is a valid transition from the current estado, then update and return 200 or 422. On a valid transition, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) targeting the incident's `reportadoPorId` and the responsables of any of the incident's `accionesCorrectivas` not in a closed state, excluding the acting user and any unresolvable id (RN-NOTIF-001).

#### Scenario: Valid transition succeeds
- **WHEN** `PATCH /api/incidents/inc-003/status` is called with `{ estado: 'EN_INVESTIGACION' }` and current estado is `ABIERTO`
- **THEN** the response is 200 and `data.estado` is `'EN_INVESTIGACION'`

#### Scenario: Invalid transition returns 422
- **WHEN** `PATCH /api/incidents/inc-001/status` is called with `{ estado: 'ABIERTO' }` and current estado is `CERRADO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Audit trail entry added on status change
- **WHEN** a valid status transition is made
- **THEN** a new `AuditTrailEntry` is appended to the incident's `auditTrail` with `estadoAnterior` and `estadoNuevo`

#### Scenario: Valid transition notifies the reporter
- **WHEN** `PATCH /api/incidents/inc-003/status` transitions from `ABIERTO` to `EN_INVESTIGACION` and the acting user is not the incident's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the incident's `reportadoPorId`

#### Scenario: Acting reporter does not notify themselves
- **WHEN** the acting user performing the transition is the incident's `reportadoPorId`
- **THEN** no notification is created for the acting user

### Requirement: DELETE /api/incidents/:id (soft delete)
The handler MUST only allow deletion of incidents in `ABIERTO` state with no `deletedAt`.

#### Scenario: Delete ABIERTO incident sets deletedAt
- **WHEN** `DELETE /api/incidents/:id` is called for an incident with `estado: 'ABIERTO'`
- **THEN** the response is 200 and the incident's `deletedAt` is set to the current ISO timestamp

#### Scenario: Delete non-ABIERTO incident returns 422
- **WHEN** `DELETE /api/incidents/:id` is called for an incident with `estado: 'EN_INVESTIGACION'`
- **THEN** the response status is 422 with a descriptive message

### Requirement: PATCH /api/incidents/:id/restore
The handler MUST clear `deletedAt` from a soft-deleted incident.

#### Scenario: Restore sets deletedAt to undefined
- **WHEN** `PATCH /api/incidents/inc-014/restore` is called
- **THEN** the response is 200 and the incident's `deletedAt` is `undefined`

#### Scenario: Restore non-deleted incident returns 422
- **WHEN** `PATCH /api/incidents/inc-001/restore` is called (not deleted)
- **THEN** the response status is 422

### Requirement: POST /api/incidents/:id/acciones
The handler MUST append a new `AccionCorrectivaIncidente` to the incident and return 201. The created AC's `responsableNombre` SHALL be resolved from the request's `responsableId` via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) — the handler SHALL NOT persist `undefined`, a raw unresolved id, or an otherwise corrupted value for any `responsableId` that resolves to a real `authFixtures` account or a `seedLegacyNames` entry.

#### Scenario: AC created and appended
- **WHEN** `POST /api/incidents/inc-005/acciones` is called with a valid body
- **THEN** the response status is 201 and the incident's `accionesCorrectivas` array grows by 1

#### Scenario: POST resolves responsableNombre for a real, non-legacy account
- **WHEN** `POST /api/incidents/inc-005/acciones` is called with `{ ..., responsableId: 'user-supervisor-002' }`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the created AC's `responsableNombre` is the resolved display name, never `undefined` or a raw id fragment

### Requirement: PATCH /api/incidents/:incidenteId/acciones/:acId
The handler MUST update the specific AC within the incident and return 200.

#### Scenario: AC updated
- **WHEN** `PATCH /api/incidents/inc-005/acciones/ac-inc-001` is called with `{ estado: 'COMPLETADA' }`
- **THEN** the response is 200 and the AC's `estado` is `'COMPLETADA'`

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

### Requirement: GET /api/locales handler (ADD-03)
The handler MUST return all active locales from `localFixtures` as `ApiResponse<Local[]>` with status 200. The response SHALL include only locales with `activo: true`. The handler MUST apply the standard 400ms simulated latency.

#### Scenario: Returns 4 active locales
- **WHEN** `GET /api/locales` is requested
- **THEN** the response is 200, `success: true`, and `data` is an array of 4 `Local` objects

#### Scenario: Response format matches ApiResponse
- **WHEN** `GET /api/locales` is requested
- **THEN** the response body has `{ data: Local[], success: true }` with no `pagination` field (full list, no paging)

---

### Requirement: GET /api/locales/:localId/zonas handler (ADD-03)
The handler MUST filter `zonaFixtures` by the `localId` path parameter and return only active zones as `ApiResponse<Zona[]>` with status 200. If the `localId` does not match any local in `localFixtures`, the handler SHALL return 404 with `success: false`. The handler MUST apply the standard 400ms simulated latency.

#### Scenario: Returns zones for LOC-001
- **WHEN** `GET /api/locales/loc-001/zonas` is requested
- **THEN** the response is 200 and `data` contains exactly 4 `Zona` objects whose `localId === 'loc-001'`

#### Scenario: Returns zones for LOC-003
- **WHEN** `GET /api/locales/loc-003/zonas` is requested
- **THEN** the response is 200 and `data` contains exactly 3 `Zona` objects whose `localId === 'loc-003'`

#### Scenario: Unknown localId returns 404
- **WHEN** `GET /api/locales/loc-999/zonas` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: Registered in handlers/index.ts
`incidentHandlers` MUST be imported from `incidents.handlers.ts` and spread into the `handlers` array in `src/mocks/handlers/index.ts` without removing M1 or M2 handlers. The local and zona handlers SHALL be included within `incidentHandlers` (not a separate export).

#### Scenario: handlers/index.ts includes incidentHandlers
- **WHEN** `handlers/index.ts` is imported
- **THEN** the exported `handlers` array contains all handlers from `incidentHandlers`
