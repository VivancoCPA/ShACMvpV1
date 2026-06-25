## Purpose

MSW v2 request handlers for the M1 Document module. All handlers live in `src/mocks/handlers/documents.handlers.ts`, operate on an in-memory store seeded from `documentFixtures`, enforce business rules RN-DOC-001 through RN-DOC-006, and apply a 400 ms delay to every response.

## Requirements

### Requirement: GET /api/documents list handler
The system SHALL provide an MSW v2 handler for `GET /api/documents` in `src/mocks/handlers/documents.handlers.ts` that returns a paginated `ApiResponse<Documento[]>`. The handler SHALL support filtering by `estado`, `tipo`, `area`, and `search` (case-insensitive substring match on `titulo` and `codigo`) query parameters. Pagination SHALL use `page` (default 1) and `pageSize` (default 10) query parameters. All responses SHALL be delayed by 400 ms.

#### Scenario: List handler returns all documents when no filters applied
- **WHEN** `GET /api/documents` is requested with no query parameters
- **THEN** the response status is 200 and `data` contains all 10 fixture documents with correct pagination metadata

#### Scenario: List handler filters by estado
- **WHEN** `GET /api/documents?estado=PUBLICADO` is requested
- **THEN** the response `data` array contains only documents with `estado === 'PUBLICADO'`

#### Scenario: List handler filters by search substring
- **WHEN** `GET /api/documents?search=pol` is requested
- **THEN** the response `data` array contains only documents whose `titulo` or `codigo` includes 'pol' (case-insensitive)

#### Scenario: List handler returns correct pagination metadata
- **WHEN** `GET /api/documents?page=1&pageSize=5` is requested
- **THEN** `pagination.page` is 1, `pagination.pageSize` is 5, `pagination.totalItems` reflects the full unfiltered count, and `data.length` is at most 5

### Requirement: GET /api/documents/:id detail handler
The system SHALL provide an MSW v2 handler for `GET /api/documents/:id` that returns the matching document or a 404 error response. All responses SHALL be delayed by 400 ms.

#### Scenario: Detail handler returns document for valid id
- **WHEN** `GET /api/documents/doc-001` is requested and `doc-001` exists in the in-memory store
- **THEN** the response status is 200 and `data` is the matching `Documento`

#### Scenario: Detail handler returns 404 for unknown id
- **WHEN** `GET /api/documents/nonexistent` is requested
- **THEN** the response status is 404 and `success` is `false`

### Requirement: POST /api/documents create handler
The system SHALL provide an MSW v2 handler for `POST /api/documents` that creates a new document in `BORRADOR` state, generates a unique `id` (UUID v4 pattern), assigns the next available `codigo` for the given `tipo`, sets `version` to `v1.0`, and appends the document to the in-memory store. All responses SHALL be delayed by 400 ms.

#### Scenario: Create handler returns new BORRADOR document
- **WHEN** `POST /api/documents` is requested with a valid `CreateDocumentInput` body
- **THEN** the response status is 201, `data.estado` is `'BORRADOR'`, `data.version` is `'v1.0'`, and `data.id` is a non-empty string

#### Scenario: Create handler stores the new document
- **WHEN** a document is created via `POST /api/documents`
- **THEN** a subsequent `GET /api/documents/:id` with the returned `id` returns the same document

### Requirement: PUT /api/documents/:id update handler
The system SHALL provide an MSW v2 handler for `PUT /api/documents/:id` that applies partial updates to the document. The handler SHALL reject updates to documents not in `BORRADOR` state with a 409 response. All responses SHALL be delayed by 400 ms.

#### Scenario: Update handler applies changes to BORRADOR document
- **WHEN** `PUT /api/documents/doc-borrador-id` is requested with `{ titulo: 'Nuevo Título' }`
- **THEN** the response status is 200 and `data.titulo` is `'Nuevo Título'`

#### Scenario: Update handler rejects changes to non-BORRADOR document
- **WHEN** `PUT /api/documents/doc-publicado-id` is requested for a PUBLICADO document
- **THEN** the response status is 409 and `success` is `false`

### Requirement: POST /api/documents/:id/status transition handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/status` that validates the state transition using `DOC_STATUS_TRANSITIONS`, enforces RN-DOC-001 through RN-DOC-006, and records an `AuditTrailEntry` for each successful transition. The handler SHALL require a non-empty `firma` field in the request body (RN-DOC-004). All responses SHALL be delayed by 400 ms.

#### Scenario: Valid transition updates estado and records audit trail
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'EN_REVISION', firma: '1234' }`
- **THEN** the response status is 200, `data.estado` is `'EN_REVISION'`, and `data.auditTrail` contains a new entry with `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Invalid transition rejects with 422 (RN-DOC-001 / state machine)
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'PUBLICADO', firma: '1234' }` (BORRADOR → PUBLICADO is not a valid transition)
- **THEN** the response status is 422 and `success` is `false`

#### Scenario: Publishing obsoletes the previous published version (RN-DOC-001)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`
- **THEN** any other document in the in-memory store with the same `codigo` and `estado === 'PUBLICADO'` is set to `OBSOLETO`

#### Scenario: Missing firma field rejects with 400 (RN-DOC-004)
- **WHEN** `POST /api/documents/:id/status` is requested without a `firma` field
- **THEN** the response status is 400 and `success` is `false`

#### Scenario: Transitioning linked PUBLICADO document to OBSOLETO is blocked if QE active (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` requests `OBSOLETO` on a document that has `qeVinculados` containing an active QE id
- **THEN** the response status is 409 and the error message references the linked QE

### Requirement: DELETE /api/documents/:id delete handler
The system SHALL provide an MSW v2 handler for `DELETE /api/documents/:id` that removes the document from the in-memory store. The handler SHALL reject deletion of non-BORRADOR documents with 409 and documents with non-empty `qeVinculados` with 409. All responses SHALL be delayed by 400 ms.

#### Scenario: Delete BORRADOR document with no QEs succeeds
- **WHEN** `DELETE /api/documents/doc-borrador-id` is requested for a BORRADOR document with empty `qeVinculados`
- **THEN** the response status is 200 and a subsequent GET for that id returns 404

#### Scenario: Delete non-BORRADOR document rejects
- **WHEN** `DELETE /api/documents/doc-publicado-id` is requested
- **THEN** the response status is 409 and `success` is `false`

### Requirement: Handlers registered in index.ts
The `documentHandlers` array from `documents.handlers.ts` SHALL be imported and spread into the combined handlers array in `src/mocks/handlers/index.ts`.

#### Scenario: documentHandlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** all six `/api/documents` route patterns are intercepted without 'unhandled request' warnings
