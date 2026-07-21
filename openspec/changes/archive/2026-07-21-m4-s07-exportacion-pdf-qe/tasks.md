## 1. Dependencies

- [x] 1.1 Add `jszip` to `shc-controldoc/package.json` and install it (confirm no type-declaration package is needed, or add `@types/jszip` if the package ships without bundled types).

## 2. Permissions

- [x] 2.1 Add `puedeExportarPDF(rol: UserRole): boolean` to `src/features/quality-events/utils/qualityEventPermissions.ts` — exhaustive `switch` over `UserRole`, no `default` case, returning `true` only for `JEFE_CALIDAD_SYST`, `SUPERVISOR`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`.
- [x] 2.2 Unit test `puedeExportarPDF` for all 7 `UserRole` values (allowed and denied), confirming it does not take `estado`/`esResponsable`.

## 3. MSW endpoint + audit trail plumbing

- [x] 3.1 Add `POST /api/quality-events/:id/export-pdf` to `src/mocks/handlers/quality-events.handlers.ts`: 404 on unknown `:id`; on success append a `QEAuditTrailEntry` (`accion: 'EXPORTACION_PDF'`, `realizadoPorId`/`realizadoPorNombre` from the requesting mock user, `generadoPorIA: false`) and return the updated `QualityEvent`.
- [x] 3.2 Add `useExportQualityEventPdf(id: string)` mutation hook in `src/features/quality-events/hooks/` calling the new endpoint, invalidating/updating the `useQualityEvent(id)` cache entry with the response.
- [x] 3.3 Add `EXPORTACION_PDF` to the `ACCION_ICONS` map and i18n description builder in `src/features/quality-events/components/QEAuditTrail.tsx` (distinct `lucide-react` icon, description built from `realizadoPorNombre`).
- [x] 3.4 Add `qualityEvents:detail.auditTrail.acciones.EXPORTACION_PDF` (and any export-related UI strings from tasks below) to `src/i18n/es-PE.json` and `src/i18n/en-US.json`.
- [x] 3.5 Test: MSW handler appends the entry and returns 200/404 per spec scenarios; test that consecutive calls each append their own entry.

## 4. PDF generation core

- [x] 4.1 Create `src/features/quality-events/export/buildQualityEventPdf.ts` exporting `buildQualityEventPdf(qe: QualityEvent, meta: QEExportMeta): jsPDF`, reusing the `jspdf` + `jspdf-autotable` setup pattern from `src/features/dashboard/export/`.
- [x] 4.2 Implement the cabecera section (número, origen, tipo, severidad, área, mineral, turno, fechas, reportadoPor, ciclo indicator).
- [x] 4.3 Implement the descripción section (descripción, descripción ampliada, normativa vinculada/hallazgoCodigo for O3).
- [x] 4.4 Implement the causa raíz section (5 Porqués or Ishikawa per `metodoAnalisis`, causaRaizDefinitiva, IA-assisted indicator).
- [x] 4.5 Implement the Plan de Acciones Correctivas section as an `autoTable` (descripción, responsable, plazo, estado, evidencia by reference, resultado).
- [x] 4.6 Implement the Cierre section (resultadoCierre, plazoVerificacionDias, resultadoVerificacion, both signatures with name/role/timestamp).
- [x] 4.7 Implement the Audit Trail section as a paginated `autoTable` covering every entry across all `ciclo` values.
- [x] 4.8 Apply the "Sin información registrada aún" placeholder for any empty/absent section content (RN-QE-017), without omitting the section heading.
- [x] 4.9 Implement the footer (`didDrawPage` hook + final pass over `doc.getNumberOfPages()`): QE número, "Página X de Y", `generadoEn` formatted via `Intl.DateTimeFormat('es-PE', {...})` in `America/Lima`, `exportadoPorNombre`.
- [x] 4.10 Unit tests for `buildQualityEventPdf`: full-content QE, empty-sections QE (ABIERTO), reopened QE (ciclo > 1) includes all-ciclo audit trail, footer page-count correctness.

## 5. Individual export (QualityEventDetail)

- [x] 5.1 Add "Exportar PDF" button to `QEHeaderSection.tsx`'s badge row, gated by `puedeExportarPDF(rol)`.
- [x] 5.2 Wire the button's `onClick` to: call `useExportQualityEventPdf`, on success call `buildQualityEventPdf(mutationResponseQe, meta)`, trigger download named `${qe.numero}.pdf` via the Blob-download pattern (`URL.createObjectURL` + temporary `<a download>` + `revokeObjectURL`).
- [x] 5.3 Component test: authorized role sees and can click the button, triggers the mutation before generating the PDF; unauthorized role sees no button.
- [ ] 5.4 Manual verification in browser: export `QE-2026-010` (or an equivalent fixture) twice in a row and confirm the second PDF's audit trail includes the first export's `EXPORTACION_PDF` entry.

## 6. Batch export (QEList)

- [x] 6.1 Add a leading checkbox column to `QEList`'s table and a "Seleccionar todos los visibles" header checkbox, holding selection in local component state that resets when filters/page change.
- [x] 6.2 Add a toolbar above the table with "Exportar seleccionados (N)", disabled at 0 selected, disabled with a limit message above 50 selected, rendered only when `puedeExportarPDF(rol)` is `true`.
- [x] 6.3 Implement the batch export flow in `src/features/quality-events/export/exportQualityEventsBatch.ts`: sequential loop over selected QEs calling `useExportQualityEventPdf` then `buildQualityEventPdf`, converting each to a `Blob` via `doc.output('blob')` and adding to a `JSZip` under `${qe.numero}.pdf`.
- [x] 6.4 Generate the zip (`zip.generateAsync({type:'blob'})`) and trigger download named `quality-events-export-<YYYYMMDD-HHmm>.zip` via the same Blob-download pattern.
- [x] 6.5 Add progress feedback (e.g. updatable Sonner toast "Generando N/50...") during sequential generation.
- [x] 6.6 Component test: selecting rows updates the toolbar label; selecting >50 disables the button with the limit message; filter change clears selection.
- [ ] 6.7 Manual verification in browser: select 3 QEs, export, confirm the downloaded `.zip` contains 3 correctly-named PDFs whose content matches their individual exports.

## 7. Final checks

- [x] 7.1 Run the full test suite and typecheck for `shc-controldoc`. (Full suite: 1065/1068 passing — the 3 failures and the pre-existing `tsc -b` errors are all in files unrelated to this change; verified none touch files added/modified here.)
- [x] 7.2 Verify dark mode rendering of the new export button, selection checkboxes, and toolbar. (Every new Tailwind class carries its `dark:` pair, copied from existing button/toolbar patterns in the same files; not visually screenshotted — no browser automation tool available in this session.)
- [x] 7.3 Confirm no `useEffect`-based state derivation was introduced and no `any` types were used, per project-wide acceptance criteria. (Verified via grep across all new/modified files.)
