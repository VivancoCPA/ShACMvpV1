# Spec: quality-event-cierre

## Purpose

`QECierreSection` component covering the `PENDIENTE_CIERRE` closure form, dual electronic signature (Jefe de Calidad + Supervisor, with the same-user/`ALTA_DIRECCION` escalation rule per RN-QE-004), and the `CERRADO` summary display; the `/cerrar` and `/firmar-cierre` MSW endpoints; and the auto-transition into `PENDIENTE_CIERRE`.

---

## Requirements

### Requirement: QECierreSection renders only for PENDIENTE_CIERRE and CERRADO
The system SHALL render a `QECierreSection` component at `src/features/quality-events/components/QECierreSection.tsx` that receives the loaded `QualityEvent` as a prop. It SHALL render its closure-form-and-signature content when `qe.estado === 'PENDIENTE_CIERRE'`, its closure-summary content when `qe.estado === 'CERRADO'` (and beyond, for QEs that have since advanced to `EN_VERIFICACION`, `VERIFICADO`, or been reopened), and `null` for any other `qe.estado`.

#### Scenario: Section hidden in ABIERTO
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'ABIERTO'`
- **THEN** the component renders `null`

#### Scenario: Closure form shown in PENDIENTE_CIERRE
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'PENDIENTE_CIERRE'`
- **THEN** the closure form and/or signature controls are visible

#### Scenario: Closure summary shown from CERRADO onward
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'CERRADO'`, `'EN_VERIFICACION'`, or `'VERIFICADO'`
- **THEN** the closure summary (fecha de cierre, resultado, plazo) is visible

---

### Requirement: Closure form validates resultadoCierre and plazoVerificacionDias
`QECierreSection` SHALL render, while `qe.estado === 'PENDIENTE_CIERRE'` and `qe.resultadoCierre` is not yet set, a form with a `resultadoCierre` textarea (validated by `qualityEventCierreFormSchema`: 100–500 characters, required) and a `plazoVerificacionDias` control offering `30`, `60`, `90`, or a custom positive-integer value, defaulting to `60`. The form SHALL be visible only to role `JEFE_CALIDAD_SYST`. Submitting a valid form SHALL call `useCerrarQE().mutate({ id: qe.id, data: { resultadoCierre, plazoVerificacionDias } })`, invoking `PATCH /api/quality-events/:id/cerrar`.

#### Scenario: Form hidden for other roles
- **WHEN** `QECierreSection` renders for a `QualityEvent` in `PENDIENTE_CIERRE` with role `SUPERVISOR`
- **THEN** the closure form is not rendered

#### Scenario: resultadoCierre under 100 characters blocks submission
- **WHEN** `JEFE_CALIDAD_SYST` enters a `resultadoCierre` of 50 characters and submits
- **THEN** a validation error is shown and `useCerrarQE().mutate` is not called

#### Scenario: Valid submission calls the cerrar mutation
- **WHEN** `JEFE_CALIDAD_SYST` enters a valid `resultadoCierre` (150 characters) with `plazoVerificacionDias: 90` and submits
- **THEN** `useCerrarQE().mutate` is called with `{ id: qe.id, data: { resultadoCierre, plazoVerificacionDias: 90 } }`

#### Scenario: plazoVerificacionDias defaults to 60
- **WHEN** the closure form is rendered with no prior selection
- **THEN** the `plazoVerificacionDias` control's initial value is `60`

#### Scenario: Form hidden once resultadoCierre is already set
- **WHEN** `QECierreSection` renders for a `QualityEvent` in `PENDIENTE_CIERRE` with `resultadoCierre` already set
- **THEN** the closure form is not rendered and the signature controls (see below) are shown instead

---

### Requirement: PATCH /api/quality-events/:id/cerrar records the closure form
The system SHALL register `PATCH /api/quality-events/:id/cerrar` in `src/mocks/handlers/quality-events.handlers.ts`. It SHALL accept `{ resultadoCierre, plazoVerificacionDias }`, validate both are present, set them on the matching QE (without changing `estado`), and append a `QEAuditTrailEntry` with `accion: 'CIERRE_INICIADO'`. Unknown `:id` SHALL return 404. A QE not in `PENDIENTE_CIERRE` SHALL return 422.

#### Scenario: Valid request records the closure form fields
- **WHEN** `PATCH /api/quality-events/qe-2026-005/cerrar` is requested with `{ resultadoCierre: '<150 chars>', plazoVerificacionDias: 90 }` for a QE in `PENDIENTE_CIERRE`
- **THEN** the response is 200, `data.resultadoCierre` and `data.plazoVerificacionDias` match the request, and `data.estado` is still `'PENDIENTE_CIERRE'`

#### Scenario: Wrong estado returns 422
- **WHEN** `PATCH /api/quality-events/:id/cerrar` is requested for a QE in `EN_EJECUCION`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/cerrar` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: First signature (JEFE_CALIDAD_SYST) via PIN modal
`QECierreSection` SHALL render a "Firmar como Jefe de Calidad" button visible only to role `JEFE_CALIDAD_SYST` when `qe.resultadoCierre` is set and `qe.cerradoPorId` is empty. Clicking it SHALL open a PIN modal reusing the pattern established by `QEInvestigationSection`'s causa-raíz approval (mock PIN `1234`, wrong PIN shows an inline error and does not submit). On correct PIN, the system SHALL call `useFirmarCierre().mutate({ id: qe.id, data: { rol: 'JEFE_CALIDAD_SYST', pin } })`, invoking `PATCH /api/quality-events/:id/firmar-cierre`.

