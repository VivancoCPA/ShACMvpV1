## Context

M4-S01 through M4-S04 already shipped: the `QualityEvent` type/state machine, `getValidQETransitions`/`getQualityEventPermissions`, `useQualityEvent`/`useTransitionQEStatus`/`useUpdateQualityEvent`, badges, list view, and creation form. `QualityEvent.accionesCorrectivas` currently types to a stub `AccionCorrectivaQE[]` (`id, qeId, descripcion, responsableId, fechaLimite, estado, evidencia, creadoEn, actualizadoEn`) and every fixture QE has `accionesCorrectivas: []` — the type and fixtures both carry `TODO(M4-S05)` markers because ownership (Modelo A: ACs live on NC/Incident and merely reference a QE, vs Modelo B: ACs live on the QE) was left open. M2 (`AccionCorrectiva` on `NoConformidad`) and M3 (`AccionCorrectivaIncidente` on `Incidente`) each already implement the same shape (`titulo?, descripcion, responsableId, responsableNombre, plazoFecha, prioridad?, estado, descripcionEvidencia?, evidenciaUrl?, fechaCierre?`) with sub-resource REST endpoints (`/api/nonconformities/:ncId/acciones-correctivas/...`) and a canonical UI (`ACSection.tsx`) that this change must mirror for QEs.

## Goals / Non-Goals

**Goals:**
- Resolve the Modelo A/B ambiguity: ACs are owned by the QE (`qeId` primary), mirroring the exact shape and sub-resource pattern already proven by M2.
- Ship a full read+drive experience for a single QE: header, investigation (root-cause), corrective actions, audit trail, and state transitions — reusing M4-S01/S02 utilities as-is (no changes to transition/permission logic).
- Keep NC/Incident ACs backward compatible: add an *optional* `qeId` so existing records are unaffected and only new links opt in.

