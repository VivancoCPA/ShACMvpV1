## Context

`IncidentACSection` (in `features/incidents`) is structurally the same component as `ACSection` (in `features/nonconformities`), duplicated per module: same modals (`AgregarACModal`, `CerrarACModal`), same `AC_STATUS_COLORS`, same transition-button pattern. `m4-s06-ac-qe-linkage` already added the QE-linkage pattern to the NC side: read-only mode, "Ver en QE" link, and a "Solicitar AC en QE" button calling the existing `PATCH /api/quality-events/:id/solicitar-ac` endpoint. `Incidente.qeId` is the exact structural counterpart of `NoConformidad.qeGeneradoId` (both set once the parent record escalates into a QE) — this change ports the identical pattern to `IncidentACSection`, reusing the QE-side API/hook added by `m4-s06-ac-qe-linkage` rather than re-implementing it.

## Goals / Non-Goals

**Goals:**
- Make `IncidentACSection` read-only (no create/transition/close actions) once `incidente.qeId` is set.
- Let roles with `canAddAC` request a new AC in the linked QE from the incident screen, reusing the shared `solicitar-ac` endpoint/hook.
- Zero behavior change for incidents without a linked QE.
- Keep the implementation identical in shape to `m4-s06-ac-qe-linkage`'s NC-side change, since both sections are structural duplicates.

**Non-Goals:**
- No changes to `QEACSection`, `solicitudesAC`, or the MSW handler — already implemented.
- No changes to the individual `AccionCorrectivaIncidente.qeId` field or per-AC linking — this change only wires the section-level `incidente.qeId`.
- No deduplication of `IncidentACSection` and `ACSection` into a shared component — out of scope; each module keeps its own copy per current codebase convention.

## Decisions

- **Reuse `canAddAC` to gate "Solicitar AC en QE"**, mirroring how `m4-s06` reused `canAsignarAC` on the NC side — it already represents "this role manages this incident's corrective actions" (`incidentPermissions.ts`).
- **Reuse `solicitarACEnQE(qeId)` / `useSolicitarACEnQE()` from the quality-events feature** (added by `m4-s06-ac-qe-linkage`) rather than adding an incidents-specific copy. If `m4-s06` has not yet been implemented when this change is applied, add the function/hook there (single shared implementation), not duplicated per module.
- **Read-only condition is a single derived boolean** (`isQELinked = !!qeId`) computed once in `IncidentACSection`, gating the "+ Agregar AC" button, all per-AC transition/close buttons, and the "Solicitar AC en QE" button — same shape as the NC-side change.
- **Button placement**: below the list when non-empty, in the header when empty — matches the existing "+ Agregar AC" placement already in the component.

## Risks / Trade-offs

- [Two independent copies of the QE-linkage UI logic (NC and Incident) instead of one shared component] → Accepted: matches the existing duplication already present between `ACSection` and `IncidentACSection`; introducing a shared component is a larger refactor out of scope here.
- [Cross-feature import of a quality-events hook into incidents] → Already an established pattern (`m4-s06` did the same for nonconformities); no new architectural precedent.