#### Scenario: Button hidden before resultadoCierre is set
- **WHEN** `qe.resultadoCierre` is undefined
- **THEN** the "Firmar como Jefe de Calidad" button is not rendered

#### Scenario: Button hidden once already signed
- **WHEN** `qe.cerradoPorId` is already set
- **THEN** the "Firmar como Jefe de Calidad" button is not rendered

#### Scenario: Wrong PIN blocks submission
- **WHEN** the user enters `0000` in the PIN modal and confirms
- **THEN** an error is shown and `useFirmarCierre().mutate` is not called

#### Scenario: Correct PIN calls the firmar-cierre mutation
- **WHEN** the user enters `1234` and confirms
- **THEN** `useFirmarCierre().mutate` is called with `{ id: qe.id, data: { rol: 'JEFE_CALIDAD_SYST', pin: '1234' } }`

---

### Requirement: Second signature role is resolved per the same-user escalation rule
`QECierreSection` SHALL compute the required second-signature role by calling `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada)` (from `qualityEventPermissions.ts`) once `qe.cerradoPorId` is set and `qe.cierreFirmaSupervisorId` is empty, and SHALL render a "Firmar como Supervisor" or "Firmar como Alta Dirección" button (matching the resolved role) visible only to the current user whose own `rol` equals the resolved role. Clicking it SHALL open the same PIN-modal pattern and, on correct PIN, call `useFirmarCierre().mutate({ id: qe.id, data: { rol: <resolvedRole>, pin } })`.

#### Scenario: Normal case shows Firmar como Supervisor
- **WHEN** `resolveRolSegundaFirma` returns `'SUPERVISOR'` for the current QE
- **THEN** a "Firmar como Supervisor" button is visible to users with `rol: 'SUPERVISOR'` and not visible to `ALTA_DIRECCION`

#### Scenario: Escalated case shows Firmar como Alta Dirección
- **WHEN** `resolveRolSegundaFirma` returns `'ALTA_DIRECCION'` because the first signer's own fixture record has `rol: 'SUPERVISOR'` and `area === qe.areaAfectada`
- **THEN** a "Firmar como Alta Dirección" button is visible to users with `rol: 'ALTA_DIRECCION'` and not visible to `SUPERVISOR`

#### Scenario: Second signature confirms with resolved role
- **WHEN** the resolved role is `'ALTA_DIRECCION'` and that user enters `1234` and confirms
- **THEN** `useFirmarCierre().mutate` is called with `{ id: qe.id, data: { rol: 'ALTA_DIRECCION', pin: '1234' } }`

---

### Requirement: resolveRolSegundaFirma escalation helper
The system SHALL export a pure function `resolveRolSegundaFirma(primerFirmanteId: string, areaAfectada: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` from `src/features/quality-events/utils/qualityEventPermissions.ts`. It SHALL look up the user matching `primerFirmanteId` (via the shared user fixtures) and return `'ALTA_DIRECCION'` if and only if that user's own `rol` is `'SUPERVISOR'` and their `area` equals `areaAfectada`. In all other cases, including when the user cannot be found, it SHALL return `'SUPERVISOR'`.

#### Scenario: Returns SUPERVISOR for the normal case
- **WHEN** `resolveRolSegundaFirma('user-005', 'Calidad')` is called and `user-005` has `rol: 'JEFE_CALIDAD_SYST'`
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Returns ALTA_DIRECCION when the first signer doubles as the area's supervisor
- **WHEN** `resolveRolSegundaFirma('user-999', 'Operaciones')` is called and `user-999` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'ALTA_DIRECCION'`

#### Scenario: Returns SUPERVISOR when the first signer is SUPERVISOR of a different area
- **WHEN** `resolveRolSegundaFirma('user-003', 'Almacén Norte')` is called and `user-003` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'SUPERVISOR'`

---