**Non-Goals:**
- Implementing the QE closure flow (dual signature, `resultadoCierre`) — that is M4-S06; this change only surfaces disabled "Disponible en cierre" buttons for transitions that lead there.
- Implementing the IA-assisted investigation feature — placeholder button only.
- Migrating M2/M3 ACs into QE-owned records, or building any UI to convert an NC/Incident AC into a QE AC — `qeId` on NC/Incident ACs is a read-only display link (M2's `ACSection` renders "Ver QE" when set), populated only in fixtures for this change.
- Changing the QE state machine, permission matrix, or MSW response envelope conventions established in M4-S01/S02.

## Decisions

### 1. Replace `AccionCorrectivaQE` with the M2-shaped AC record, keep the name

`AccionCorrectivaQE` moves from the stub shape to matching `AccionCorrectiva`/`AccionCorrectivaIncidente`: `{ id, qeId, titulo?, descripcion, responsableId, responsableNombre, plazoFecha, prioridad?, estado: 'PENDIENTE'|'EN_EJECUCION'|'CERRADA', creadoEn, actualizadoEn, descripcionEvidencia?, evidenciaUrl?, fechaCierre? }`. `qeId` replaces the field previously implied by ownership context, matching `ncId`/`incidenteId` on the sibling types. Rationale: reusing the exact field set lets `QEACSection` copy `ACSection.tsx` almost verbatim (props, modals, badges), minimizing new code and keeping the three modules visually/behaviorally consistent per CLAUDE.md's canonical-reference guidance. Alternative considered — keep `AccionCorrectivaQE`'s leaner shape (`fechaLimite`, `evidencia` single field) — rejected because it would force `QEACSection` to diverge from the `ACSection` reference pattern the spec explicitly calls out, doubling the modal/validation code to maintain.

Note: the spec text's `PENDIENTE → EN_EJECUCION → CERRADA` flow (three states, no `COMPLETADA`) is narrower than M2's four-state flow (`PENDIENTE → EN_EJECUCION → COMPLETADA → CERRADA`, with `VENCIDA` as a fifth computed state). `QEACSection` follows the spec's three-state flow: "Iniciar" (PENDIENTE→EN_EJECUCION) and "Cerrar con evidencia" become available directly from `EN_EJECUCION` (no separate "Completar" step).

### 2. Sub-resource endpoints under `/api/quality-events/:id/acciones-correctivas`, backed by the QE's embedded array

MSW handlers read/write `qe.accionesCorrectivas` in-place (same pattern `quality-events.handlers.ts` already uses for the parent PATCH endpoints), rather than introducing a separate `qeStore`-adjacent AC collection. This matches the existing single-source-of-truth-per-QE-object pattern and avoids a second lookup structure to keep in sync. The `qeAccionesCorrectivas` fixture map from the spec is used only to *seed* `accionesCorrectivas` on the relevant fixture QEs at module load — it is not a separate runtime store.

### 3. Audit trail is a read view over the QE's existing `auditTrail` array, exposed as its own endpoint

`GET /api/quality-events/:id/audit-trail` returns `qe.auditTrail` sorted descending by `timestamp`. No new fixture data model is introduced — but current fixtures only carry 1–2 entries each (creation + one state change), short of the spec's "at least 4 entries per QE" bar, so this change extends `auditTrail` on the existing 20 fixture QEs (adding a field-edit and, where applicable, a causa-raíz-approval entry) rather than inventing a parallel collection. This keeps a single append-only source of truth per RN-QE-001/audit-trail invariants (CLAUDE.md) instead of duplicating entries into a parallel collection. The endpoint exists (rather than reading `useQualityEvent(id).data.auditTrail` directly) because the spec calls for a dedicated `GET .../audit-trail` route and because `QEAuditTrail` should be able to poll/refetch independently of the full QE object as future AC/investigation mutations land.

### 4. Investigation tool switch uses a Sonner confirm-toast, not a second modal

`t.confirm`-in-a-toast (`toast(message, { action: { label: 'Confirmar cambio', onClick } })`) is a lighter-weight than adding a new modal component for a single yes/no gate, and is consistent with CLAUDE.md's "never `alert()`/`confirm()`" rule pointing at Sonner as the sanctioned mechanism. Alternative — a `<Modal>` like `CerrarACModal` — rejected as overkill for a single confirm action with no form fields.

### 5. PIN approval is a local component, not a shared "signature" primitive

The spec fixes the PIN to a hardcoded mock (`1234`) checked client-side inside `QEInvestigationSection`; no new shared `SignaturePinModal` is introduced because no other M1–M4 flow currently reuses one (M1's approval-by-password is a separate, unrelated flow). If a third consumer appears (e.g. M4-S06 cierre signature), extracting a shared component becomes worthwhile then — not speculatively now.

### 6. `qeId` on NC/Incident ACs is additive-only; no migration of existing fixture data beyond the QEs' own `TODO(M4-S05)` cross-references

The three `TODO(M4-S05)` comments in `quality-events.fixtures.ts` (`incidenteId: 'inc-002'`, `ncId: 'nc-002'`, `incidenteId: 'inc-001'`, `ncId: 'nc-003'`) reference specific NC/Incident IDs. Only the ACs on those specific NC/Incident fixtures get a `qeId` back-link populated (pointing at the QE that owns the follow-up investigation), per the proposal's "already referenced in the fixtures of M4" scope — not every AC in the 20+ NC/Incident fixtures.

## Risks / Trade-offs

- [Risk] Narrowing the AC state flow to three states (no `COMPLETADA`) inside `QEACSection` while M2/`ACSection` keeps four states creates two divergent AC lifecycles in the same codebase → Mitigation: the underlying `estado` union type is shared/compatible (`'PENDIENTE'|'EN_EJECUCION'|'COMPLETADA'|'CERRADA'`) so a future spec can add the `COMPLETADA` step to QE ACs without a breaking type change; document the intentional divergence in code comments only where non-obvious (the "Cerrar" button firing from `EN_EJECUCION`).
- [Risk] Embedding AC writes inside the QE's mutable `qeStore` object (in-memory MSW) means a full-page reload loses all AC/investigation/status changes, same as every other MSW-backed module today → Mitigation: this is the accepted, existing MSW trade-off across M1–M4; no new mitigation needed.
- [Risk] `causaRaizFirmadaEn`/RN-QE-002 guard is enforced both client-side (button disabled) and server-side (`PATCH .../status` 422 in the existing handler) — the two could drift if either is edited independently → Mitigation: `QEStatusTransitionPanel` re-derives its guard from the same `qe.causaRaizFirmadaEn` field the handler checks, no parallel constant.
- [Risk] Hardcoded PIN `1234` is not a real security control → Mitigation: explicitly scoped as a mock per CLAUDE.md's auth section (JWT/real firma is a backend concern not yet built); acceptable for MSW-only phase.

## Migration Plan

Additive change, no data migration: `AccionCorrectivaQE`'s field rename (`fechaLimite`→`plazoFecha`, `evidencia`→`descripcionEvidencia`/`evidenciaUrl`) only affects the stub type with zero fixture usages today (every QE fixture has `accionesCorrectivas: []`), so there is nothing to backfill. Roll out in one PR; rollback is a plain revert since no persisted (non-MSW) state exists.

## Open Questions

None — Modelo B, AC shape, and endpoint scope were confirmed in the proposal input.
