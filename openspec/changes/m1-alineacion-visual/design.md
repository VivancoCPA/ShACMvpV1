## Context

`DocumentDetailPage.tsx` renders a two-column layout: left column has `DocumentDetailHeader` + a tab bar (`detail`/`historial`/`auditTrail`/`versiones`) switching between `DocumentHistorial`, `DocumentAuditTrail`, `DocumentVersionesTab`, and an inline detail block; right column is a sticky `DocumentActionPanel` (all state-transition buttons + their modals). Every other detail page (`NonconformityDetailPage`, `IncidentDetailPage`, `QualityEventDetail`) uses a single `max-w-3xl` column of stacked sections with actions inline in the header.

Verified against current code (not just the PRD/handoff) before drafting this design:
- **No shared accordion/collapsible component exists in the codebase.** `QualityEventDetail.tsx` (`features/quality-events/pages/QualityEventDetail.tsx`) has zero collapsible sections — every section (`QEInvestigationSection`, `QEACSection`, etc.) is an always-open card.
- The collapsible pattern (button + `<h2>` + `ChevronUp`/`ChevronDown` from `lucide-react` + local `useState`) exists independently in `NonconformityDetailPage.tsx` (audit trail section, ~line 287) and `IncidentDetailPage.tsx` (two sections, ~lines 340 and 510) — each is its own inline implementation, not imported from a shared file.
- This discrepancy was raised to the user; decision (see Decisions below) is to replicate the inline pattern, not extract a new shared component.

## Goals / Non-Goals

**Goals:**
- Replace tabs + sticky sidebar with a single scrollable column, matching M2/M3/M4's structure.
- Preserve 100% of existing RBAC/permission logic, data fetching, and modal behavior in `DocumentActionPanel` — only its position and container markup change.
- Keep `DocumentHistorial`, `DocumentAuditTrail`, `DocumentVersionesTab` as-is internally; only wrap them in new section containers.

**Non-Goals:**
- No new shared/reusable accordion component (see Decisions).
- No changes to `getDocumentPermissions`, `canAccessDocument`, or any RN-DOC-* rule.
- No changes to `DocumentsListPage` or any other route.
- No resolution of the Autor/Revisor/Aprobador raw-ID display issue, and no fix to the "Aprobar revisión" guard — both are separate, already-identified work items.

## Decisions

**1. Collapsible sections: replicate the NC/Incidents inline pattern, do not extract a shared component.**
Rationale: the proposal's original premise (reuse an accordion "already used in QE") doesn't match the code — QE has none. Extracting a new shared `CollapsibleSection` and migrating three modules to it is a larger refactor than "align M1's layout," and the user confirmed (via clarifying question) to keep scope narrow: M1 gets its own inline collapsible block, structurally identical to the one in `NonconformityDetailPage.tsx`/`IncidentDetailPage.tsx` (trigger button with `<h2>` + count/label, `ChevronUp`/`ChevronDown` toggle, `aria-expanded`, local `useState<boolean>` per section, content conditionally rendered below the trigger). Formalizing a shared component remains a valid future cleanup, explicitly out of scope here.

**2. `DocumentActionPanel` moves into the header as an inline button row; its internals are untouched.**
Rationale: `DocumentActionPanel` already computes all `canX` permission flags and owns all its modals (`DocumentSignatureModal`, `DocumentRejectModal`, `DocumentNuevaVersionModal`, `DocumentRevisionPeriodicaModal`, confirm dialogs, PDF preview). Reimplementing that logic elsewhere would risk behavior drift (violates CA-DOCUI-05). Instead, `DocumentActionPanel` is restructured internally to render as a horizontal `flex flex-wrap gap-2` button row (dropping `sticky top-6` positioning and the `<h3>` "detail.title" label, which is redundant with the page title already shown in the header) while keeping every `canX` computation, every modal, and every mutation call exactly as-is. It renders where the "Editar" button renders in `IncidentDetailPage.tsx` — next to the título, inside `DocumentDetailHeader`'s or the page's title row.

**3. Versiones is a highlighted, non-collapsible card — not merely "the last item that happens to be open."**
Rationale (per proposal CA-DOCUI-03): version history is específica al control documentario and deserves visual weight distinct from the generic collapsible pattern. Implementation: same `DocumentVersionesTab` content, wrapped in a card with an accent border (`border-coral` or equivalent per design tokens) and a "Versión vigente" badge, always rendered (no toggle button, no `useState`).

**4. Section order is fixed and hardcoded**: Descripción → Historial → Versiones → Audit trail. No config/props needed since this order is a permanent structural decision (proposal CA-DOCUI-04), not user-configurable.

**5. Page width changes from `max-w-7xl` / two-column grid to `max-w-3xl` single column**, matching `QualityEventDetail.tsx`'s `mx-auto max-w-3xl space-y-6` wrapper exactly, for visual consistency.

## Risks / Trade-offs

- **[Risk]** Moving `DocumentActionPanel`'s modals from a sidebar card into a header-inline button row could visually crowd the header on narrow viewports (many possible buttons: Enviar a revisión, Aprobar, Rechazar, Firmar, Cancelar, Iniciar revisión periódica, Crear nueva versión, Eliminar — though `hasAnyAction` logic means only a few apply per state). → **Mitigation**: use `flex flex-wrap` so buttons wrap to a second line on small screens, same as other header action rows in the codebase; no state allows more than ~3 simultaneous actions per `DocumentActionPanel`'s existing `canX` mutual-exclusivity by `estado`.
- **[Risk]** Removing the `sticky` positioning means action buttons scroll out of view on a long document detail page (long audit trail, many versions). → **Mitigation**: accepted trade-off — this matches the exact behavior of M2/M3/M4, which also have non-sticky, header-only actions; no user complaints about this in those modules to date.
- **[Risk]** Collapsible sections re-implemented per-module (not shared) means a future bugfix to the toggle behavior (e.g., an accessibility fix) has to be applied in up to 4 places. → **Mitigation**: accepted; documented as a known "component extraction" opportunity in the proposal's out-of-scope section, to be picked up as a separate future spec if it becomes a real pain point.

## Migration Plan

Pure frontend layout change, no data migration, no backend involved (MSW/mock only). Deploy as a normal PR:
1. Restructure `DocumentActionPanel` (dedupe sticky-card wrapper → inline row wrapper); verify no `canX`/mutation logic touched.
2. Restructure `DocumentDetailPage.tsx`: remove tab state and tab bar, render stacked sections in fixed order, move `DocumentActionPanel` into the header row.
3. Wrap `DocumentHistorial` and `DocumentAuditTrail` renders in new collapsible section containers (open by default).
4. Wrap `DocumentVersionesTab` render in the new highlighted, always-open card.
5. Manual verification pass in browser (light + dark mode) across the document lifecycle states (`BORRADOR` → ... → `OBSOLETO`) to confirm every action button that previously appeared in the sidebar still appears and functions identically in the header.

Rollback: revert the PR — no persisted state or schema involved.

## Open Questions

None outstanding — the one ambiguity (accordion component source) was resolved with the user before writing this design.
