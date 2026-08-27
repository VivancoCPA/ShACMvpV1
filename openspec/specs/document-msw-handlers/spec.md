## Purpose

MSW v2 request handlers for the M1 Document module. All handlers live in `src/mocks/handlers/documents.handlers.ts`, operate on an in-memory store seeded from `documentFixtures`, enforce business rules RN-DOC-001 through RN-DOC-006, and apply a 400 ms delay to every response.

## Requirements

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

### Requirement: PUT /api/documents/:id update handler
The system SHALL provide an MSW v2 handler for `PUT /api/documents/:id` that applies partial updates to the document. The handler SHALL reject updates to documents not in `BORRADOR` state with a 409 response. When the update changes `revisorId` and/or `aprobadorId` to a new value (create-or-change), the handler SHALL create an `ASIGNACION` notification for the newly assigned person, following the same resolvable-account and not-self-notifying rules as the create handler. All responses SHALL be delayed by 400 ms.

#### Scenario: Update handler applies changes to BORRADOR document
- **WHEN** `PUT /api/documents/doc-borrador-id` is requested with `{ titulo: 'Nuevo Título' }`
- **THEN** the response status is 200 and `data.titulo` is `'Nuevo Título'`

#### Scenario: Update handler rejects changes to non-BORRADOR document
- **WHEN** `PUT /api/documents/doc-publicado-id` is requested for a PUBLICADO document
- **THEN** the response status is 409 and `success` is `false`

#### Scenario: Changing aprobadorId notifies the newly assigned aprobador
- **WHEN** `PUT /api/documents/doc-borrador-id` is requested with `{ aprobadorId: 'user-jefedocs-001' }`, changing it from a previous value
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-jefedocs-001'`

### Requirement: POST /api/documents/:id/status transition handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/status` that validates the state transition using `DOC_STATUS_TRANSITIONS`, enforces RN-DOC-001 through RN-DOC-006, and records an `AuditTrailEntry` for each successful transition. The handler SHALL require a non-empty `firma` field in the request body (RN-DOC-004). When the transition is `estado: 'BORRADOR'` from `'EN_REVISION'` (a rejection) and the request body includes `notificarAutor: true`, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification` from `notification-generation`) targeting the document's `autorId`, excluding the acting user, silently skipping if `autorId` is not a resolvable account. When `notificarAutor` is absent or `false`, no notification SHALL be created for the rejection. All responses SHALL be delayed by 400 ms.

#### Scenario: Valid transition updates estado and records audit trail
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'EN_REVISION', firma: '1234' }`
- **THEN** the response status is 200, `data.estado` is `'EN_REVISION'`, and `data.auditTrail` contains a new entry with `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Invalid transition rejects with 422 (RN-DOC-001 / state machine)
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'PUBLICADO', firma: '1234' }` (BORRADOR → PUBLICADO is not a valid transition)
- **THEN** the response status is 422 and `success` is `false`

#### Scenario: Publishing obsoletes the previous published version only if it has no active QE link (RN-DOC-001 + RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`, and another document in the in-memory store has the same `codigo`, `estado === 'PUBLICADO'`, and a `qeVinculados` (now `QeVinculadoResumen[]`, carrying each linked QE's `estado`) with every entry `CERRADO` or `VERIFICADO` (or empty)
- **THEN** that other document is set to `OBSOLETO`

#### Scenario: Publishing is rejected when the prior published version has an active QE link (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`, and the prior `PUBLICADO` document with the same `codigo` has a `qeVinculados` entry with `estado` other than `CERRADO`/`VERIFICADO`
- **THEN** the response status is 409, the error message references the blocking QE's `numero`, and neither document's `estado` changes — this closes a pre-existing gap where the auto-obsoletion loop never checked the prior version's `qeVinculados` at all (RN-DOC-005 previously only guarded a direct manual `OBSOLETO` request, a transition no UI ever triggers)

#### Scenario: Missing firma field rejects with 400 (RN-DOC-004)
- **WHEN** `POST /api/documents/:id/status` is requested without a `firma` field
- **THEN** the response status is 400 and `success` is `false`

#### Scenario: Direct manual transition to OBSOLETO is blocked only if a linked QE is not CERRADO/VERIFICADO (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` directly requests `OBSOLETO` (the `PUBLICADO → OBSOLETO` entry in `DOC_STATUS_TRANSITIONS`, unreachable from any current UI action but still a valid request shape) on a document whose `qeVinculados` includes at least one entry with `estado` other than `CERRADO` or `VERIFICADO`
- **THEN** the response status is 409 and the error message references the blocking QE's `numero`

#### Scenario: Direct manual transition to OBSOLETO succeeds when every linked QE is closed or verified
- **WHEN** `POST /api/documents/:id/status` directly requests `OBSOLETO` on a document whose every `qeVinculados` entry has `estado` `CERRADO` or `VERIFICADO`
- **THEN** the response status is 200 and `data.estado` is `'OBSOLETO'`

#### Scenario: Rejection with notificarAutor true creates a real notification for the author
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: true, motivo: 'Falta evidencia' }` on a document in `EN_REVISION`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the document's `autorId`, referencing the document's `codigo`

#### Scenario: Rejection with notificarAutor false creates no notification
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: false }` on a document in `EN_REVISION`
- **THEN** no notification is created for this transition

