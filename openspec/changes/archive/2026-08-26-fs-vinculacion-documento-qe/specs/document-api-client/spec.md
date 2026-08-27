## ADDED Requirements

### Requirement: vincularQE pure function
The system SHALL export a `vincularQE(documentId: string, qualityEventId: string)` async function from `src/api/endpoints/documents.api.ts` that calls `POST /api/documents/:id/qe-vinculados` with `{ qualityEventId }` and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: vincularQE with valid ids resolves with the updated document
- **WHEN** `vincularQE('doc-001', 'qe-2026-001')` is called
- **THEN** it resolves with an `ApiResponse` whose `data.qeVinculados` includes an entry with `id: 'qe-2026-001'`

### Requirement: desvincularQE pure function
The system SHALL export a `desvincularQE(documentId: string, qualityEventId: string)` async function that calls `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: desvincularQE removes the link
- **WHEN** `desvincularQE('doc-001', 'qe-2026-001')` is called on a document with that QE linked
- **THEN** it resolves with an `ApiResponse` whose `data.qeVinculados` no longer includes `qe-2026-001`
