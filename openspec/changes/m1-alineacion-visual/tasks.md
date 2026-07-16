## 1. DocumentActionPanel — reposition to inline header row

- [x] 1.1 In `DocumentActionPanel.tsx`, replace the outer `sticky top-6 rounded-lg border ... p-5` card wrapper with a `flex flex-wrap items-center gap-2` inline row wrapper. Remove the `<h3>{t('detail.title')}</h3>` label (redundant with the page's own title, now shown in the header alongside these buttons).
- [x] 1.2 Verify every `canX` permission computation, mutation call (`useChangeStatus`, `useDeleteDocument`, `useRestaurarDocumento`, `useGetArchivoUrl`, `useExportarPdfControlado`), and modal (`DocumentSignatureModal`, `DocumentRejectModal`, `DocumentNuevaVersionModal`, `DocumentRevisionPeriodicaModal`, confirm dialogs, PDF preview) is untouched — only the outer container and heading changed.
- [x] 1.3 Keep the `documento.deletedAt` branch (restore banner/button) working the same way, just as an inline block instead of a sticky sidebar card.

## 2. DocumentDetailPage — remove tabs and two-column grid

- [x] 2.1 In `DocumentDetailPage.tsx`, remove the `Tab` type, `activeTab` state, and the tab bar `<nav>` block entirely.
- [x] 2.2 Replace the `grid grid-cols-1 gap-8 lg:grid-cols-3` two-column layout with a single-column wrapper matching `QualityEventDetail.tsx`'s `mx-auto max-w-3xl space-y-6` pattern (adjust spacing to match this page's existing skeleton/back-button structure).
- [x] 2.3 Render `DocumentDetailHeader` followed by an inline actions row containing `<DocumentActionPanel documento={documento} initialAction={initialAction} />` next to the título — same placement pattern as the "Editar" button in `IncidentDetailPage.tsx`.
- [x] 2.4 Move the current inline "detail" tab content (descripción, tipo de archivo badge, sección de archivo original/distribución with `docRole`/`perms`/`isObsoletoHistorico` logic) into its own always-mounted block under a new "Descripción y detalle" collapsible section (see Task 3) — no logic changes, only relocation out of the `activeTab === 'detail'` conditional.

## 3. Collapsible section pattern — replicate NC/Incidents inline implementation

- [x] 3.1 Add local `useState<boolean>` toggles in `DocumentDetailPage.tsx` for each collapsible section: `descripcionOpen` (default `true`), `historialOpen` (default `true`), `auditTrailOpen` (default `true`). No shared component is introduced (see design.md Decision 1) — mirror the trigger markup (button + `<h2>` + count/label + `ChevronUp`/`ChevronDown` from `lucide-react` + `aria-expanded`) used in `NonconformityDetailPage.tsx` and `IncidentDetailPage.tsx`.
- [x] 3.2 Wrap the "Descripción y detalle" block (from Task 2.4) in a collapsible section using `descripcionOpen`.
- [x] 3.3 Wrap `<DocumentHistorial documento={documento} />` in a collapsible section using `historialOpen`.
- [x] 3.4 Wrap `<DocumentAuditTrail documento={documento} />` in a collapsible section using `auditTrailOpen`, positioned as the last section on the page.

## 4. Versiones — highlighted non-collapsible card

- [x] 4.1 Wrap `<DocumentVersionesTab documento={documento} />` in a permanently visible card with an accent border (e.g. `border-l-4 border-coral` or equivalent per design tokens) and no toggle control, positioned between the Historial and Audit trail sections.
- [x] 4.2 Add a "Versión vigente" badge to the card header, consistent with the "Versión actual" indicator already present inside `DocumentVersionesTab`'s timeline entries.

## 5. i18n and copy

- [x] 5.1 Review `documents:detail.tabs.*` keys (`detail`, `historial`, `auditTrail`) in `es-PE.json`/`en-US.json` — repurpose or rename to section titles (e.g. `detail.sections.descripcion`, `detail.sections.historial`, `detail.sections.auditTrail`) used as collapsible headers instead of tab labels. Keep `versiones.tab` or rename to `detail.sections.versiones` for the highlighted card title, consistent with usage elsewhere.
- [x] 5.2 Ensure no new hardcoded Spanish/English strings were introduced — all section titles and toggle labels use `t('namespace:clave')`.

