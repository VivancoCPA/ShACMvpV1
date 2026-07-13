## Context

`ACsExtensionPlazoWidget.tsx` (M5-S06, `features/dashboard/components/`) already renders a list of ACs with a pending deadline-extension request for Alta Dirección, reading `ACSolicitudAjustePlazoResumen.solicitudAjustePlazo` (a singular, optional object on `AccionCorrectivaQE`). Clicking a row only navigates to `/quality-events/:qeId` — there is no propose/approve/reject UI anywhere, no dedicated endpoint, and the singular-object shape cannot retain history across repeated extension requests on the same AC. PRD §1.6 (criterio QE-AC-007) requires the full flow: responsable proposes → correct approver (Jefe de Calidad or Gerencia, decided by `qe.severidad` and how large the extension is) approves/rejects → `ac.plazoFecha` updates and the request is preserved in history.

`contarDiasHabiles(desde, hasta, feriados)` already exists in `src/utils/businessDays.ts` and is reused, not reimplemented. The REST convention `/api/quality-events/{qeId}/acciones-correctivas/{acId}/...` (confirmed in `quality-events.api.ts`) is extended with a `solicitud-plazo` sub-resource, consistent with how `.../status` already works.

## Goals / Non-Goals

**Goals:**
- Let the AC's `responsableId` propose a new `plazoFecha` with justification, from `QEACSection.tsx`.
- Compute, at proposal time, whether the request needs Jefe de Calidad or Alta Dirección approval, per the PRD §1.6 table, using `qe.severidad` (never `ac.prioridad`).
- Let the correct approver approve (updates `ac.plazoFecha`, preserves history) or reject (comment required, `plazoFecha` unchanged) from the same section.
- Preserve full request history per AC (`solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`).
- Keep `ACsExtensionPlazoWidget.tsx` working against the new array shape, filtered to Gerencia-only pending requests.

**Non-Goals:**
- No changes to KPI-01–KPI-09 or any other M5 widget.
- No real backend/notification system — toasts only, matching the rest of M4.
- No change to `ac.prioridad` semantics — it stays an independent, optional, free-choice label.
- No retroactive recomputation of `requiereAprobacionGerencia` for existing/past requests when a later request changes `ac.plazoFecha` — each request computes and freezes its own flag at creation time.

## Decisions

**D1 — `solicitudesAjustePlazo` is an array, keyed by request `id`, not a single mutable object.**
The current `solicitudAjustePlazo?: SolicitudAjustePlazoAC` cannot represent "AC extended twice, once rejected once approved" — CA-05/CA-06 explicitly require that history survive. Alternative considered: keep the singular field and overwrite it, storing history separately in the audit trail only. Rejected because the audit trail is a generic append-only log (`QEAuditTrailEntry`), not a queryable per-AC structure, and the widget/UI need direct access to "the current pending request," which is easiest as `solicitudesAjustePlazo.find(s => s.estado === 'PENDIENTE')`.