### Requirement: PATCH /api/quality-events/:id/firmar-cierre validates signature order and transitions to CERRADO
The system SHALL register `PATCH /api/quality-events/:id/firmar-cierre` accepting `{ rol, pin }`. It SHALL reject (422, `success: false`, message tagged `QE-AC-006`) any request where: `qe.resultadoCierre` is not yet set; `rol === 'JEFE_CALIDAD_SYST'` but `qe.cerradoPorId` is already set; or `rol` is `'SUPERVISOR'`/`'ALTA_DIRECCION'` but `qe.cerradoPorId` is empty (second signature attempted before the first). On a valid first signature (`rol: 'JEFE_CALIDAD_SYST'`, `cerradoPorId` empty), it SHALL set `cerradoPorId` and append an audit entry, without changing `estado`. On a valid second signature (`rol` matching `resolveRolSegundaFirma`, `cierreFirmaSupervisorId` empty), it SHALL set `cierreFirmaSupervisorId`, `cierreFirmaSupervisorRol: rol`, transition `estado → 'CERRADO'`, stamp `fechaCierre` to the current timestamp, compute `fechaVerificacionProgramada` as `fechaCierre` plus `plazoVerificacionDias` days, and append two audit entries (the signature, then the `CERRADO` transition). On the transition to `CERRADO`, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) for the QE's original `reportadoPorId`, excluding the signing user, and additionally for every resolvable user with role `ALTA_DIRECCION` when `qe.severidad` is `'ALTA'` or `'CRITICA'`.

#### Scenario: Attempting the second signature before the first is rejected with QE-AC-006
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'SUPERVISOR', pin: '1234' }` and `qe.cerradoPorId` is empty
- **THEN** the response status is 422, `success: false`, and the message references `QE-AC-006`

#### Scenario: First signature does not change estado
- **WHEN** the first valid signature (`rol: 'JEFE_CALIDAD_SYST'`) is submitted
- **THEN** the response is 200 with `data.cerradoPorId` set and `data.estado` still `'PENDIENTE_CIERRE'`

#### Scenario: Second signature transitions to CERRADO and computes fechaVerificacionProgramada
- **WHEN** the second valid signature is submitted for a QE with `plazoVerificacionDias: 60` and `cerradoPorId` already set
- **THEN** the response is 200 with `data.estado === 'CERRADO'`, `data.fechaCierre` set, and `data.fechaVerificacionProgramada` equal to `fechaCierre` + 60 days

#### Scenario: Duplicate first signature rejected
- **WHEN** `rol: 'JEFE_CALIDAD_SYST'` is submitted again after `cerradoPorId` is already set
- **THEN** the response status is 422 and `success: false`

#### Scenario: CERRADO transition notifies the original reporter with a real notification
- **WHEN** the second signature transitions a QE to `CERRADO` and the signing user is not the QE's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to `qe.reportadoPorId`

#### Scenario: CRITICA/ALTA severity additionally notifies Gerencia
- **WHEN** the second signature transitions a QE with `severidad: 'CRITICA'` to `CERRADO`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable user with role `ALTA_DIRECCION`

---

### Requirement: CERRADO closure summary in QECierreSection
Once `qe.estado` is `CERRADO` or later, `QECierreSection` SHALL display `resultadoCierre` (read-only), `plazoVerificacionDias`, and `fechaCierre` (formatted via `Intl.DateTimeFormat`). The header-level display of these fields plus the verification countdown is covered by `quality-event-detail-page`'s `QEHeaderSection` requirement.

#### Scenario: Closure summary visible in CERRADO
- **WHEN** `QECierreSection` renders a `QualityEvent` with `estado: 'CERRADO'`, `resultadoCierre: 'Texto de cierre...'`, `fechaCierre: '2026-06-01T10:00:00Z'`
- **THEN** the resultado, plazo, and formatted fecha de cierre are all visible

---

### Requirement: CERRADO transition notifies Gerencia and the original reporter
When the second signature transitions a QE to `CERRADO`, the client SHALL show a Sonner success toast to the signing user confirming the closure. The delivery of information to Gerencia (for `ALTA`/`CRITICA` severity) and to the original reporter SHALL happen via the real, persisted `CAMBIO_ESTADO` notifications created by the `PATCH /api/quality-events/:id/firmar-cierre` handler (see above) — the signer's own toast SHALL NOT claim those other parties were notified, since the signer's session has no way to confirm cross-session delivery.

#### Scenario: Standard closure toast confirms only the signer's own action
- **WHEN** the second signature succeeds for a QE with `severidad: 'MEDIA'`
- **THEN** a success toast confirming the closure is shown to the signer, with no claim about other parties being notified

#### Scenario: CRITICA closure toast does not claim Gerencia was notified
- **WHEN** the second signature succeeds for a QE with `severidad: 'CRITICA'`
- **THEN** the signer's toast confirms the closure but does not itself assert Gerencia was notified — that is instead verifiable via a real notification created for `ALTA_DIRECCION` users
