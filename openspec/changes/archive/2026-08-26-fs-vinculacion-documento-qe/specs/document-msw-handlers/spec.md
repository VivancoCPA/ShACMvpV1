## MODIFIED Requirements

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

## ADDED Requirements

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
