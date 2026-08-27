## ADDED Requirements

### Requirement: POST /api/nonconformities/:id/documentos-vinculados link handler
The system SHALL provide an MSW v2 handler for `POST /api/nonconformities/:id/documentos-vinculados` (body `{ documentoId }`) that adds a `DocumentoVinculadoResumen` entry (derived from `getDocumentsStore()`, exported from `documents.handlers.ts` — the established cross-domain store lookup pattern) to the target NC's `documentosVinculados`, and symmetrically adds an `NcVinculadoResumen` entry to the target document's `ncVinculados` in `getDocumentsStore()`. Creation SHALL be idempotent: linking an already-linked pair returns 200 without duplicating the entry. Both the NC id and the `documentoId` SHALL be scoped to the session's active empresa — a mismatch on either side responds 404, same as an unknown id. All responses SHALL be delayed by 400 ms.

#### Scenario: Linking a document for the first time
- **WHEN** `POST /api/nonconformities/nc-2026-001/documentos-vinculados` is requested with `{ documentoId: 'doc-005' }` and no prior link exists
- **THEN** the response status is 200/201, `data.documentosVinculados` includes an entry with `id: 'doc-005'`, and `GET /api/documents/doc-005` now includes `nc-2026-001` in `ncVinculados`

#### Scenario: Linking the same pair twice is idempotent
- **WHEN** `POST /api/nonconformities/nc-2026-001/documentos-vinculados` is requested twice with the same `documentoId`
- **THEN** both responses are successful and `data.documentosVinculados` contains exactly one entry for that document

#### Scenario: Linking a document from another empresa is rejected as not found
- **WHEN** `POST /api/nonconformities/:id/documentos-vinculados` is requested with a `documentoId` that exists but belongs to another empresa
- **THEN** the response status is 404 and no link is created

### Requirement: DELETE /api/nonconformities/:id/documentos-vinculados/:documentoId unlink handler
The system SHALL provide an MSW v2 handler for `DELETE /api/nonconformities/:id/documentos-vinculados/:documentoId` that removes the link symmetrically from both the NC's `documentosVinculados` and the document's `ncVinculados`. The handler SHALL respond 404 if the pair is not currently linked. All responses SHALL be delayed by 400 ms.

#### Scenario: Unlinking an existing pair
- **WHEN** `DELETE /api/nonconformities/nc-2026-001/documentos-vinculados/doc-005` is requested and that pair is linked
- **THEN** the response status is 200, `data.documentosVinculados` no longer includes `doc-005`, and `GET /api/documents/doc-005` no longer includes `nc-2026-001`

#### Scenario: Unlinking a pair that is not linked
- **WHEN** `DELETE /api/nonconformities/:id/documentos-vinculados/:documentoId` is requested and that pair was never linked
- **THEN** the response status is 404

### Requirement: Handlers registered in index.ts (documentos-vinculados)
The `nonconformityHandlers` array SHALL include the `POST`/`DELETE /api/nonconformities/:id/documentos-vinculados[...]` handlers, imported and spread into the combined handlers array in `src/mocks/handlers/index.ts` alongside the existing nonconformity handlers.

#### Scenario: documentos-vinculados handlers are active when MSW starts
- **WHEN** the MSW worker is started in development
- **THEN** `POST`/`DELETE /api/nonconformities/:id/documentos-vinculados[...]` are intercepted without 'unhandled request' warnings