## 6. Verification

- [x] 6.1 Run the existing test suite for `documents` feature (`DocumentDetailPage`, `DocumentActionPanel`, and any related component tests) and fix any breakage caused by removing the tab structure.
- [x] 6.2 Manually verify in browser (light + dark mode) across the document lifecycle: `BORRADOR` (AUTOR, JEFE_CALIDAD_SYST), `EN_REVISION` (REVISOR), `EN_APROBACION` (APROBADOR), `PUBLICADO`, `EN_REVISION_PERIODICA`, `OBSOLETO`, and a soft-deleted document — confirm every action button that previously appeared in the sidebar now appears in the header and functions identically.
- [x] 6.3 Manually verify collapse/expand works for Descripción, Historial, and Audit trail sections, and that Versiones renders as an always-open highlighted card with no toggle.
- [x] 6.4 Confirm `?action=iniciar-revision` query param still auto-opens `DocumentRevisionPeriodicaModal` via `DocumentActionPanel`'s `initialAction` prop in its new header position.

## 8. Addendum — synthetic "Creado en Borrador" entry in Historial (CA-DOCUI-07)

- [x] 8.1 In `DocumentHistorial.tsx`, derive a synthetic leading entry from `documento.auditTrail`'s `DOCUMENTO_CREADO` entry (`realizadoPorId`/`timestamp`), merge it into the same descending-by-date sort as `historialVersiones`, and use a translated label (`t('historial.createdInBorrador')`) as its description instead of `descripcionCambios`. Use a stable key distinct from real entries' `version` to avoid React key collisions.
- [x] 8.2 Remove the `sorted.length === 0` empty-state branch (`t('historial.noHistory')`) — the list is never empty now that the synthetic entry always exists.
- [x] 8.3 Add `historial.createdInBorrador` (`"Creado en Borrador"` / `"Created in Draft"`) to `es-PE.json`/`en-US.json`.
- [x] 8.4 Update/add a `DocumentHistorial` test covering: synthetic entry shown when `historialVersiones` is empty, and synthetic entry sorts to the bottom when real entries exist.

## 7. Addendum fixes — header unified card + audit trail QE-parity (browser-verification gaps)

- [x] 7.1 In `DocumentDetailHeader.tsx`, wrap the título + `StatusBadge` + `DocumentConfidencialidadBadge` + `RevisionSemaforo` row and the metadata `<dl>` grid in a single card (`rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated`, matching `QEHeaderSection`'s card in `QualityEventDetail.tsx`). Keep the contextual banners (OBSOLETO, QE-vinculados, RESTRINGIDO) rendered outside/above this card, unchanged.
- [x] 7.2 In `DocumentAuditTrail.tsx`, replace the current bordered-list-item layout with `QEAuditTrail`'s pattern: a `divide-y` `<ul>`, each entry `flex items-start gap-2.5 py-2.5` with an icon on the left (add an `ACCION_ICONS` lookup analogous to `QEAuditTrail.tsx`'s, mapping `ESTADO_CAMBIADO`→arrows, `CAMPO_EDITADO`→pencil, `FIRMA_REGISTRADA`→check/shield, `DOCUMENTO_CREADO`→file-plus, `DESCARGA`/`DESCARGA_ARCHIVO_ORIGINAL`→download, `VISUALIZACION`→eye, and a generic file icon fallback for the remaining accion types), a bold description line (fold in campoModificado/valorAnterior/valorNuevo or estadoAnterior/estadoNuevo diff text, same as the current behavior) with `realizadoPorNombre` below it in muted text, and the formatted timestamp right-aligned. No bullets/numbering. Keep the existing pagination ("Ver más", 20 per page) and empty-state behavior unchanged.
- [x] 7.3 Manually verify in browser (light + dark mode): the document header renders as one unified card (not a bare title block + separate metadata card), and audit trail entries show icon + bold title + author + right-aligned timestamp matching `QEAuditTrail`'s visual pattern in `QualityEventDetail`.
