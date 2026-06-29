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
The handler MUST filter the in-memory incidents array based on query params and return a paginated `ApiResponse`.

#### Scenario: No params returns 13 non-deleted incidents
- **WHEN** `GET /api/incidents` is requested with no query params
- **THEN** the response `data.items` contains 13 incidents (fixture #14 excluded) and `success: true`

#### Scenario: showDeleted=true returns all 14
- **WHEN** `GET /api/incidents?showDeleted=true` is requested
- **THEN** `data.items` contains all 14 incidents

#### Scenario: Filter by tipo
- **WHEN** `GET /api/incidents?tipo=ACCIDENTE` is requested
- **THEN** only incidents with `tipo === 'ACCIDENTE'` and no `deletedAt` are returned

#### Scenario: Filter by fechaDesde and fechaHasta
- **WHEN** `GET /api/incidents?fechaDesde=2026-03-01&fechaHasta=2026-03-31` is requested
- **THEN** only incidents where `fechaEvento` falls within March 2026 are returned

#### Scenario: Search filters by descripcion and numero
- **WHEN** `GET /api/incidents?search=INC-2026-005` is requested
- **THEN** only fixtures whose `numero` or `descripcion` contains the search string (case-insensitive) are returned

#### Scenario: Pagination is applied
- **WHEN** `GET /api/incidents?page=1&pageSize=5` is requested
- **THEN** `data.items.length <= 5` and `data.pagination.page === 1`

### Requirement: GET /api/incidents/:id
The handler MUST return the incident with the matching `id` or 404.

#### Scenario: Known id returns incident
- **WHEN** `GET /api/incidents/inc-001` is requested
- **THEN** the response is 200 with `data` being the incident with `id === 'inc-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/incidents/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Soft-deleted incident is findable by id
- **WHEN** `GET /api/incidents/inc-014` is requested (the soft-deleted fixture)
- **THEN** the response is 200 with the incident including `deletedAt`

### Requirement: POST /api/incidents
The handler MUST validate required fields, compute severidad, assign numero, and return 201.

#### Scenario: Missing required field returns 400
- **WHEN** `POST /api/incidents` is called with a body that has `descripcion` shorter than 20 characters
- **THEN** the response status is 400 and `success: false`

#### Scenario: Severidad auto-calculated for ACCIDENTE with 2 lesionados
- **WHEN** `POST /api/incidents` is called with `tipo: 'ACCIDENTE'`, `huboLesionados: true`, `numPersonasAfectadas: 2`, and no `severidad`
- **THEN** the created incident has `severidad: 'CRITICA'`

#### Scenario: Numero auto-incremented
- **WHEN** `POST /api/incidents` is called with a valid body
- **THEN** the response incident has `numero` starting with `INC-2026-` and `estado: 'ABIERTO'`

#### Scenario: Reporte tardio detected
- **WHEN** `POST /api/incidents` is called with `fechaEvento` more than 24h before the current timestamp
- **THEN** the created incident's `auditTrail` includes an entry with `accion: 'REPORTE_TARDIO'`

### Requirement: PATCH /api/incidents/:id
The handler MUST update investigation fields in memory and return 200.

#### Scenario: Update condicionesEntorno
- **WHEN** `PATCH /api/incidents/inc-003` is called with `{ condicionesEntorno: ['PISO'] }`
- **THEN** the response is 200 with `data.condicionesEntorno` containing `['PISO']`

### Requirement: PATCH /api/incidents/:id/status with transition validation
The handler MUST validate that the requested estado is a valid transition from the current estado, then update and return 200 or 422.

#### Scenario: Valid transition succeeds
- **WHEN** `PATCH /api/incidents/inc-003/status` is called with `{ estado: 'EN_INVESTIGACION' }` and current estado is `ABIERTO`
- **THEN** the response is 200 and `data.estado` is `'EN_INVESTIGACION'`

#### Scenario: Invalid transition returns 422
- **WHEN** `PATCH /api/incidents/inc-001/status` is called with `{ estado: 'ABIERTO' }` and current estado is `CERRADO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Audit trail entry added on status change
- **WHEN** a valid status transition is made
- **THEN** a new `AuditTrailEntry` is appended to the incident's `auditTrail` with `estadoAnterior` and `estadoNuevo`

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
The handler MUST append a new `AccionCorrectivaIncidente` to the incident and return 201.

#### Scenario: AC created and appended
- **WHEN** `POST /api/incidents/inc-005/acciones` is called with a valid body
- **THEN** the response status is 201 and the incident's `accionesCorrectivas` array grows by 1

### Requirement: PATCH /api/incidents/:incidenteId/acciones/:acId
The handler MUST update the specific AC within the incident and return 200.

#### Scenario: AC updated
- **WHEN** `PATCH /api/incidents/inc-005/acciones/ac-inc-001` is called with `{ estado: 'COMPLETADA' }`
- **THEN** the response is 200 and the AC's `estado` is `'COMPLETADA'`

### Requirement: Registered in handlers/index.ts
`incidentHandlers` MUST be imported from `incidents.handlers.ts` and spread into the `handlers` array in `src/mocks/handlers/index.ts` without removing M1 or M2 handlers.

#### Scenario: handlers/index.ts includes incidentHandlers
- **WHEN** `handlers/index.ts` is imported
- **THEN** the exported `handlers` array contains all handlers from `incidentHandlers`
