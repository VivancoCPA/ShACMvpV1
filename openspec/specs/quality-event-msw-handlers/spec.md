# Spec: quality-event-msw-handlers

## Purpose

MSW v2 request handlers for the Quality Events module (`src/mocks/handlers/quality-events.handlers.ts`). Intercepts REST endpoints for quality events, applying in-memory filtering, correct server-side pagination, and audit trail updates so development works without a real backend.

---

## Requirements

### Requirement: MSW v2 syntax exclusively
All handlers SHALL use `http.*` from `msw`. The `rest.*` API SHALL NOT be used. Simulated latency SHALL be `await delay(400)` at the start of every handler.

#### Scenario: Import verification
- **WHEN** `quality-events.handlers.ts` is imported
- **THEN** only `http`, `HttpResponse`, and `delay` are imported from `msw` (no `rest`)

---

### Requirement: GET /api/quality-events with filtering and correct pagination
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, and `soloReincidencias`, then slice the result for pagination. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

#### Scenario: No params returns first 10 fixtures
- **WHEN** `GET /api/quality-events` is requested with no query params
- **THEN** `data.data.length <= 10`, `pagination.page === 1`, and `pagination.totalItems` equals the total fixture count

#### Scenario: Second page returns remaining fixtures
- **WHEN** `GET /api/quality-events?page=2` is requested
- **THEN** `pagination.page === 2` and `data.data` contains the fixtures from index 10 onward

#### Scenario: totalPages reflects full fixture set
- **WHEN** `GET /api/quality-events` is requested with 20 fixtures and default pageSize 10
- **THEN** `pagination.totalPages === 2` and `pagination.totalItems === 20`

#### Scenario: Filter by estado
- **WHEN** `GET /api/quality-events?estado=ABIERTO` is requested
- **THEN** only fixtures with `estado === 'ABIERTO'` are included before pagination

#### Scenario: Filter by tipo
- **WHEN** `GET /api/quality-events?tipo=SST` is requested
- **THEN** only fixtures with `tipo === 'SST'` are included

#### Scenario: Filter by severidad
- **WHEN** `GET /api/quality-events?severidad=CRITICA` is requested
- **THEN** only fixtures with `severidad === 'CRITICA'` are included

#### Scenario: Filter by origen
- **WHEN** `GET /api/quality-events?origen=O1_INCIDENTE_CAMPO` is requested
- **THEN** only fixtures with `origen === 'O1_INCIDENTE_CAMPO'` are included

#### Scenario: Filter by fechaDesde compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaDesde=2026-04-01` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) >= new Date('2026-04-01')` are returned

#### Scenario: Filter by fechaHasta compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaHasta=2026-03-31` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) <= new Date('2026-03-31')` are returned

#### Scenario: Combined fechaDesde and fechaHasta narrows result correctly
- **WHEN** `GET /api/quality-events?fechaDesde=2026-02-01&fechaHasta=2026-02-28` is requested
- **THEN** only fixtures whose `fechaHoraEvento` falls within February 2026 are returned

#### Scenario: soloReincidencias=true filters to ciclo > 1
- **WHEN** `GET /api/quality-events?soloReincidencias=true` is requested
- **THEN** only fixtures with `ciclo > 1` are included

#### Scenario: Empty result set returns valid pagination
- **WHEN** all fixtures are filtered out (e.g., `estado=VERIFICADO` when none exist)
- **THEN** `data.data` is an empty array, `pagination.totalItems === 0`, and `pagination.totalPages === 0`

---

### Requirement: GET /api/quality-events/:id
The handler SHALL return the quality event with the matching `id` or 404.

#### Scenario: Known id returns quality event
- **WHEN** `GET /api/quality-events/qe-001` is requested
- **THEN** the response is 200 with `data` being the fixture with `id === 'qe-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: Registered in handlers/index.ts
`qualityEventHandlers` SHALL be imported from `quality-events.handlers.ts` and spread into the `handlers` array in `src/mocks/handlers/index.ts` without removing handlers from other modules.

#### Scenario: handlers/index.ts includes qualityEventHandlers
- **WHEN** `handlers/index.ts` is imported
- **THEN** the exported `handlers` array contains all handlers from `qualityEventHandlers`

---

### Requirement: MSW sub-resource endpoints for QE acciones-correctivas
`quality-events.handlers.ts` SHALL register `GET /api/quality-events/:id/acciones-correctivas`, `POST /api/quality-events/:id/acciones-correctivas`, `PATCH /api/quality-events/:id/acciones-correctivas/:acId`, and `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status`. All four SHALL operate on the matching QE's `accionesCorrectivas` array in `qeStore` and return 404 with `success: false` when `:id` does not match a fixture QE.

#### Scenario: GET AC list for unknown QE returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: POST AC for unknown QE returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: PATCH status to CERRADA requires descripcionEvidencia
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA' }` and no `descripcionEvidencia`
- **THEN** the response status is 422 and `success: false`

---

### Requirement: MSW endpoint for QE audit-trail sub-resource
`quality-events.handlers.ts` SHALL register `GET /api/quality-events/:id/audit-trail`, returning the matching QE's `auditTrail` sorted by `timestamp` descending, or 404 with `success: false` when `:id` does not match a fixture QE.

#### Scenario: GET audit-trail for known QE returns sorted entries
- **WHEN** `GET /api/quality-events/qe-2026-001/audit-trail` is requested
- **THEN** the response is 200 with `data` sorted by `timestamp` descending

#### Scenario: GET audit-trail for unknown QE returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/audit-trail` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: PATCH /api/quality-events/:id/solicitar-ac increments solicitudesAC
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/solicitar-ac`, which increments the matching QE's `solicitudesAC` by 1 and returns the updated QE. Unknown `:id` SHALL return 404 with `success: false`.

#### Scenario: Known id increments solicitudesAC and returns updated QE
- **WHEN** `PATCH /api/quality-events/qe-2026-002/solicitar-ac` is requested for a QE with `solicitudesAC === 0`
- **THEN** the response is 200 with `data.solicitudesAC === 1`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/solicitar-ac` is requested
- **THEN** the response status is 404 and `success: false`
