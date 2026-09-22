## MODIFIED Requirements

### Requirement: First signature (JEFE_CALIDAD_SYST) via PIN modal
`QECierreSection` SHALL render a "Firmar como Jefe de Calidad" button visible only to role `JEFE_CALIDAD_SYST` when `qe.resultadoCierre` is set and `qe.cerradoPorId` is empty. Clicking it SHALL open a PIN modal that validates only the PIN's format client-side (exactly 4 numeric digits, `/^\d{4}$/`) — malformed input shows an inline error and does not submit. The system SHALL NOT compare the entered PIN against any hardcoded or mock value; any well-formed PIN SHALL be submitted to the backend via `useFirmarCierre().mutate({ id: qe.id, data: { rol: 'JEFE_CALIDAD_SYST', pin } })`, invoking `PATCH /api/quality-events/:id/firmar-cierre`. The backend is the sole source of truth for whether the PIN is correct — an incorrect PIN SHALL surface as a toast error sourced from the backend's 401 response (via `useFirmarCierre`'s existing `onError`), and the modal SHALL remain open for retry.

#### Scenario: Button hidden before resultadoCierre is set
- **WHEN** `qe.resultadoCierre` is undefined
- **THEN** the "Firmar como Jefe de Calidad" button is not rendered

#### Scenario: Button hidden once already signed
- **WHEN** `qe.cerradoPorId` is already set
- **THEN** the "Firmar como Jefe de Calidad" button is not rendered

#### Scenario: Malformed PIN blocks submission client-side
- **WHEN** the user enters a value that is not exactly 4 numeric digits (e.g. `12`, `12a4`, empty) and confirms
- **THEN** an inline format error is shown and `useFirmarCierre().mutate` is not called

#### Scenario: Any well-formed PIN is submitted to the backend
- **WHEN** the user enters a 4-digit PIN (e.g. `9081`) and confirms
- **THEN** `useFirmarCierre().mutate` is called with `{ id: qe.id, data: { rol: 'JEFE_CALIDAD_SYST', pin: '9081' } }`, regardless of the specific digits entered

#### Scenario: Backend-rejected PIN shows a toast and keeps the modal open
- **WHEN** the backend responds 401 to `PATCH /:id/firmar-cierre` because the PIN is incorrect
- **THEN** a toast error is shown with the backend's message and the PIN modal remains open for the user to retry

---

### Requirement: Second signature role is resolved per the same-user escalation rule
`QECierreSection` SHALL compute the required second-signature role by calling `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada)` (from `qualityEventPermissions.ts`) once `qe.cerradoPorId` is set and `qe.cierreFirmaSupervisorId` is empty, and SHALL render a "Firmar como Supervisor" or "Firmar como Alta Dirección" button (matching the resolved role) visible only to the current user whose own `rol` equals the resolved role. Clicking it SHALL open the same PIN-modal pattern described in "First signature (JEFE_CALIDAD_SYST) via PIN modal" (format-only client-side validation, no hardcoded or mock PIN comparison) and, on a well-formed PIN, call `useFirmarCierre().mutate({ id: qe.id, data: { rol: <resolvedRole>, pin } })`.

#### Scenario: Normal case shows Firmar como Supervisor
- **WHEN** `resolveRolSegundaFirma` returns `'SUPERVISOR'` for the current QE
- **THEN** a "Firmar como Supervisor" button is visible to users with `rol: 'SUPERVISOR'` and not visible to `ALTA_DIRECCION`

#### Scenario: Escalated case shows Firmar como Alta Dirección
- **WHEN** `resolveRolSegundaFirma` returns `'ALTA_DIRECCION'` because the first signer's own fixture record has `rol: 'SUPERVISOR'` and `area === qe.areaAfectada`
- **THEN** a "Firmar como Alta Dirección" button is visible to users with `rol: 'ALTA_DIRECCION'` and not visible to `SUPERVISOR`

#### Scenario: Second signature submits with resolved role
- **WHEN** the resolved role is `'SUPERVISOR'` and that user enters a well-formed 4-digit PIN and confirms
- **THEN** `useFirmarCierre().mutate` is called with `{ id: qe.id, data: { rol: 'SUPERVISOR', pin: <entered value> } }`, and an incorrect PIN surfaces as a toast error from the backend's 401 response without closing the QE
