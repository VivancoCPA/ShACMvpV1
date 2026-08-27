## MODIFIED Requirements

### Requirement: GET /api/quality-events with filtering and correct pagination
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, `soloReincidencias`, and `search` (case-insensitive substring match on `numero` and `descripcion`), then slice the result for pagination. Before any other filter is applied, the handler SHALL restrict the candidate set to quality events whose `empresaId` matches the `empresaActivaId` of the requesting session; quality events belonging to any other `empresaId` SHALL never appear in `data.data` or count toward `pagination.totalItems`, regardless of other filters. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

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

#### Scenario: Listing scope matches selection scope for batch export
- **WHEN** a user authenticated against `empresa-001` opens `QEList` and selects all visible rows for batch export
- **THEN** none of the selected QE ids belong to `empresa-002`, because the underlying `GET /api/quality-events` response never included them

#### Scenario: Filter by search substring on numero or descripcion
- **WHEN** `GET /api/quality-events?search=corros` is requested
- **THEN** only fixtures whose `numero` or `descripcion` includes 'corros' (case-insensitive) and `empresaId` equal to the session's active empresa are included

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

## ADDED Requirements

### Requirement: POST /api/quality-events/:id/documentos-vinculados link handler
The system SHALL provide an MSW v2 handler for `POST /api/quality-events/:id/documentos-vinculados` (body `{ documentoId }`) that adds a `DocumentoVinculadoResumen` entry (derived from `getDocumentsStore()`, same cross-domain store pattern already used by `dashboard.handlers.ts`) to the target QE's `documentosVinculados`, and symmetrically adds a `QeVinculadoResumen` entry to the target document's `qeVinculados` in `getDocumentsStore()`. Creation SHALL be idempotent. Both the QE id and the `documentoId` SHALL be scoped to the session's active empresa — a mismatch on either side responds 404. All responses SHALL be delayed by 400 ms.

#### Scenario: Linking a document for the first time
- **WHEN** `POST /api/quality-events/qe-001/documentos-vinculados` is requested with `{ documentoId: 'doc-002' }` and no prior link exists
- **THEN** the response status is 200/201, `data.documentosVinculados` includes an entry with `id: 'doc-002'`, and `GET /api/documents/doc-002` now includes `qe-001` in `qeVinculados`

#### Scenario: Linking the same pair twice is idempotent
- **WHEN** `POST /api/quality-events/qe-001/documentos-vinculados` is requested twice with the same `documentoId`
- **THEN** both responses are successful and `data.documentosVinculados` contains exactly one entry for that document

### Requirement: DELETE /api/quality-events/:id/documentos-vinculados/:documentoId unlink handler
The system SHALL provide an MSW v2 handler for `DELETE /api/quality-events/:id/documentos-vinculados/:documentoId` that removes the link symmetrically from both the QE's `documentosVinculados` and the document's `qeVinculados`. The handler SHALL respond 404 if the pair is not currently linked. All responses SHALL be delayed by 400 ms.

#### Scenario: Unlinking an existing pair
- **WHEN** `DELETE /api/quality-events/qe-001/documentos-vinculados/doc-002` is requested and that pair is linked
- **THEN** the response status is 200, `data.documentosVinculados` no longer includes `doc-002`, and `GET /api/documents/doc-002` no longer includes `qe-001`

#### Scenario: Unlinking a pair that is not linked
- **WHEN** `DELETE /api/quality-events/:id/documentos-vinculados/:documentoId` is requested and that pair was never linked
- **THEN** the response status is 404

### Requirement: Handlers registered in index.ts (documentos-vinculados)
`qualityEventHandlers` SHALL include the `POST`/`DELETE /api/quality-events/:id/documentos-vinculados[...]` handlers, spread into the `handlers` array in `src/mocks/handlers/index.ts` alongside the existing QE handlers.

#### Scenario: documentos-vinculados handlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** `POST`/`DELETE /api/quality-events/:id/documentos-vinculados[...]` are intercepted without 'unhandled request' warnings
