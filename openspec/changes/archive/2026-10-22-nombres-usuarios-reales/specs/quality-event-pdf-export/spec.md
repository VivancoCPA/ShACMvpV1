## MODIFIED Requirements

### Requirement: buildQualityEventPdf generates the complete six-section document
The system SHALL export a pure function `buildQualityEventPdf(qe: QualityEvent, meta: QEExportMeta): jsPDF` from `src/features/quality-events/export/buildQualityEventPdf.ts`, where `QEExportMeta = { exportadoPorNombre: string, generadoEn: Date, reportadoPorNombre: string, causaRaizAprobadaPorNombre?: string }`. The function SHALL build a single `jsPDF` document reusing the `jspdf` + `jspdf-autotable` pattern established by `src/features/dashboard/export/` (M5-S09), containing, in this order: (1) cabecera (`numero`, `origen`, `tipo`, `severidad`, `areaAfectada`, `mineralInvolucrado` if present, `turno`, `fechaHoraEvento`, `fechaHoraReporte`, `meta.reportadoPorNombre`, and `"Ciclo N — Reabierto"` when `ciclo > 1`); (2) descripción (`descripcion`, `descripcionAmpliada`, and `normativaVinculada`/`hallazgoCodigo` when `origen === 'O3_HALLAZGO_AUDITORIA'`); (3) causa raíz (the active `metodoAnalisis` — `cincoPorques` or `ishikawa` — plus `causaRaizDefinitiva`, with a "Borrador IA — validado por [usuario]" indicator using `meta.causaRaizAprobadaPorNombre` when applicable); (4) plan de acciones correctivas (`autoTable` with one row per entry of `accionesCorrectivas`: descripción, responsable, plazo, estado, evidencia by reference, resultado); (5) cierre (`resultadoCierre`, `plazoVerificacionDias`, `resultadoVerificacion`, both signatures with name/role/timestamp); (6) audit trail (`autoTable` with one row per entry of `auditTrail`, unabridged, across all `ciclo` values). This function SHALL be the only code path that assembles QE PDF content — both the individual export button and the batch export loop SHALL call it with the same `qe` argument shape.

`buildQualityEventPdf` is not a React component and SHALL NOT import `resolveUserDisplayName` or any other identity-resolution code from `src/mocks/` — every user name it renders (`reportadoPorNombre`, `causaRaizAprobadaPorNombre`, `exportadoPorNombre`) SHALL arrive pre-resolved via `meta`, supplied by the caller (`QEHeaderSection` for the individual export, the batch export loop for batch exports) using `useUserNames` (`user-names-lookup`).

#### Scenario: All six sections render for a fully-populated QE
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` in `estado: 'VERIFICADO'` that has `accionesCorrectivas`, `causaRaizDefinitiva`, `resultadoVerificacion`, and 6 `auditTrail` entries
- **THEN** the returned document contains all six sections with their corresponding data, and the audit trail table has exactly 6 rows

#### Scenario: Reopened QE includes audit trail from all prior ciclos
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` where `ciclo: 3` and `auditTrail` contains entries spanning all three ciclos
- **THEN** the audit trail table in the returned document includes every entry from `auditTrail`, not filtered by the current ciclo

#### Scenario: Cabecera shows the ciclo indicator for reopened QEs
- **WHEN** `buildQualityEventPdf` is called with a `QualityEvent` where `ciclo: 2`
- **THEN** the cabecera section text includes "Ciclo 2 — Reabierto"

#### Scenario: Cabecera shows the caller-supplied reportadoPorNombre
- **WHEN** `buildQualityEventPdf` is called with `meta.reportadoPorNombre: 'Ana Pérez'`
- **THEN** the cabecera section's "Reportado por" line reads "Reportado por: Ana Pérez"

#### Scenario: Causa raíz section shows the caller-supplied causaRaizAprobadaPorNombre
- **WHEN** `buildQualityEventPdf` is called for a QE whose causa raíz was validated by IA and `meta.causaRaizAprobadaPorNombre: 'Luis Paredes'`
- **THEN** the causa raíz section's validation line reads "Borrador IA — validado por Luis Paredes"

#### Scenario: buildQualityEventPdf never imports mock identity resolution
- **WHEN** `src/features/quality-events/export/buildQualityEventPdf.ts` is inspected for imports
- **THEN** it has no import from `src/mocks/`
