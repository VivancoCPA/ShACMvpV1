## Context

`ACSection` (in `features/nonconformities`) already renders per-AC "Ver en QE" links keyed off `AccionCorrectiva.qeId` (Modelo B: individual ACs that migrated to a QE). This change adds a second, coarser linkage: when the whole NC has escalated and `NoConformidad.qeGeneradoId` is populated, the NC's AC list stops being the source of truth entirely — the QE's own `QEACSection` (already implemented) takes over. `ACSection` must reflect that by going read-only and offering a "Solicitar AC en QE" action instead of "Agregar AC". The receiving side (`PATCH /api/quality-events/:id/solicitar-ac`, `QualityEvent.solicitudesAC`, the `JEFE_CALIDAD_SYST` banner in `QEACSection`) already exists from M4; this change only adds the NC-side caller.

## Goals / Non-Goals

**Goals:**
- Make `ACSection` read-only (no create/transition/close actions) once `nc.qeGeneradoId` is set.
- Let authorized roles request a new AC in the linked QE from the NC screen, reusing the existing `solicitar-ac` endpoint.
- Zero behavior change for NCs without a generated QE.

**Non-Goals:**
- No changes to `QEACSection`, the `solicitudesAC` counter, or the MSW handler — all already implemented.
- No change to the per-AC `ac.qeId` "Ver en QE" link (Modelo B individual-AC migration) — it stays as-is.
- No new permission flags in `NCPermissions` — reuse `canAsignarAC` for the "Solicitar AC en QE" gate, since it already represents "this role manages this NC's corrective actions."

## Decisions

- **Reuse `canAsignarAC` to gate "Solicitar AC en QE"**, rather than adding a new permission field. The action is a variant of "managing this NC's ACs," so the existing role gate (SUPERVISOR/JEFE_CALIDAD_SYST per `ncPermissions.ts`) applies unchanged.
- **Add `solicitarACEnQE(qeId)` to `quality-events.api.ts` and a `useSolicitarACEnQE` hook in the quality-events feature**, not the nonconformities feature, since the endpoint and its cache (`QueryClient` keys for QE detail) belong to the QE domain. `ACSection` imports the hook cross-feature — the same pattern already used for `qualityEventFixtures` in the existing per-AC link.
- **Read-only condition is a single derived boolean** (`isQELinked = !!nc.qeGeneradoId`) computed once in `ACSection`, gating: the "Agregar AC" button, all per-AC transition/close buttons, and switching in the "Solicitar AC en QE" button. No new NC state machine changes.
- **Button placement**: below the list when non-empty, in the header when empty — mirrors the existing "Agregar AC" placement pattern already in the component (header-adjacent action button), so no new layout primitive is needed.

## Risks / Trade-offs

- [Stale `solicitudesAC` count if the NC-side request succeeds but the user never revisits the QE] → Acceptable for MVP; `QEACSection`'s existing banner is the durable indicator for `JEFE_CALIDAD_SYST`, this button is fire-and-forget from the NC side.
- [Cross-feature import of a quality-events hook into nonconformities] → Already an established pattern in this codebase (`ACSection` imports `qualityEventFixtures` directly); no new architectural precedent.
