## ADDED Requirements

### Requirement: vincularDocumento pure function
The system SHALL export a `vincularDocumento(noConformidadId: string, documentoId: string)` async function from `src/features/nonconformities/api/nonconformities.api.ts` that calls `POST /api/nonconformities/:id/documentos-vinculados` with `{ documentoId }` and returns `Promise<NoConformidad>`.

#### Scenario: vincularDocumento with valid ids resolves with the updated NC
- **WHEN** `vincularDocumento('nc-2026-001', 'doc-001')` is called
- **THEN** it resolves with a `NoConformidad` whose `documentosVinculados` includes an entry with `id: 'doc-001'`

### Requirement: desvincularDocumento pure function
The system SHALL export a `desvincularDocumento(noConformidadId: string, documentoId: string)` async function that calls `DELETE /api/nonconformities/:id/documentos-vinculados/:documentoId` and returns `Promise<NoConformidad>`.

#### Scenario: desvincularDocumento removes the link
- **WHEN** `desvincularDocumento('nc-2026-001', 'doc-001')` is called on an NC with that document linked
- **THEN** it resolves with a `NoConformidad` whose `documentosVinculados` no longer includes `doc-001`
