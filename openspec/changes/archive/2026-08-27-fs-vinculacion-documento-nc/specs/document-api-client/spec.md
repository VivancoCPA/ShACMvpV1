## ADDED Requirements

### Requirement: vincularNC pure function
The system SHALL export a `vincularNC(documentId: string, noConformidadId: string)` async function from `src/api/endpoints/documents.api.ts` that calls `POST /api/documents/:id/nc-vinculadas` with `{ noConformidadId }` and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: vincularNC with valid ids resolves with the updated document
- **WHEN** `vincularNC('doc-001', 'nc-2026-001')` is called
- **THEN** it resolves with an `ApiResponse` whose `data.ncVinculados` includes an entry with `id: 'nc-2026-001'`

### Requirement: desvincularNC pure function
The system SHALL export a `desvincularNC(documentId: string, noConformidadId: string)` async function that calls `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: desvincularNC removes the link
- **WHEN** `desvincularNC('doc-001', 'nc-2026-001')` is called on a document with that NC linked
- **THEN** it resolves with an `ApiResponse` whose `data.ncVinculados` no longer includes `nc-2026-001`
