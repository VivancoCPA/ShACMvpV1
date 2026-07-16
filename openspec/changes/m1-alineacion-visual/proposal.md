## Why

`DocumentDetailPage.tsx` (M1) is the only module detail page still using a tabs + sticky sidebar-of-actions layout. M2 (`NonconformityDetailPage`), M3 (`IncidentDetailPage`), and M4 (`QualityEventDetail`) converged on a single-column, scroll-navigable layout with inline header actions. M1 predates that convergence — the divergence is historical layout debt, not an intentional design decision. Aligning it removes the odd-one-out and makes the detail experience consistent across every module.

## What Changes

- Remove the tab bar (`Detalle | Historial | Audit Trail | Versiones`) from `DocumentDetailPage.tsx`. Replace it with a single scrollable column of stacked sections, in fixed order: **Descripción y detalle → Historial de estados → Versiones (destacada) → Audit trail**.
- Descripción, Historial, and Audit trail become collapsible panels (open by default), each with its own local expand/collapse toggle (chevron icon), following the inline pattern already used in `NonconformityDetailPage.tsx` and `IncidentDetailPage.tsx` — there is no shared/reusable accordion component in the codebase today, and `QualityEventDetail.tsx` has no collapsible sections at all (its cards are always open). M1 replicates the NC/Incidents inline pattern; it does not introduce a new shared component.
- Versiones becomes an always-visible highlighted card (accent border, current-version badge) — not collapsible.
- Remove the sticky right-column `DocumentActionPanel` layout. Its action buttons (Enviar a revisión, Aprobar, Rechazar, Firmar, Cancelar revisión, Iniciar revisión periódica, Crear nueva versión, Eliminar) move to the page header, next to the título, as an inline button row — same placement pattern as the "Editar" button in `IncidentDetailPage.tsx` (`detail.actions.editar` button next to the title). `DocumentActionPanel`'s existing modals (confirmation dialogs, `DocumentSignatureModal`, `DocumentRejectModal`, `DocumentNuevaVersionModal`, `DocumentRevisionPeriodicaModal`, PDF preview) stay as-is — only their trigger buttons relocate.
- The metadata grid (Tipo, Versión, Área, Autor, Revisor, Aprobador) in `DocumentDetailHeader` keeps its current content — no changes here beyond the layout it sits within.
- Page becomes single-column (`max-w-3xl`, matching M2/M3/M4), replacing the current `lg:grid-cols-3` two-column layout.

## Capabilities

### New Capabilities
(none — this is a layout realignment of an existing capability)

### Modified Capabilities
- `document-detail`: The requirement "DocumentDetailPage layout and navigation" changes from a two-column tabs + sticky-sidebar layout to a single-column stacked-sections layout with header-inline actions. Requirements for `DocumentHistorial` and `DocumentAuditTrail` gain collapsible-panel behavior (open-by-default, toggle to collapse). A new requirement covers `DocumentVersionesTab` rendering as a non-collapsible highlighted card instead of a tab-panel (not previously specified as its own requirement in this capability). No requirement changes to `DocumentDetailHeader` metadata/banners/file-access-buttons content, `DocumentConfidencialidadBadge`, or any RN-DOC-* business rule — only where/how existing elements are laid out.
- `document-approval-flow`: The requirement "DocumentActionPanel role-based action rendering" currently states the panel "SHALL be sticky (sticky top) in the right column" — this changes to an inline, non-sticky button row in the page header. All role × estado × action matrix requirements (BORRADOR/EN_REVISION/EN_APROBACION/PUBLICADO actions, modals, MSW handlers, `useDocumentActions`) are unchanged — only the container/positioning requirement moves.

## Impact

- **Affected files**: `shc-controldoc/src/features/documents/pages/DocumentDetailPage.tsx` (primary — layout restructure), `shc-controldoc/src/features/documents/components/DocumentActionPanel.tsx` (repositioned from sticky sidebar card to header inline row; internal logic/modals untouched), `shc-controldoc/src/features/documents/components/DocumentHistorial.tsx` and `DocumentAuditTrail.tsx` (wrapped in new collapsible panel markup), `shc-controldoc/src/features/documents/components/DocumentVersionesTab.tsx` (wrapped in highlighted-card markup instead of rendered as tab content).
- **Not affected**: RBAC guards, permission logic (`getDocumentPermissions`, `canAccessDocument`), `Documento` data model, RN-DOC-* rules, MSW handlers/fixtures, `DocumentsListPage`, i18n key values (existing keys reused; no new business copy), and every role × estado × action rule in `document-approval-flow` (only the panel's container/positioning requirement changes).
- **Out of scope** (tracked separately, not blocking): resolved-name display for Autor/Revisor/Aprobador (currently raw IDs), and the "Aprobar revisión" role-vs-`revisorId` guard fix. Both can land before, during, or after this rediseño without conflict.
