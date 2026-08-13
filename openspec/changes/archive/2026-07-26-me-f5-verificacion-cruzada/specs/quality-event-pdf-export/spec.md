## ADDED Requirements

### Requirement: Individual export never generates a PDF for a QE outside the active empresa (RN-EMP-004)
The `useExportQualityEventPdf` mutation SHALL call `POST /api/quality-events/:id/export-pdf`, which rejects with 404 when `:id` does not belong to the session's active empresa (per `quality-event-msw-handlers`). `QEHeaderSection` SHALL NOT call `buildQualityEventPdf` when that mutation fails — no PDF SHALL be generated for a QE outside the active empresa, formalizing the existing empresa check on the export endpoint as a regression guard for the individual export flow.

#### Scenario: Attempting to export a QE id from another empresa fails before any PDF is built
- **WHEN** the active empresa is `empresa-001` and a client somehow triggers `useExportQualityEventPdf` for a QE id that belongs to `empresa-002`
- **THEN** `POST /api/quality-events/:id/export-pdf` responds 404 and `buildQualityEventPdf` is never invoked for that id
