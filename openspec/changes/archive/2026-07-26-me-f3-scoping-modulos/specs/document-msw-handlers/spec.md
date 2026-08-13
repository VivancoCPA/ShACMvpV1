## MODIFIED Requirements

### Requirement: GET /api/documents list handler
The system SHALL provide an MSW v2 handler for `GET /api/documents` in `src/mocks/handlers/documents.handlers.ts` that returns a paginated `ApiResponse<Documento[]>`. The handler SHALL support filtering by `estado`, `tipo`, `area`, and `search` (case-insensitive substring match on `titulo` and `codigo`) query parameters. Pagination SHALL use `page` (default 1) and `pageSize` (default 10) query parameters. Before any other filter is applied, the handler SHALL restrict the candidate set to documents whose `empresaId` matches the `empresaActivaId` of the requesting session (`useAuthStore.getState().empresaActivaId`); documents belonging to any other `empresaId` SHALL never appear in `data` or count toward `pagination.totalItems`, regardless of other filters. All responses SHALL be delayed by 400 ms.

#### Scenario: List handler returns all documents when no filters applied
- **WHEN** `GET /api/documents` is requested with no query parameters
- **THEN** the response status is 200 and `data` contains all fixture documents belonging to the session's active empresa, with correct pagination metadata

#### Scenario: List handler filters by estado
- **WHEN** `GET /api/documents?estado=PUBLICADO` is requested
- **THEN** the response `data` array contains only documents with `estado === 'PUBLICADO'` and `empresaId` equal to the session's active empresa

#### Scenario: List handler filters by search substring
- **WHEN** `GET /api/documents?search=pol` is requested
- **THEN** the response `data` array contains only documents whose `titulo` or `codigo` includes 'pol' (case-insensitive) and `empresaId` equal to the session's active empresa

#### Scenario: List handler returns correct pagination metadata
- **WHEN** `GET /api/documents?page=1&pageSize=5` is requested
- **THEN** `pagination.page` is 1, `pagination.pageSize` is 5, `pagination.totalItems` reflects the full unfiltered count scoped to the active empresa, and `data.length` is at most 5

#### Scenario: List handler excludes documents from another empresa
- **WHEN** the session's active empresa is `empresa-001` and `GET /api/documents` is requested with no filters
- **THEN** no document with `empresaId === 'empresa-002'` appears anywhere in `data`, even if it would otherwise match every other filter

#### Scenario: Switching active empresa changes the list without any query param change
- **WHEN** `GET /api/documents` is requested, then the session's active empresa changes (e.g. via `switch-empresa`), then the identical `GET /api/documents` request is repeated
- **THEN** the second response's `data` contains only documents of the new active empresa, and no document from the previous active empresa

### Requirement: GET /api/documents/:id detail handler
The system SHALL provide an MSW v2 handler for `GET /api/documents/:id` that returns the matching document or a 404 error response. A document whose `empresaId` does not match the session's active empresa SHALL be treated identically to a non-existent id: the handler returns the same 404 response, with no distinct error message that would reveal the document exists in another empresa. All responses SHALL be delayed by 400 ms.

#### Scenario: Detail handler returns document for valid id
- **WHEN** `GET /api/documents/doc-001` is requested, `doc-001` exists in the in-memory store, and `doc-001.empresaId` matches the session's active empresa
- **THEN** the response status is 200 and `data` is the matching `Documento`

#### Scenario: Detail handler returns 404 for unknown id
- **WHEN** `GET /api/documents/nonexistent` is requested
- **THEN** the response status is 404 and `success` is `false`

#### Scenario: Detail handler returns 404 for a document belonging to another empresa
- **WHEN** `GET /api/documents/:id` is requested for an id that exists in the store but whose `empresaId` differs from the session's active empresa
- **THEN** the response status is 404, `success` is `false`, and the response body is indistinguishable from the unknown-id case

