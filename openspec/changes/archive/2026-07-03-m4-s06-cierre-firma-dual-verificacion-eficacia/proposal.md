## Why

M4-S05 shipped `QualityEventDetail` with investigation and AC (Modelo B) sections, but the `CERRADO` transition in `QEStatusTransitionPanel` is an explicit stub ("Disponible en cierre", always disabled) and there is no UI or MSW support for closing a Quality Event, verifying corrective-action effectiveness, or reopening on failed verification. Without this, a QE can reach `EN_EJECUCION` but can never legitimately reach `CERRADO`, `VERIFICADO`, or `REABIERTO` — the last three states of the ISO 9001 §7.5 / ISO 45001 §10.2 lifecycle are unreachable. This spec closes that gap: dual-signature closure (RN-QE-004), effectiveness verification (REG-EFEC-001), and automatic reapertura (RN-QE-007/008).

## What Changes

- Auto-transition `EN_EJECUCION → PENDIENTE_CIERRE` once every `accionesCorrectivas` entry is `CERRADA` with evidence, surfaced via an in-app toast to `JEFE_CALIDAD_SYST`/`SUPERVISOR` and a 5-business-day informational `DeadlineBadge`.
- New `QECierreSection`: closure form (`resultadoCierre` 100–500 chars, `plazoVerificacionDias` 30/60/90/custom) followed by a dual electronic signature (PIN mock `1234`), reusing the PIN-modal pattern from M4-S05's causa-raíz approval.
- Dual-signature rule (RN-QE-004): first signature `JEFE_CALIDAD_SYST`, second `SUPERVISOR` — unless the first signer's own role/area coincide with the area's supervisor, in which case the second signature is required from `ALTA_DIRECCION` instead. Both signatures are required before `estado` becomes `CERRADO`; attempting to finalize with only one is rejected with a descriptive error (QE-AC-006).
- `CERRADO` state stamps `fechaCierre`, computes `fechaVerificacionProgramada` (`fechaCierre` + `plazoVerificacionDias` days), and displays a closure summary + verification countdown in the header.
- New `QEVerificacionSection` hosting the `EN_VERIFICACION` task (10 business days, RN-QE-008) and the REG-EFEC-001 form (`resultado`: Efectivo/No efectivo + `evidencia` text), gated to `JEFE_CALIDAD_SYST` or `AUDITOR_INTERNO` (when responsable). "Efectivo" → `VERIFICADO` (terminal). "No efectivo" → reapertura.
- Reapertura (RN-QE-007/008): triggered by a "No efectivo" result or by a dev-only "Forzar vencimiento" control (no real cron exists in this mocked frontend). Increments `ciclo`, sets `estado: 'EN_INVESTIGACION'` directly (never persists `REABIERTO` as `qe.estado`; it survives only as an audit-trail `accion`/motivo label), and preserves the full prior-cycle history.
- Every transition in this flow (auto-`PENDIENTE_CIERRE`, each individual signature, `CERRADO`, `EN_VERIFICACION`, `VERIFICADO`, reapertura) appends an immutable `QEAuditTrailEntry`, following the M4-S05 pattern.
- `QEStatusTransitionPanel` drops its `CERRADO` stub and no longer renders generic buttons for `CERRADO`/`EN_VERIFICACION`/`VERIFICADO`/`REABIERTO` targets — those transitions are now exclusively driven by `QECierreSection`/`QEVerificacionSection`.
- Four new MSW endpoints on `quality-events.handlers.ts`: `PATCH /:id/cerrar`, `PATCH /:id/firmar-cierre`, `PATCH /:id/forzar-vencimiento-verificacion` (dev-only), `POST /:id/verificacion-eficacia`.

## Capabilities

### New Capabilities
- `quality-event-cierre`: `QECierreSection` component covering the `PENDIENTE_CIERRE` closure form, dual electronic signature (with the same-user/`ALTA_DIRECCION` escalation rule), and the `CERRADO` summary display; the `/cerrar` and `/firmar-cierre` MSW endpoints; and the auto-transition into `PENDIENTE_CIERRE`.
- `quality-event-verificacion`: `QEVerificacionSection` component covering the REG-EFEC-001 effectiveness-verification form, the dev-only vencimiento-forcing control, and the `VERIFICADO`/reapertura outcomes; the `/verificacion-eficacia` and `/forzar-vencimiento-verificacion` MSW endpoints.

### Modified Capabilities
- `quality-event-types`: adds `fechaCierre`, `cierreFirmaSupervisorRol` (`'SUPERVISOR' | 'ALTA_DIRECCION'`), and `evidenciaVerificacion` to `QualityEvent`; changes the `getValidQETransitions` map entry for `REABIERTO` from `['EN_EJECUCION']` to `['EN_INVESTIGACION']`.
- `quality-event-schemas`: replaces `qualityEventCierreSchema` (which incorrectly bundled signer IDs into the form schema) with `qualityEventCierreFormSchema` (`resultadoCierre` + `plazoVerificacionDias` only); adds `firmarCierreSchema` (`rol` + `pin`) and `verificacionEficaciaSchema` (`resultado` + `evidencia`).
- `quality-event-permissions`: adds `puedeFirmarCierre` for `ALTA_DIRECCION` (gated by the same-user escalation, via the existing `esResponsable` parameter) and `puedeVerificar` for `JEFE_CALIDAD_SYST` in `EN_VERIFICACION`; adds a `resolveRolSegundaFirma` helper implementing the escalation rule.
- `quality-event-detail-page`: `QualityEventDetail` gains two new conditionally-rendered sections (`QECierreSection`, `QEVerificacionSection`); `QEStatusTransitionPanel` removes the `CERRADO` stub and excludes `CERRADO`/`EN_VERIFICACION`/`VERIFICADO`/`REABIERTO` from its generic transition buttons; `QEHeaderSection` displays `fechaCierre`, `resultadoCierre`, `plazoVerificacionDias`, and a verification countdown when applicable.
- `quality-event-msw-handlers`: adds the four new endpoints listed above; extends the AC status-transition handler to auto-flip `EN_EJECUCION → PENDIENTE_CIERRE` once all ACs are closed with evidence.
- `quality-event-ac-section`: documents the auto-transition side effect triggered when the last AC closes with evidence, and the in-app notification shown to `JEFE_CALIDAD_SYST`/`SUPERVISOR`.

## Impact

- `src/features/quality-events/components/`: new `QECierreSection.tsx`, `QEVerificacionSection.tsx`; modified `QEStatusTransitionPanel.tsx`, `QEHeaderSection.tsx`, `QEACSection.tsx`.
- `src/features/quality-events/pages/QualityEventDetail.tsx`: composition update.
- `src/features/quality-events/schemas/`: `qualityEventCierre.schema.ts` reshaped, new `firmarCierre.schema.ts`, `verificacionEficacia.schema.ts` (+ matching tests).
- `src/features/quality-events/types/qualityEvent.types.ts`, `utils/qualityEventTransitions.ts`, `utils/qualityEventPermissions.ts` (+ existing tests updated).
- `src/features/quality-events/api/quality-events.api.ts` and new hooks (`useCerrarQE`, `useFirmarCierre`, `useForzarVencimientoVerificacion`, `useVerificacionEficacia`).
- `src/mocks/handlers/quality-events.handlers.ts`: four new endpoints + AC-close side effect.
- `src/i18n/es-PE.json`, `src/i18n/en-US.json`: new `qualityEvents` keys for both sections.
- No backend impact (backend does not exist yet); no changes to other modules (M1–M3, M5, M6).
