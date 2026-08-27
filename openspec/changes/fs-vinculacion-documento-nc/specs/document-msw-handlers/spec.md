## ADDED Requirements

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
