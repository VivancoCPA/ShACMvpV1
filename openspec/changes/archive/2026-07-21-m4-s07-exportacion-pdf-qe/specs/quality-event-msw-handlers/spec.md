## ADDED Requirements

### Requirement: MSW endpoint POST /api/quality-events/:id/export-pdf
`quality-events.handlers.ts` SHALL register `POST /api/quality-events/:id/export-pdf`, accepting no request body. It SHALL return 404 with `success: false` for an unknown `:id`. On success it SHALL append one `QEAuditTrailEntry` to the matching QE's `auditTrail` with `accion: 'EXPORTACION_PDF'`, `realizadoPorId`/`realizadoPorNombre` set from the requesting mock user, `timestamp` set to the current mock time, and `generadoPorIA: false`, then return 200 with `data` being the full updated `QualityEvent` (including the new audit entry). This endpoint SHALL be called by the client before generating the PDF, both for individual exports and for each QE within a batch export, per `quality-event-pdf-export` and `quality-event-batch-pdf-export`.

#### Scenario: Successful export-pdf call appends the audit entry and returns the updated QE
- **WHEN** `POST /api/quality-events/qe-2026-010/export-pdf` is requested by mock user `jc-1` (`realizadoPorNombre: 'Ana Torres'`)
- **THEN** the response is 200, `data.auditTrail` grows by exactly 1 entry with `accion: 'EXPORTACION_PDF'`, `realizadoPorNombre: 'Ana Torres'`, and `generadoPorIA: false`

#### Scenario: Unknown id returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/export-pdf` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Consecutive calls each append their own entry
- **WHEN** `POST /api/quality-events/qe-2026-010/export-pdf` is requested twice in a row
- **THEN** `auditTrail` grows by exactly 2 entries total, one `EXPORTACION_PDF` entry per call, each with its own `timestamp`
