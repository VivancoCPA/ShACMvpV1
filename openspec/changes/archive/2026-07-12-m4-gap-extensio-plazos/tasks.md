## 1. Types and constants

- [x] 1.1 In `qualityEvent.types.ts`, redefine `SolicitudAjustePlazoAC` with `id`, `fechaSolicitada`, `justificacion`, `estado`, `solicitadoPorId`, `solicitadoEn`, `requiereAprobacionGerencia`, `revisadoPorId?`, `revisadoEn?`, `comentarioRevision?`.
- [x] 1.2 Replace `AccionCorrectivaQE.solicitudAjustePlazo?` with `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`.
- [x] 1.3 Update `ACSolicitudAjustePlazoResumen` (`dashboardSummary.types.ts`) to reference `solicitudesAjustePlazo` instead of the singular field.
- [x] 1.4 Create `src/features/quality-events/constants/plazoAjuste.constants.ts` exporting `PLAZO_SUGERIDO_DIAS_HABILES` and `PLAZO_MINIMO_DIAS_HABILES` (`Record<QESeverity, number>`) per PRD §1.6.
- [x] 1.5 Add `calcularRequiereAprobacionGerencia(qeSeveridad, incrementoDiasHabiles)` (reusing `contarDiasHabiles` from `src/utils/businessDays.ts`, never `ac.prioridad`), colocated with the constants or in a small `plazoAjuste.utils.ts`.

## 2. Fixtures migration

- [x] 2.1 In `quality-events.fixtures.ts`, add `solicitudesAjustePlazo: []` to every seeded `AccionCorrectivaQE` in `qeAccionesCorrectivas`; migrate any previously-populated `solicitudAjustePlazo` object into a one-element array with a generated `id` and computed `requiereAprobacionGerencia`.
- [x] 2.2 Seed at least one `PENDIENTE` request with `requiereAprobacionGerencia: true` on an `ALTA`/`CRITICA`-severity QE's AC (for `ACsExtensionPlazoWidget` dev data).
- [x] 2.3 Seed at least one `PENDIENTE` request with `requiereAprobacionGerencia: false` (Jefe de Calidad-only) for `QEACSection` approve/reject panel coverage.
- [x] 2.4 Grep the fixtures file and confirm no remaining `solicitudAjustePlazo` (singular) reference.

## 3. MSW handlers

- [x] 3.1 Add `POST /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo` to `quality-events.handlers.ts`: validate responsable-only, AC not `CERRADA`, no existing `PENDIENTE` request, and minimum-plazo floor; compute `requiereAprobacionGerencia`; append the new request and an `AC_AJUSTE_PLAZO_SOLICITADO` audit entry.
- [x] 3.2 Add `PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId` to `quality-events.handlers.ts`: validate `estado === 'PENDIENTE'` on the target request, role-gate by `requiereAprobacionGerencia`, require `comentarioRevision` on `RECHAZAR`; on `APROBAR` update `ac.plazoFecha` and append `AC_AJUSTE_PLAZO_APROBADO`; on `RECHAZAR` leave `plazoFecha` unchanged and append `AC_AJUSTE_PLAZO_RECHAZADO`.

## 4. API client and hooks

- [x] 4.1 Add `solicitarAjustePlazoAC(qeId, acId, data)` and `revisarAjustePlazoAC(qeId, acId, solicitudId, data)` to `quality-events.api.ts`.
- [x] 4.2 Add Zod schemas for the propose form (`fechaSolicitada`, `justificacion` min 50 chars) and the reject confirmation (`comentarioRevision` required) under `features/quality-events/schemas/`.
- [x] 4.3 Add TanStack Query mutation hooks (`useSolicitarAjustePlazoAC`, `useRevisarAjustePlazoAC`) invalidating the QE detail query on success, following the pattern of `useCerrarQEAccion`.

## 5. QEACSection UI

- [x] 5.1 Add a "Solicitar ajuste de plazo" action per AC row, visible only to the responsable when `!readOnly && ac.estado !== 'CERRADA'` and no `PENDIENTE` request exists for that AC.
- [x] 5.2 Build the request modal (same visual pattern as `CerrarQEACModal`/`AgregarQEACModal`): `fechaSolicitada` date input, `justificacion` textarea, live-computed Gerencia/Jefe-de-Calidad preview badge, client-side minimum-plazo validation blocking submit.
- [x] 5.3 Build the approve/reject panel: renders when an AC has a `PENDIENTE` request, shows `fechaSolicitada`/`justificacion`/requester name, "Aprobar"/"Rechazar" buttons gated by `requiereAprobacionGerencia` + `user.rol`, read-only for other roles. "Rechazar" opens a confirmation requiring `comentarioRevision`.
- [x] 5.4 Wire toasts: `toast.success` + `toast.info` (approver notified) on propose; `toast.success`/`toast.info` (responsable notified) on approve/reject, per `QECierreSection.tsx`/`QEVerificacionSection.tsx` patterns.

## 6. Audit trail rendering

- [x] 6.1 In `QEAuditTrail.tsx`, add icon + description handling for `AC_AJUSTE_PLAZO_SOLICITADO`, `AC_AJUSTE_PLAZO_APROBADO`, `AC_AJUSTE_PLAZO_RECHAZADO`, each with a distinct `lucide-react` icon.

## 7. Dashboard widget

- [x] 7.1 Update `ACsExtensionPlazoWidget.tsx` to read `solicitudesAjustePlazo` and filter to the latest `PENDIENTE && requiereAprobacionGerencia === true` entry per AC.
- [x] 7.2 Update `ACsExtensionPlazoWidget.test.tsx` (and any dashboard summary fixture builders it depends on) for the new array shape.

## 8. i18n

- [x] 8.1 Add `es-PE` and `en-US` keys for the request modal, approve/reject panel, badges, and toasts under the `qualityEvents` (and `dashboard`, if the widget's empty/label text changes) namespaces.

## 9. Verification

- [x] 9.1 `grep -r "solicitudAjustePlazo\b"` (singular) across `src/` returns no matches outside `solicitudesAjustePlazo`.
- [ ] 9.2 Manually exercise CA-01 through CA-09 from the proposal in the running app (propose as responsable, approve/reject as the correct role per severity/increment, verify history and widget filtering).
- [ ] 9.3 Confirm dark mode styling and role-gating on the new modal/panel/badges; confirm KPI-01–KPI-09 and other M5 widgets are untouched.
