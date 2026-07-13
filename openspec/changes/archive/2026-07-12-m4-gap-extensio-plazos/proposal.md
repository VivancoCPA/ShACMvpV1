## Why

Alta Dirección's dashboard already lists Acciones Correctivas (AC) with a pending deadline-extension request via `ACsExtensionPlazoWidget.tsx`, but the widget only navigates to the parent Quality Event — there is no button, modal, or endpoint anywhere in the codebase to propose, approve, or reject that request. PRD §1.6 ("Reglas de Plazo para Acciones Correctivas", criterio QE-AC-007) requires a real approval flow: a responsible party proposes a new deadline, and the Jefe de Calidad (or Alta Dirección, depending on severity/magnitude) can approve or reject it, updating the deadline and preserving history. This proposal closes that gap.

## What Changes

- **BREAKING**: `SolicitudAjustePlazoAC` on `AccionCorrectivaQE` changes from a single optional object (`solicitudAjustePlazo?`) to a history array (`solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`), adding `id`, `requiereAprobacionGerencia`, `revisadoPorId`, `revisadoEn`, and `comentarioRevision` fields. Existing fixtures with a populated `solicitudAjustePlazo` migrate to a one-element array.
- Add `PLAZO_SUGERIDO_DIAS_HABILES` and `PLAZO_MINIMO_DIAS_HABILES` constants (by `QESeverity`) to the quality-events constants module.
- Add a "Solicitar ajuste de plazo" action in `QEACSection.tsx`, visible to the AC's responsable, that opens a modal to propose a new deadline + justification, computing and previewing whether the request will require Gerencia (Alta Dirección) approval before submission.
- Add an approve/reject panel in `QEACSection.tsx` for a pending request, visible only to the role authorized to decide it (`JEFE_CALIDAD_SYST` or `ALTA_DIRECCION`, based on `requiereAprobacionGerencia`).
- Add two new mock API endpoints under `/api/quality-events/{qeId}/acciones-correctivas/{acId}/solicitud-plazo` (POST to propose, PATCH to approve/reject), plus their MSW handlers, audit trail entries on the parent QE, and toast notifications following existing patterns.
- Update `ACsExtensionPlazoWidget.tsx` and its test to read the new `solicitudesAjustePlazo` array (filtering `PENDIENTE` + `requiereAprobacionGerencia === true`) instead of the removed singular field.

## Capabilities

Capability ownership follows existing precedent in this codebase: MSW endpoint requirements live in `quality-event-msw-handlers` (see how `editar-severidad`/`editar-mineral` were added there, not bundled into the feature capability), and self-contained UI flows embedded in an existing screen get their own capability (see `quality-event-severidad-mineral-edit`, a modal-only capability that reuses mutations specified elsewhere).

### New Capabilities

- `ac-plazo-extension`: the propose/approve/reject business flow — `SolicitudAjustePlazoAC` type extension, `PLAZO_SUGERIDO_DIAS_HABILES`/`PLAZO_MINIMO_DIAS_HABILES` constants and the `requiereAprobacionGerencia` calculation, the request modal and approve/reject panel in `QEACSection.tsx`, the `ACsExtensionPlazoWidget.tsx` update to the new array shape, and fixture seeding for this flow.

### Modified Capabilities

- `quality-event-ac-section`: the `AccionCorrectivaQE` interface requirement ("AccionCorrectivaQE is owned by the Quality Event (Modelo B)") gains `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`, replacing the untracked `solicitudAjustePlazo` singular field currently in code.
- `quality-event-msw-handlers`: two new endpoints under the `acciones-correctivas` sub-resource — `POST .../solicitud-plazo` and `PATCH .../solicitud-plazo/:solicitudId`.
- `quality-event-audit-trail`: `QEAuditTrail` recognizes three new `accion` values (`AC_AJUSTE_PLAZO_SOLICITADO`, `AC_AJUSTE_PLAZO_APROBADO`, `AC_AJUSTE_PLAZO_RECHAZADO`).
- `quality-event-msw-fixtures`: fixtures migrate any populated `solicitudAjustePlazo` to a one-element `solicitudesAjustePlazo` array, plus at least one seeded `PENDIENTE` request requiring Gerencia approval (for `ACsExtensionPlazoWidget` dev visibility).

## Impact

- **Affected code**: `qualityEvent.types.ts`, `QEACSection.tsx`, `quality-events.api.ts`, `mocks/handlers/quality-events.handlers.ts`, `mocks/fixtures/quality-events.fixtures.ts`, `dashboardSummary.types.ts`, `ACsExtensionPlazoWidget.tsx` (+ its test), new constants file in `features/quality-events/`, new Zod schemas for the propose/review forms, new TanStack Query hooks.
- **No backend impact**: MSW is the only data source today; the REST shape follows the existing `/api/quality-events/{qeId}/acciones-correctivas/{acId}/...` convention so a future .NET backend can implement it without UI changes.
- **No changes** to KPI-01–KPI-09 or any other M5 dashboard widget.
- **Reused utilities**: `contarDiasHabiles` from `src/utils/businessDays.ts` (not reimplemented).