**D2 — `requiereAprobacionGerencia` is computed once at proposal time and frozen on the request record.**
Alternative considered: compute it dynamically wherever needed (widget, approve panel) from `qe.severidad` + a stored `incrementoDiasHabiles`. Rejected because `plazoFecha` can change between the request being created and being reviewed if a *different* request on the same AC were hypothetically concurrent (blocked by CA-08, but still: freezing avoids any drift and makes the approve/reject panel's role-gating a simple boolean read, matching how `resultadoVerificacion` and other decision fields are frozen once set elsewhere in `qualityEvent.types.ts`).

**D3 — Increment is measured from the AC's *current* `plazoFecha`, not the original/suggested deadline.**
This is Decisión Abierta #1 in the source spec, defaulted per the proposal's stated preference: "desde el plazo vigente actual." Rationale: `contarDiasHabiles(ac.plazoFecha, fechaSolicitada)` reads naturally as "how many extra business days is this specific request asking for," and requires no extra state (no need to track the AC's original/suggested deadline separately). Risk noted in Risks/Trade-offs below.

**D4 — `ACsExtensionPlazoWidget.tsx` filters to `estado === 'PENDIENTE' && requiereAprobacionGerencia === true`.**
This is Decisión Abierta #2, defaulted per the proposal's framing of the widget as Alta-Dirección-specific ("extensiones que esperan aprobación de Gerencia"). Jefe de Calidad has no equivalent dashboard widget today, so their pending requests are surfaced only inside `QEACSection.tsx` itself — acceptable since Jefe de Calidad already works primarily from the QE detail page for AC state changes (same pattern as "Iniciar"/"Cerrar con evidencia").

**D5 — Justificación minimum length: 50 characters.**
This is Decisión Abierta #3, defaulted per the proposal's stated precedent ("igual que otros campos de justificación del sistema").

**D6 — New endpoints as two calls, not folded into the existing `.../status` PATCH.**
`POST .../acciones-correctivas/:acId/solicitud-plazo` (propose) and `PATCH .../acciones-correctivas/:acId/solicitud-plazo/:solicitudId` (approve/reject) are separate from `PATCH .../status` (`updateQEAccion`/`cerrarQEAccion`) because they mutate a different sub-resource (`solicitudesAjustePlazo`, not `ac.estado`) and have entirely different authorization rules (severity + role-conditional, not the fixed `JEFE_CALIDAD_SYST`-only gate `.../status` uses today). Reusing `.../status` would require overloading its body shape and its 422-on-missing-evidence validation path.

**D7 — Role-gating for the approve/reject panel lives inline in `QEACSection.tsx`, not in `getQualityEventPermissions`.**
`getQualityEventPermissions(estado, rol, esResponsable)` returns one `QEPermissions` object for the whole QE and doesn't have visibility into a specific AC's `requiereAprobacionGerencia` flag (which varies per-request, not per-QE-state). Threading that through would require widening `QEPermissions`'s signature for a single, narrowly-scoped feature. Instead, `QEACSection.tsx` computes the boolean inline (`user.rol === 'JEFE_CALIDAD_SYST' && !solicitud.requiereAprobacionGerencia`) || (`user.rol === 'ALTA_DIRECCION' && solicitud.requiereAprobacionGerencia`), matching how the "Nueva AC" button and "Iniciar"/"Cerrar" buttons already gate inline in that same component rather than through the shared permissions helper.

## Risks / Trade-offs

- **[Risk] D3's "current plazoFecha" base means a responsable could split one large extension into several small approved requests, each individually under the 50% Gerencia threshold, cumulatively bypassing Gerencia oversight for a severity-ALTA AC.** → Mitigation: CA-08 (no second `PENDIENTE` request while one is open) limits this to sequential, not simultaneous, requests, and each approved extension is a distinct audit-trail entry visible to Jefe de Calidad and Alta Dirección — the trail is inspectable even if the 50% gate itself doesn't accumulate. Flagged as an explicit open question for Toño rather than silently resolved, since D3 was the proposal's own default, not a hard requirement.
- **[Risk] Migrating `solicitudAjustePlazo` → `solicitudesAjustePlazo` is a breaking type change.** → Mitigation: no external consumers exist yet (MSW is the only backend), so the migration is contained to `qualityEvent.types.ts`, `dashboardSummary.types.ts`, fixtures, and the one widget — verified via the code audit in the proposal (§2). A grep for `solicitudAjustePlazo` (singular) after implementation should return zero remaining references outside the migration commit itself.
- **[Risk] Two authorization paths (Jefe de Calidad vs. Alta Dirección) gating the same UI panel increases the chance of a role seeing a stale/incorrect view.** → Mitigation: the panel's visibility check re-derives from the live `solicitud.requiereAprobacionGerencia` + `user.rol` on every render (no cached/derived state), following the same pattern as `showForm`/`showSummary` booleans in `QEVerificacionSection.tsx`.

## Migration Plan

1. Type change first (`qualityEvent.types.ts`, `dashboardSummary.types.ts`) — compiles red until fixtures/widget are updated, which is expected and used as a checklist.
2. Fixture migration (`quality-events.fixtures.ts`) — convert any populated `solicitudAjustePlazo` to `solicitudesAjustePlazo: [...]`, seed at least one Gerencia-pending request.
3. Constants + calculation utility.
4. API client functions + MSW handlers (server-side logic first, so the UI has something real to call against in dev).
5. `QEACSection.tsx` UI (request modal, approve/reject panel) + audit trail entries + toasts.
6. `ACsExtensionPlazoWidget.tsx` + its test updated to the new array shape and Gerencia filter.
7. No rollback concerns beyond standard git revert — no real backend/migration to unwind, MSW-only.

## Open Questions

Carried over from the proposal's §7, defaulted per D3/D4/D5 above but not independently re-confirmed with Toño as part of this design:
1. Should the increment accumulate from the AC's original suggested deadline instead of its current `plazoFecha`? (Defaulted: current `plazoFecha`, D3.)
2. Should `ACsExtensionPlazoWidget.tsx` show all pending requests regardless of approver, instead of Gerencia-only? (Defaulted: Gerencia-only, D4.)
3. Is 50 characters the right minimum for `justificacion`? (Defaulted: 50, D5.)
