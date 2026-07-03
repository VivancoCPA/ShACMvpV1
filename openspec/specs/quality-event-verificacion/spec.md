# Spec: quality-event-verificacion

## Purpose

`QEVerificacionSection` component covering the REG-EFEC-001 effectiveness-verification form, the dev-only vencimiento-forcing control, and the `VERIFICADO`/reapertura outcomes; the `/verificacion-eficacia` and `/forzar-vencimiento-verificacion` MSW endpoints.

Reapertura (RN-QE-007/008) never persists `'REABIERTO'` as `qe.estado` — it sets `estado: 'EN_INVESTIGACION'` directly so root-cause analysis can be redone, increments `ciclo`, and preserves the full prior-cycle history. `'REABIERTO'` survives only as an audit-trail `accion`/motivo label (see `quality-event-types`).

---

## Requirements

### Requirement: QEVerificacionSection renders only from CERRADO onward
The system SHALL render a `QEVerificacionSection` component at `src/features/quality-events/components/QEVerificacionSection.tsx` that receives the loaded `QualityEvent` as a prop. It SHALL render dev-only forcing content while `qe.estado === 'CERRADO'`, the REG-EFEC-001 form and forcing content while `qe.estado === 'EN_VERIFICACION'`, a verified summary while `qe.estado === 'VERIFICADO'`, and `null` for any other `qe.estado`.

#### Scenario: Section hidden before CERRADO
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` with `estado: 'PENDIENTE_CIERRE'`
- **THEN** the component renders `null`

#### Scenario: REG-EFEC-001 form shown in EN_VERIFICACION
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` with `estado: 'EN_VERIFICACION'`
- **THEN** the effectiveness-verification form is visible

#### Scenario: Verified summary shown in VERIFICADO
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` with `estado: 'VERIFICADO'`
- **THEN** a summary showing the verification result is visible and the form is not rendered

---

### Requirement: Dev-only control forces the CERRADO to EN_VERIFICACION transition
`QEVerificacionSection` SHALL render a "Forzar vencimiento" button while `qe.estado === 'CERRADO'`, visible only when `import.meta.env.DEV` is true. Clicking it SHALL call `useForzarVencimientoVerificacion().mutate({ id: qe.id })`, invoking `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, which SHALL transition the QE to `EN_VERIFICACION` and create a verification task notification for `JEFE_CALIDAD_SYST`.

#### Scenario: Button hidden outside dev mode
- **WHEN** `import.meta.env.DEV` is `false` and `qe.estado === 'CERRADO'`
- **THEN** the "Forzar vencimiento" button is not rendered

#### Scenario: Forcing from CERRADO transitions to EN_VERIFICACION
- **WHEN** the dev user clicks "Forzar vencimiento" for a QE in `CERRADO`
- **THEN** `useForzarVencimientoVerificacion().mutate` is called and, on success, the QE's `estado` becomes `'EN_VERIFICACION'`

---

### Requirement: REG-EFEC-001 form validates resultado and evidencia
`QEVerificacionSection` SHALL render, while `qe.estado === 'EN_VERIFICACION'`, a form with a `resultado` control (`'EFECTIVO' | 'NO_EFECTIVO'`, required) and an `evidencia` textarea (validated by `verificacionEficaciaSchema`: non-empty, required). The form SHALL be visible only to role `JEFE_CALIDAD_SYST`, or to `AUDITOR_INTERNO` when `esResponsable` is true (per the existing `puedeVerificar` permission). Submitting SHALL call `useVerificacionEficacia().mutate({ id: qe.id, data: { resultado, evidencia } })`, invoking `POST /api/quality-events/:id/verificacion-eficacia`.

