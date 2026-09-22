## MODIFIED Requirements

### Requirement: Individual export button on QualityEventDetail triggers the audit-trail-then-generate flow
`QEHeaderSection` SHALL render an "Exportar PDF" button, visible only when `puedeExportarPDF(rol)` is `true` for the current user. Clicking it SHALL invoke the `useExportQualityEventPdf` mutation for the current QE (registering the `EXPORTACION_PDF` audit trail entry per `quality-event-audit-trail`). The backend endpoint (`POST /:id/export-pdf`) responds `204 No Content` — it SHALL NOT be assumed to return the updated `QualityEvent`. On mutation success, `QEHeaderSection` SHALL call `buildQualityEventPdf` with the `qe` object already available as the component's own prop (the QE currently displayed on the detail page) — never with the mutation's result — and `meta = { exportadoPorNombre: <current user's full name>, generadoEn: new Date() }`, then trigger a browser download of the resulting PDF named `${qe.numero}.pdf`. The mutation's `onSuccess` SHALL invalidate both the QE detail query (whose cached `qe.auditTrail` feeds `buildQualityEventPdf`'s own audit-trail section) and the separate audit trail query, so that a subsequent export or a subsequently-opened audit trail view reflects the new `EXPORTACION_PDF` entry once the invalidated query refetches — this reflection is now necessarily asynchronous (a real network refetch), unlike the pre-cutover mock flow, which applied the entry synchronously from the mutation's own response.

#### Scenario: Authorized role sees and can use the export button
- **WHEN** a `JEFE_CALIDAD_SYST` user viewing `QualityEventDetail` for `QE-2026-010` clicks "Exportar PDF"
- **THEN** the `EXPORTACION_PDF` mutation is called before `buildQualityEventPdf`, and the resulting download is named `QE-2026-010.pdf`

#### Scenario: Unauthorized role does not see the export button
- **WHEN** a user with role `OPERARIO` or `JEFE_CONTROL_DOCUMENTARIO` views `QualityEventDetail`
- **THEN** no "Exportar PDF" button is rendered in `QEHeaderSection`

#### Scenario: PDF is built from the already-loaded QE prop, not from the mutation's response body
- **WHEN** `useExportQualityEventPdf`'s mutation resolves (the backend responds `204 No Content`, with no `QualityEvent` in the body)
- **THEN** `buildQualityEventPdf` is still called successfully, using the `qe` prop `QEHeaderSection` already received, and does not throw or receive `undefined`

#### Scenario: A later-opened audit trail reflects the export entry
- **WHEN** a user exports `QE-2026-010` via "Exportar PDF", then opens its audit trail view
- **THEN** the audit trail includes the `EXPORTACION_PDF` entry created by the export, fetched via the invalidated audit trail query (not embedded in the export mutation's response)

#### Scenario: Re-exporting after the QE detail query has refetched includes the prior export's audit entry
- **WHEN** a user exports `QE-2026-010`, the QE detail query refetches (invalidated by the export mutation) and updates the `qe` prop, and the user then exports it again
- **THEN** the second exported PDF's audit trail section includes the `EXPORTACION_PDF` entry created by the first export

---

### Requirement: Individual export never generates a PDF for a QE outside the active empresa (RN-EMP-004)
The `useExportQualityEventPdf` mutation SHALL call `POST /api/quality-events/:id/export-pdf`, which rejects with 404 when `:id` does not belong to the session's active empresa (per `quality-event-msw-handlers`). `QEHeaderSection` SHALL NOT call `buildQualityEventPdf` when that mutation fails — no PDF SHALL be generated for a QE outside the active empresa, formalizing the existing empresa check on the export endpoint as a regression guard for the individual export flow.

#### Scenario: Attempting to export a QE id from another empresa fails before any PDF is built
- **WHEN** the active empresa is `empresa-001` and a client somehow triggers `useExportQualityEventPdf` for a QE id that belongs to `empresa-002`
- **THEN** `POST /api/quality-events/:id/export-pdf` responds 404 and `buildQualityEventPdf` is never invoked for that id
