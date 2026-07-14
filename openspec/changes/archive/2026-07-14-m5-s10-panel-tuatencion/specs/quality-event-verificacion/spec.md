## MODIFIED Requirements

### Requirement: Dev-only control forces the CERRADO to EN_VERIFICACION transition
`QEVerificacionSection` SHALL render a "Forzar vencimiento" button while `qe.estado === 'CERRADO'`, visible only when `import.meta.env.DEV` is true. Alongside the button, while `qe.estado === 'CERRADO'`, it SHALL render a required `auditorAsignadoId` select populated with users whose `rol === 'AUDITOR_INTERNO'`; the button SHALL be disabled until a value is selected. Clicking it SHALL call `useForzarVencimientoVerificacion().mutate({ id: qe.id, auditorAsignadoId })`, invoking `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, which SHALL transition the QE to `EN_VERIFICACION`, persist `auditorAsignadoId` on the QE, and create a verification task notification for `JEFE_CALIDAD_SYST`.

#### Scenario: Button hidden outside dev mode
- **WHEN** `import.meta.env.DEV` is `false` and `qe.estado === 'CERRADO'`
- **THEN** the "Forzar vencimiento" button is not rendered

#### Scenario: Button disabled until an auditor is selected
- **WHEN** `qe.estado === 'CERRADO'` and the `auditorAsignadoId` select has no value chosen
- **THEN** the "Forzar vencimiento" button is disabled

#### Scenario: Forcing from CERRADO transitions to EN_VERIFICACION and persists the auditor
- **WHEN** the dev user selects an `AUDITOR_INTERNO` user and clicks "Forzar vencimiento" for a QE in `CERRADO`
- **THEN** `useForzarVencimientoVerificacion().mutate` is called with the selected `auditorAsignadoId` and, on success, the QE's `estado` becomes `'EN_VERIFICACION'` with `auditorAsignadoId` set to the selected user's id

---

### Requirement: REG-EFEC-001 form validates resultado and evidencia
`QEVerificacionSection` SHALL render, while `qe.estado === 'EN_VERIFICACION'`, a form with a `resultado` control (`'EFECTIVO' | 'NO_EFECTIVO'`, required) and an `evidencia` textarea (validated by `verificacionEficaciaSchema`: non-empty, required). The form SHALL be visible only to role `JEFE_CALIDAD_SYST`, or to `AUDITOR_INTERNO` when `esResponsable` is true. `esResponsable` SHALL be computed as `user?.id === qe.auditorAsignadoId` (never hardcoded to `false`) when calling `getQualityEventPermissions(qe.estado, user.rol, esResponsable)`. Submitting SHALL call `useVerificacionEficacia().mutate({ id: qe.id, data: { resultado, evidencia } })`, invoking `POST /api/quality-events/:id/verificacion-eficacia`.

#### Scenario: Form hidden for non-responsible AUDITOR_INTERNO
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` in `EN_VERIFICACION` with role `AUDITOR_INTERNO` and `qe.auditorAsignadoId` different from `user.id`
- **THEN** the REG-EFEC-001 form is not rendered

#### Scenario: Form shown for the assigned AUDITOR_INTERNO
- **WHEN** `QEVerificacionSection` renders for a `QualityEvent` in `EN_VERIFICACION` with role `AUDITOR_INTERNO` and `qe.auditorAsignadoId === user.id`
- **THEN** the REG-EFEC-001 form is rendered

#### Scenario: Empty evidencia blocks submission
- **WHEN** `JEFE_CALIDAD_SYST` selects `resultado: 'EFECTIVO'`, leaves `evidencia` empty, and submits
- **THEN** a validation error is shown and `useVerificacionEficacia().mutate` is not called

#### Scenario: Valid EFECTIVO submission calls the mutation
- **WHEN** `JEFE_CALIDAD_SYST` selects `resultado: 'EFECTIVO'`, enters non-empty `evidencia`, and submits
- **THEN** `useVerificacionEficacia().mutate` is called with `{ id: qe.id, data: { resultado: 'EFECTIVO', evidencia } }`