#### Scenario: Form hidden for non-responsible AUDITOR_INTERNO
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` in `EN_VERIFICACION` with role `AUDITOR_INTERNO` and `esResponsable: false`
- **THEN** the REG-EFEC-001 form is not rendered

#### Scenario: Empty evidencia blocks submission
- **WHEN** `JEFE_CALIDAD_SYST` selects `resultado: 'EFECTIVO'`, leaves `evidencia` empty, and submits
- **THEN** a validation error is shown and `useVerificacionEficacia().mutate` is not called

#### Scenario: Valid EFECTIVO submission calls the mutation
- **WHEN** `JEFE_CALIDAD_SYST` selects `resultado: 'EFECTIVO'`, enters non-empty `evidencia`, and submits
- **THEN** `useVerificacionEficacia().mutate` is called with `{ id: qe.id, data: { resultado: 'EFECTIVO', evidencia } }`

---

### Requirement: POST /api/quality-events/:id/verificacion-eficacia applies the result
The system SHALL register `POST /api/quality-events/:id/verificacion-eficacia` accepting `{ resultado, evidencia }`. It SHALL reject (422) requests where `qe.estado !== 'EN_VERIFICACION'` or `evidencia` is empty. On `resultado: 'EFECTIVO'`, it SHALL set `resultadoVerificacion: 'EFECTIVO'`, `evidenciaVerificacion`, `verificadoPorId`, `fechaVerificacionRealizada` to now, transition `estado → 'VERIFICADO'`, and append an audit entry. On `resultado: 'NO_EFECTIVO'`, it SHALL set `resultadoVerificacion: 'NO_EFECTIVO'`, `evidenciaVerificacion`, `fechaVerificacionRealizada` to now, increment `ciclo` by 1, transition `estado → 'EN_INVESTIGACION'`, and append two audit entries: the verification result, then a `'REABIERTO'` entry with motive `NO_EFECTIVO`. Unknown `:id` SHALL return 404.

#### Scenario: EFECTIVO result transitions to VERIFICADO
- **WHEN** `POST /api/quality-events/qe-2026-005/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: 'Sin recurrencias en 60 días' }` for a QE in `EN_VERIFICACION`
- **THEN** the response is 200 with `data.estado === 'VERIFICADO'` and `data.resultadoVerificacion === 'EFECTIVO'`

#### Scenario: NO_EFECTIVO result reopens and increments ciclo
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'NO_EFECTIVO', evidencia: 'Recurrencia detectada' }` for a QE with `ciclo: 1` in `EN_VERIFICACION`
- **THEN** the response is 200 with `data.estado === 'EN_INVESTIGACION'` and `data.ciclo === 2`

#### Scenario: Empty evidencia rejected
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: '' }`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong estado rejected
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested for a QE in `CERRADO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Reopened QE preserves prior-cycle history
- **WHEN** a `NO_EFECTIVO` result reopens a QE
- **THEN** the response's `data.accionesCorrectivas`, `data.cincoPorques`/`data.ishikawa`, and `data.auditTrail` from the prior cycle remain intact (no fields are cleared)

---

### Requirement: Dev-only control forces the EN_VERIFICACION plazo-vencido reapertura
While `qe.estado === 'EN_VERIFICACION'`, `QEVerificacionSection` SHALL render the same "Forzar vencimiento" control (gated by `import.meta.env.DEV`) calling `useForzarVencimientoVerificacion().mutate({ id: qe.id })`. `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` SHALL, for a QE in `EN_VERIFICACION`, apply the RN-QE-008 vencimiento path: increment `ciclo`, transition `estado → 'EN_INVESTIGACION'`, and append audit entries for the verification-task timeout and a `'REABIERTO'` entry with motive `VENCIMIENTO_PLAZO`.

#### Scenario: Forcing from EN_VERIFICACION reopens with vencimiento motive
- **WHEN** the dev user clicks "Forzar vencimiento" for a QE in `EN_VERIFICACION` with `ciclo: 2`
- **THEN** the response has `estado: 'EN_INVESTIGACION'`, `ciclo: 3`, and the audit trail's newest entry records motive `VENCIMIENTO_PLAZO`

#### Scenario: Forcing on an invalid estado returns 422
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` is requested for a QE in `ABIERTO`
- **THEN** the response status is 422 and `success: false`

---

### Requirement: VERIFICADO and reapertura notify Gerencia, Jefe Calidad, Supervisor, and the reporter
On `resultado: 'EFECTIVO'`, the client SHALL show a success toast and, per the existing severity-notification convention, an additional toast when `qe.severidad` is `'ALTA'` or `'CRITICA'` indicating Gerencia was notified, plus a toast indicating the original reporter was notified. On any reapertura (`NO_EFECTIVO` or forced vencimiento), the client SHALL show toasts indicating Gerencia, `JEFE_CALIDAD_SYST`, and the area's `SUPERVISOR` were notified (escalation).

#### Scenario: VERIFICADO notifies the reporter
- **WHEN** a QE transitions to `VERIFICADO`
- **THEN** a toast indicating the original reporter was notified is shown

#### Scenario: Reapertura shows an escalation toast
- **WHEN** a QE reopens due to `NO_EFECTIVO` or forced vencimiento
- **THEN** a toast indicating Gerencia, Jefe de Calidad, and Supervisor were notified is shown
