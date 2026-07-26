## MODIFIED Requirements

### Requirement: GET /api/quality-events with filtering and correct pagination
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, and `soloReincidencias`, then slice the result for pagination. Before any other filter is applied, the handler SHALL restrict the candidate set to quality events whose `empresaId` matches the `empresaActivaId` of the requesting session; quality events belonging to any other `empresaId` SHALL never appear in `data.data` or count toward `pagination.totalItems`, regardless of other filters. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

#### Scenario: No params returns first 10 fixtures for the active empresa
- **WHEN** `GET /api/quality-events` is requested with no query params
- **THEN** `data.data.length <= 10`, `pagination.page === 1`, and `pagination.totalItems` equals the count of fixtures whose `empresaId` matches the session's active empresa

#### Scenario: Second page returns remaining fixtures
- **WHEN** `GET /api/quality-events?page=2` is requested
- **THEN** `pagination.page === 2` and `data.data` contains the empresa-scoped fixtures from index 10 onward

#### Scenario: totalPages reflects full fixture set for the active empresa
- **WHEN** `GET /api/quality-events` is requested with 20 fixtures belonging to the active empresa and default pageSize 10
- **THEN** `pagination.totalPages === 2` and `pagination.totalItems === 20`

#### Scenario: Filter by estado
- **WHEN** `GET /api/quality-events?estado=ABIERTO` is requested
- **THEN** only fixtures with `estado === 'ABIERTO'` and `empresaId` equal to the session's active empresa are included before pagination

#### Scenario: Filter by tipo
- **WHEN** `GET /api/quality-events?tipo=SST` is requested
- **THEN** only fixtures with `tipo === 'SST'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by severidad
- **WHEN** `GET /api/quality-events?severidad=CRITICA` is requested
- **THEN** only fixtures with `severidad === 'CRITICA'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by origen
- **WHEN** `GET /api/quality-events?origen=O1_INCIDENTE_CAMPO` is requested
- **THEN** only fixtures with `origen === 'O1_INCIDENTE_CAMPO'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by fechaDesde compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaDesde=2026-04-01` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) >= new Date('2026-04-01')` and `empresaId` equal to the session's active empresa are returned

#### Scenario: Filter by fechaHasta compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaHasta=2026-03-31` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) <= new Date('2026-03-31')` and `empresaId` equal to the session's active empresa are returned

#### Scenario: Combined fechaDesde and fechaHasta narrows result correctly
- **WHEN** `GET /api/quality-events?fechaDesde=2026-02-01&fechaHasta=2026-02-28` is requested
- **THEN** only fixtures whose `fechaHoraEvento` falls within February 2026 and `empresaId` matches the session's active empresa are returned

#### Scenario: soloReincidencias=true filters to ciclo > 1
- **WHEN** `GET /api/quality-events?soloReincidencias=true` is requested
- **THEN** only fixtures with `ciclo > 1` and `empresaId` equal to the session's active empresa are included

#### Scenario: Empty result set returns valid pagination
- **WHEN** all fixtures are filtered out (e.g., `estado=VERIFICADO` when none exist for the active empresa)
- **THEN** `data.data` is an empty array, `pagination.totalItems === 0`, and `pagination.totalPages === 0`

#### Scenario: List excludes quality events from another empresa
- **WHEN** the session's active empresa is `empresa-001` and `GET /api/quality-events` is requested with no filters
- **THEN** no quality event with `empresaId === 'empresa-002'` appears anywhere in `data.data`, even if it would otherwise match every other filter

---

### Requirement: GET /api/quality-events/:id
The handler SHALL return the quality event with the matching `id` or 404. A quality event whose `empresaId` does not match the session's active empresa SHALL be treated identically to a non-existent id: the handler returns 404 with no distinct error message that would reveal the quality event exists in another empresa.

#### Scenario: Known id returns quality event
- **WHEN** `GET /api/quality-events/qe-001` is requested and `qe-001.empresaId` matches the session's active empresa
- **THEN** the response is 200 with `data` being the fixture with `id === 'qe-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Quality event belonging to another empresa returns 404
- **WHEN** `GET /api/quality-events/:id` is requested for an id that exists in the store but whose `empresaId` differs from the session's active empresa
- **THEN** the response status is 404, `success: false`, and the response body is indistinguishable from the unknown-id case

---

## ADDED Requirements

### Requirement: POST /api/quality-events assigns empresa-scoped numero and empresaId
The handler SHALL generate the new quality event's `numero` (`QE-2026-NNN`) with the correlative count scoped to the session's active empresa (RN-EMP-003 — two empresas can each have an independent `numero` sequence without colliding), and SHALL set `empresaId` to the session's active empresa rather than a hardcoded value. If the requesting session has no active empresa, the handler SHALL reject the request with 401 instead of creating a quality event.

#### Scenario: Created quality event carries the active empresa
- **WHEN** `POST /api/quality-events` is requested with a valid body from a session whose active empresa is `empresa-002`
- **THEN** the response status is 201 and `data.empresaId === 'empresa-002'`

#### Scenario: Numero sequence is independent per empresa
- **WHEN** five quality events already exist for `empresa-001` and none exist yet for `empresa-002`, and `POST /api/quality-events` is requested from a session whose active empresa is `empresa-002`
- **THEN** the created quality event's `numero` is `QE-2026-001` (the first for `empresa-002`), not `QE-2026-006`

#### Scenario: Create rejects when session has no active empresa
- **WHEN** `POST /api/quality-events` is requested and the session's `empresaActivaId` is `null`
- **THEN** the response status is 401 and no quality event is added to the store

### Requirement: Empresa-scoped isolation across all by-id quality event operations
Every MSW handler in `quality-events.handlers.ts` that operates on an existing quality event identified by `:id` — including `PATCH /api/quality-events/:id`, `PATCH /api/quality-events/:id/status`, `DELETE /api/quality-events/:id`, `PATCH /api/quality-events/:id/reactivar`, `POST /api/quality-events/:id/export-pdf`, the `acciones-correctivas` sub-resource endpoints (including `solicitud-plazo`), `PATCH /api/quality-events/:id/cerrar`, `PATCH /api/quality-events/:id/firmar-cierre`, `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, `POST /api/quality-events/:id/verificacion-eficacia`, `PATCH /api/quality-events/:id/solicitar-ac`, `GET /api/quality-events/:id/audit-trail`, `PATCH /api/quality-events/:id/editar-reporte-inicial`, `PATCH /api/quality-events/:id/editar-severidad`, and `PATCH /api/quality-events/:id/editar-mineral` — SHALL first verify that the quality event's `empresaId` matches the session's active empresa before performing any further validation or mutation. Accion correctiva sub-resources do not carry their own `empresaId`; their isolation SHALL be enforced entirely through the parent quality event lookup. When the parent quality event's `empresaId` does not match, the handler SHALL respond exactly as it would for a non-existent quality event id, without performing the requested operation.

#### Scenario: Cierre/firma on another empresa's quality event is rejected as not found
- **WHEN** `PATCH /api/quality-events/:id/cerrar` or `PATCH /api/quality-events/:id/firmar-cierre` is requested for a quality event id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the quality event's `estado` is unchanged

#### Scenario: Accion correctiva sub-resource on another empresa's quality event is rejected as not found
- **WHEN** any `acciones-correctivas` sub-resource endpoint is requested with an `:id` that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown quality event id, and no accion correctiva is created or modified

#### Scenario: Audit trail on another empresa's quality event is rejected as not found
- **WHEN** `GET /api/quality-events/:id/audit-trail` is requested for a quality event id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id