### Requirement: POST /api/documents create handler
The system SHALL provide an MSW v2 handler for `POST /api/documents` that creates a new document in `BORRADOR` state, generates a unique `id` (UUID v4 pattern), assigns the next available `codigo` for the given `tipo` **scoped to the session's active empresa** (RN-EMP-003 — the correlative count considers only documents whose `empresaId` matches the active empresa, so two empresas can each have an independent `codigo` sequence per `tipo` without colliding), sets `version` to `v1.0`, sets `empresaId` to the session's active empresa (never a client-supplied or hardcoded value), and appends the document to the in-memory store. If the requesting session has no active empresa (`empresaActivaId` is `null`), the handler SHALL reject the request with a 401 response instead of creating a document. When `revisorId` and/or `aprobadorId` are set on creation, the handler SHALL create an `ASIGNACION` notification (via `createAsignacionNotification`) for each, targeting that person, silently skipping any that is not a resolvable account or that equals the acting (creating) user. All responses SHALL be delayed by 400 ms.

#### Scenario: Create handler returns new BORRADOR document
- **WHEN** `POST /api/documents` is requested with a valid `CreateDocumentInput` body
- **THEN** the response status is 201, `data.estado` is `'BORRADOR'`, `data.version` is `'v1.0'`, `data.id` is a non-empty string, and `data.empresaId` equals the session's active empresa

#### Scenario: Create handler stores the new document
- **WHEN** a document is created via `POST /api/documents`
- **THEN** a subsequent `GET /api/documents/:id` with the returned `id`, made in a session with the same active empresa, returns the same document

#### Scenario: Creating a document with a revisorId notifies that revisor
- **WHEN** `POST /api/documents` is requested with `revisorId: 'user-supervisor-001'` distinct from the acting user
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-supervisor-001'`

#### Scenario: Codigo sequence is independent per empresa
- **WHEN** two documents of `tipo: 'PRC'` already exist for `empresa-001` and none exist yet for `empresa-002`, and `POST /api/documents` is requested with `tipo: 'PRC'` from a session whose active empresa is `empresa-002`
- **THEN** the created document's `codigo` is `PRC-CD-001` (the first for `empresa-002`), not `PRC-CD-003`

#### Scenario: Create rejects when session has no active empresa
- **WHEN** `POST /api/documents` is requested and the session's `empresaActivaId` is `null`
- **THEN** the response status is 401 and no document is added to the store

## ADDED Requirements

### Requirement: Empresa-scoped isolation across all by-id document operations
Every MSW handler in `documents.handlers.ts` that operates on an existing document identified by `:id` — including but not limited to `PUT /api/documents/:id`, `POST /api/documents/:id/status`, `PATCH /api/documents/:id/status`, `POST /api/documents/:id/sign`, `DELETE /api/documents/:id`, `POST /api/documents/:id/upload`, `POST /api/documents/:id/nueva-version`, `POST /api/documents/:id/exportar-pdf`, `GET /api/documents/:id/download-url`, `PATCH /api/documents/:id/confirmar-revision`, `PATCH /api/documents/:id/restaurar`, `POST /api/documents/:id/audit/access`, `GET /api/documents/:id/archivo-original`, `POST /api/documents/:id/archivo-original`, `GET /api/documents/:id/archivo-distribucion`, and `POST /api/documents/:id/publicar` — SHALL first verify that the document's `empresaId` matches the session's active empresa before performing any further validation or mutation. When it does not match, the handler SHALL respond exactly as it would for a non-existent id (same status code and error shape used elsewhere in that handler for a missing document), without performing the requested operation.

#### Scenario: Status transition on another empresa's document is rejected as not found
- **WHEN** `POST /api/documents/:id/status` (or `PATCH /api/documents/:id/status`) is requested for a document id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the document's `estado` is unchanged

#### Scenario: Delete on another empresa's document is rejected as not found
- **WHEN** `DELETE /api/documents/:id` is requested for a document id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the document remains in the store

#### Scenario: File download/upload sub-resources on another empresa's document are rejected as not found
- **WHEN** any of `GET /api/documents/:id/archivo-original`, `POST /api/documents/:id/archivo-original`, or `GET /api/documents/:id/archivo-distribucion` is requested for a document id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id
