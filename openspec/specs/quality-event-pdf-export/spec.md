# Spec: quality-event-pdf-export

## Purpose

Individual PDF export of a Quality Event: a pure `buildQualityEventPdf` builder producing a six-section document (cabecera, descripción, causa raíz, plan de acciones correctivas, cierre, audit trail) with a per-page footer, plus the `QEHeaderSection` "Exportar PDF" button that drives the audit-trail-then-generate flow.

---

## Requirements

### Requirement: buildQualityEventPdf generates the complete six-section document
The system SHALL export a pure function `buildQualityEventPdf(qe: QualityEvent, meta: QEExportMeta): jsPDF` from `src/features/quality-events/export/buildQualityEventPdf.ts`, where `QEExportMeta = { exportadoPorNombre: string, generadoEn: Date }`. The function SHALL build a single `jsPDF` document reusing the `jspdf` + `jspdf-autotable` pattern established by `src/features/dashboard/export/` (M5-S09), containing, in this order: (1) cabecera (`numero`, `origen`, `tipo`, `severidad`, `areaAfectada`, `mineralInvolucrado` if present, `turno`, `fechaHoraEvento`, `fechaHoraReporte`, `reportadoPorNombre`, and `"Ciclo N — Reabierto"` when `ciclo > 1`); (2) descripción (`descripcion`, `descripcionAmpliada`, and `normativaVinculada`/`hallazgoCodigo` when `origen === 'O3_HALLAZGO_AUDITORIA'`); (3) causa raíz (the active `metodoAnalisis` — `cincoPorques` or `ishikawa` — plus `causaRaizDefinitiva`, with a "Borrador IA — validado por [usuario]" indicator when applicable); (4) plan de acciones correctivas (`autoTable` with one row per entry of `accionesCorrectivas`: descripción, responsable, plazo, estado, evidencia by reference, resultado); (5) cierre (`resultadoCierre`, `plazoVerificacionDias`, `resultadoVerificacion`, both signatures with name/role/timestamp); (6) audit trail (`autoTable` with one row per entry of `auditTrail`, unabridged, across all `ciclo` values). This function SHALL be the only code path that assembles QE PDF content — both the individual export button and the batch export loop SHALL call it with the same `qe` argument shape.

#### Scenario: All six sections render for a fully-populated QE
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` in `estado: 'VERIFICADO'` that has `accionesCorrectivas`, `causaRaizDefinitiva`, `resultadoVerificacion`, and 6 `auditTrail` entries
- **THEN** the returned document contains all six sections with their corresponding data, and the audit trail table has exactly 6 rows

#### Scenario: Reopened QE includes audit trail from all prior ciclos
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` where `ciclo: 3` and `auditTrail` contains entries spanning all three ciclos
- **THEN** the audit trail table in the returned document includes every entry from `auditTrail`, not filtered by the current ciclo

#### Scenario: Cabecera shows the ciclo indicator for reopened QEs
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` where `ciclo: 2`
- **THEN** the cabecera section text includes "Ciclo 2 — Reabierto"

---

### Requirement: Empty sections render an explicit placeholder instead of being omitted (RN-QE-017)
When a section's underlying data is absent or empty (e.g. `accionesCorrectivas: []` for a QE in `ABIERTO`, or no `causaRaizDefinitiva` yet set), `buildQualityEventPdf` SHALL still render that section's heading and SHALL show the literal text "Sin información registrada aún" in place of its content. No section SHALL be omitted from the document regardless of the QE's `estado`.

#### Scenario: QE in ABIERTO still exports Plan de Acciones Correctivas and Cierre with the placeholder text
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` in `estado: 'ABIERTO'` (`accionesCorrectivas: []`, no `resultadoCierre`)
- **THEN** the returned document includes a "Plan de Acciones Correctivas" section and a "Cierre" section, each containing the text "Sin información registrada aún"

---

### Requirement: PDF footer shows QE number, page count, generation timestamp, and exporting user
Every page of the document produced by `buildQualityEventPdf` SHALL include a footer with: the QE's `numero`, "Página X de Y" (the total page count resolved via `doc.getNumberOfPages()` in a final pass after all content is drawn), the `generadoEn` timestamp formatted with `Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' })`, and `exportadoPorNombre`.

#### Scenario: Footer appears on every page with correct total
- **WHEN** `buildQualityEventPdf` produces a 4-page document for `QE-2026-010`
- **THEN** each of the 4 pages' footer reads "QE-2026-010 · Página N de 4" for its respective `N`, followed by the Lima-formatted generation timestamp and the exporting user's name

---

### Requirement: Individual export button on QualityEventDetail triggers the audit-trail-then-generate flow
`QEHeaderSection` SHALL render an "Exportar PDF" button, visible only when `puedeExportarPDF(rol)` is `true` for the current user. Clicking it SHALL invoke the `useExportQualityEventPdf` mutation for the current QE (registering the `EXPORTACION_PDF` audit trail entry per `quality-event-audit-trail`), and on success call `buildQualityEventPdf` with the QE object returned by the mutation response (which already includes the new audit entry) and `meta = { exportadoPorNombre: <current user's full name>, generadoEn: new Date() }`, then trigger a browser download of the resulting PDF named `${qe.numero}.pdf`.

#### Scenario: Authorized role sees and can use the export button
- **WHEN** a `JEFE_CALIDAD_SYST` user viewing `QualityEventDetail` for `QE-2026-010` clicks "Exportar PDF"
- **THEN** the `EXPORTACION_PDF` mutation is called before `buildQualityEventPdf`, and the resulting download is named `QE-2026-010.pdf`

#### Scenario: Unauthorized role does not see the export button
- **WHEN** a user with role `OPERARIO` or `JEFE_CONTROL_DOCUMENTARIO` views `QualityEventDetail`
- **THEN** no "Exportar PDF" button is rendered in `QEHeaderSection`

#### Scenario: Exported PDF includes its own export audit entry
- **WHEN** a user exports `QE-2026-010` via "Exportar PDF", then immediately exports it again
- **THEN** the second exported PDF's audit trail section includes the `EXPORTACION_PDF` entry created by the first export