### Requirement: DELETE /api/documents/:id delete handler
The system SHALL provide an MSW v2 handler for `DELETE /api/documents/:id` that removes the document from the in-memory store. The handler SHALL reject deletion of non-BORRADOR documents with 409 and documents with a non-empty `qeVinculados` (now `QeVinculadoResumen[]`, checked by array length regardless of each linked QE's `estado`) with 409. All responses SHALL be delayed by 400 ms.

#### Scenario: Delete BORRADOR document with no QEs succeeds
- **WHEN** `DELETE /api/documents/doc-borrador-id` is requested for a BORRADOR document with empty `qeVinculados`
- **THEN** the response status is 200 and a subsequent GET for that id returns 404

#### Scenario: Delete non-BORRADOR document rejects
- **WHEN** `DELETE /api/documents/doc-publicado-id` is requested
- **THEN** the response status is 409 and `success` is `false`

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

### Requirement: Handlers registered in index.ts
The `documentHandlers` array from `documents.handlers.ts` SHALL be imported and spread into the combined handlers array in `src/mocks/handlers/index.ts`.

#### Scenario: documentHandlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** all six `/api/documents` route patterns are intercepted without 'unhandled request' warnings

### Requirement: POST /api/documents/:id/qe-vinculados link handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/qe-vinculados` (body `{ qualityEventId }`) that adds a `QeVinculadoResumen` entry (derived from `getQeStore()`, matching the pattern of cross-domain store lookups already used by `dashboard.handlers.ts`) to the target document's `qeVinculados`, and symmetrically adds a `DocumentoVinculadoResumen` entry to the target QE's `documentosVinculados` in `getQeStore()`. Creation SHALL be idempotent: linking an already-linked pair returns 200 without duplicating the entry. Both the document id and the `qualityEventId` SHALL be scoped to the session's active empresa — a mismatch on either side responds 404, same as an unknown id. All responses SHALL be delayed by 400 ms.

#### Scenario: Linking a QE for the first time
- **WHEN** `POST /api/documents/doc-001/qe-vinculados` is requested with `{ qualityEventId: 'qe-2026-005' }` and no prior link exists
- **THEN** the response status is 200/201, `data.qeVinculados` includes an entry with `id: 'qe-2026-005'`, and `GET /api/quality-events/qe-2026-005` now includes `doc-001` in `documentosVinculados`

#### Scenario: Linking the same pair twice is idempotent
- **WHEN** `POST /api/documents/doc-001/qe-vinculados` is requested twice with the same `qualityEventId`
- **THEN** both responses are successful and `data.qeVinculados` contains exactly one entry for that QE

#### Scenario: Linking a QE from another empresa is rejected as not found
- **WHEN** `POST /api/documents/:id/qe-vinculados` is requested with a `qualityEventId` that exists but belongs to another empresa
- **THEN** the response status is 404 and no link is created

### Requirement: DELETE /api/documents/:id/qe-vinculados/:qualityEventId unlink handler
The system SHALL provide an MSW v2 handler for `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` that removes the link symmetrically from both the document's `qeVinculados` and the QE's `documentosVinculados`. The handler SHALL respond 404 if the pair is not currently linked. All responses SHALL be delayed by 400 ms.

#### Scenario: Unlinking an existing pair
- **WHEN** `DELETE /api/documents/doc-001/qe-vinculados/qe-2026-005` is requested and that pair is linked
- **THEN** the response status is 200, `data.qeVinculados` no longer includes `qe-2026-005`, and `GET /api/quality-events/qe-2026-005` no longer includes `doc-001`

#### Scenario: Unlinking a pair that is not linked
- **WHEN** `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` is requested and that pair was never linked
- **THEN** the response status is 404

### Requirement: Handlers registered in index.ts (qe-vinculados)
The `documentHandlers` array SHALL include the `POST`/`DELETE /api/documents/:id/qe-vinculados[...]` handlers, imported and spread into the combined handlers array in `src/mocks/handlers/index.ts` alongside the existing document handlers.

#### Scenario: qe-vinculados handlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** `POST`/`DELETE /api/documents/:id/qe-vinculados[...]` are intercepted without 'unhandled request' warnings

### Requirement: POST /api/documents/:id/nc-vinculadas link handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/nc-vinculadas` (body `{ noConformidadId }`) that adds a `NcVinculadoResumen` entry (derived from `getNonconformitiesStore()`, exported from `nonconformities.handlers.ts` — the established cross-domain store lookup pattern) to the target document's `ncVinculados`, and symmetrically adds a `DocumentoVinculadoResumen` entry to the target NC's `documentosVinculados` in `getNonconformitiesStore()`. Creation SHALL be idempotent: linking an already-linked pair returns 200 without duplicating the entry. Both the document id and the `noConformidadId` SHALL be scoped to the session's active empresa — a mismatch on either side responds 404, same as an unknown id. All responses SHALL be delayed by 400 ms.

#### Scenario: Linking an NC for the first time
- **WHEN** `POST /api/documents/doc-001/nc-vinculadas` is requested with `{ noConformidadId: 'nc-2026-005' }` and no prior link exists
- **THEN** the response status is 200/201, `data.ncVinculados` includes an entry with `id: 'nc-2026-005'`, and `GET /api/nonconformities/nc-2026-005` now includes `doc-001` in `documentosVinculados`

#### Scenario: Linking the same pair twice is idempotent
- **WHEN** `POST /api/documents/doc-001/nc-vinculadas` is requested twice with the same `noConformidadId`
- **THEN** both responses are successful and `data.ncVinculados` contains exactly one entry for that NC

#### Scenario: Linking an NC from another empresa is rejected as not found
- **WHEN** `POST /api/documents/:id/nc-vinculadas` is requested with a `noConformidadId` that exists but belongs to another empresa
- **THEN** the response status is 404 and no link is created

### Requirement: DELETE /api/documents/:id/nc-vinculadas/:noConformidadId unlink handler
The system SHALL provide an MSW v2 handler for `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` that removes the link symmetrically from both the document's `ncVinculados` and the NC's `documentosVinculados`. The handler SHALL respond 404 if the pair is not currently linked. All responses SHALL be delayed by 400 ms.

#### Scenario: Unlinking an existing pair
- **WHEN** `DELETE /api/documents/doc-001/nc-vinculadas/nc-2026-005` is requested and that pair is linked
- **THEN** the response status is 200, `data.ncVinculados` no longer includes `nc-2026-005`, and `GET /api/nonconformities/nc-2026-005` no longer includes `doc-001`

#### Scenario: Unlinking a pair that is not linked
- **WHEN** `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` is requested and that pair was never linked
- **THEN** the response status is 404

### Requirement: Handlers registered in index.ts (nc-vinculadas)
The `documentHandlers` array SHALL include the `POST`/`DELETE /api/documents/:id/nc-vinculadas[...]` handlers, imported and spread into the combined handlers array in `src/mocks/handlers/index.ts` alongside the existing document handlers.

#### Scenario: nc-vinculadas handlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** `POST`/`DELETE /api/documents/:id/nc-vinculadas[...]` are intercepted without 'unhandled request' warnings
