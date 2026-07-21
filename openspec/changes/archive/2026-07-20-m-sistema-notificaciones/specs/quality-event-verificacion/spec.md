## MODIFIED Requirements

### Requirement: Dev-only control forces the CERRADO to EN_VERIFICACION transition
`QEVerificacionSection` SHALL render a "Forzar vencimiento" button while `qe.estado === 'CERRADO'`, visible only when `import.meta.env.DEV` is true. Alongside the button, while `qe.estado === 'CERRADO'`, it SHALL render a required `auditorAsignadoId` select populated with users whose `rol === 'AUDITOR_INTERNO'`; the button SHALL be disabled until a value is selected. Clicking it SHALL call `useForzarVencimientoVerificacion().mutate({ id: qe.id, auditorAsignadoId })`, invoking `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, which SHALL transition the QE to `EN_VERIFICACION`, persist `auditorAsignadoId` on the QE, and create a real, persisted `ASIGNACION` notification (via `createAsignacionNotification`) for the selected `auditorAsignadoId` — the verificador who must now act (RN-NOTIF-002), not for `JEFE_CALIDAD_SYST` as an earlier, unimplemented version of this requirement asserted.

#### Scenario: Button hidden outside dev mode
- **WHEN** `import.meta.env.DEV` is `false` and `qe.estado === 'CERRADO'`
- **THEN** the "Forzar vencimiento" button is not rendered

#### Scenario: Button disabled until an auditor is selected
- **WHEN** `qe.estado === 'CERRADO'` and the `auditorAsignadoId` select has no value chosen
- **THEN** the "Forzar vencimiento" button is disabled

#### Scenario: Forcing from CERRADO transitions to EN_VERIFICACION and persists the auditor
- **WHEN** the dev user selects an `AUDITOR_INTERNO` user and clicks "Forzar vencimiento" for a QE in `CERRADO`
- **THEN** `useForzarVencimientoVerificacion().mutate` is called with the selected `auditorAsignadoId` and, on success, the QE's `estado` becomes `'EN_VERIFICACION'` with `auditorAsignadoId` set to the selected user's id

#### Scenario: Assigning the verificador creates a real ASIGNACION notification
- **WHEN** the CERRADO → EN_VERIFICACION transition persists `auditorAsignadoId: 'user-auditor-001'`
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-auditor-001'`

### Requirement: POST /api/quality-events/:id/verificacion-eficacia applies the result
The system SHALL register `POST /api/quality-events/:id/verificacion-eficacia` accepting `{ resultado, evidencia }`. It SHALL reject (422) requests where `qe.estado !== 'EN_VERIFICACION'` or `evidencia` is empty. On `resultado: 'EFECTIVO'`, it SHALL set `resultadoVerificacion: 'EFECTIVO'`, `evidenciaVerificacion`, `verificadoPorId`, `fechaVerificacionRealizada` to now, transition `estado → 'VERIFICADO'`, append an audit entry, and create a `CAMBIO_ESTADO` notification for the QE's `reportadoPorId` (excluding the acting user) plus, when `qe.severidad` is `'ALTA'` or `'CRITICA'`, for every resolvable `ALTA_DIRECCION` user. On `resultado: 'NO_EFECTIVO'`, it SHALL set `resultadoVerificacion: 'NO_EFECTIVO'`, `evidenciaVerificacion`, `fechaVerificacionRealizada` to now, increment `ciclo` by 1, transition `estado → 'EN_INVESTIGACION'`, append two audit entries (the verification result, then a `'REABIERTO'` entry with motive `NO_EFECTIVO`), and create a `CAMBIO_ESTADO` notification for every resolvable user with role `ALTA_DIRECCION` or `JEFE_CALIDAD_SYST`, plus the area's `SUPERVISOR` (resolved via `areasAsignadas` including the QE's `areaAfectada`, per the existing Supervisor-area convention), plus the original `reportadoPorId`, all excluding the acting user. Unknown `:id` SHALL return 404.

#### Scenario: EFECTIVO result transitions to VERIFICADO
- **WHEN** `POST /api/quality-events/qe-2026-005/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: 'Sin recurrencias en 60 días' }` for a QE in `EN_VERIFICACION`
- **THEN** the response has `estado: 'VERIFICADO'` and `resultadoVerificacion: 'EFECTIVO'`

#### Scenario: NO_EFECTIVO result reopens and increments ciclo
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'NO_EFECTIVO', evidencia: 'Recurrencia detectada' }` for a QE with `ciclo: 1` in `EN_VERIFICACION`
- **THEN** the response has `estado: 'EN_INVESTIGACION'` and `ciclo: 2`, with a `'REABIERTO'` audit entry

#### Scenario: Empty evidencia rejects with 422
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: '' }`
- **THEN** the response status is 422

#### Scenario: Wrong estado rejects with 422
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested for a QE in `CERRADO`
- **THEN** the response status is 422

#### Scenario: VERIFICADO notifies the original reporter with a real notification
- **WHEN** a QE transitions to `VERIFICADO` and the acting user is not `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to `qe.reportadoPorId`

#### Scenario: NO_EFECTIVO reapertura notifies Gerencia, Jefe Calidad, and the area Supervisor
- **WHEN** a QE reopens due to `NO_EFECTIVO`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable `ALTA_DIRECCION` user, every resolvable `JEFE_CALIDAD_SYST` user, and every `SUPERVISOR` whose `areasAsignadas` includes the QE's `areaAfectada`

### Requirement: Dev-only control forces the EN_VERIFICACION plazo-vencido reapertura
While `qe.estado === 'EN_VERIFICACION'`, `QEVerificacionSection` SHALL render the same "Forzar vencimiento" control (gated by `import.meta.env.DEV`) calling `useForzarVencimientoVerificacion().mutate({ id: qe.id })`. `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` SHALL, for a QE in `EN_VERIFICACION`, apply the RN-QE-008 vencimiento path: increment `ciclo`, transition `estado → 'EN_INVESTIGACION'`, append audit entries for the verification-task timeout and a `'REABIERTO'` entry with motive `VENCIMIENTO_PLAZO`, and create the same escalation `CAMBIO_ESTADO` notifications (Gerencia, `JEFE_CALIDAD_SYST`, area `SUPERVISOR`, original reporter) as the `NO_EFECTIVO` reapertura path, since both represent RN-QE-008-style forced reopenings.

#### Scenario: Forcing from EN_VERIFICACION reopens with vencimiento motive
- **WHEN** the dev user clicks "Forzar vencimiento" for a QE in `EN_VERIFICACION` with `ciclo: 2`
- **THEN** the response has `estado: 'EN_INVESTIGACION'`, `ciclo: 3`, and the audit trail's newest entry records motive `VENCIMIENTO_PLAZO`

#### Scenario: Forcing on an invalid estado returns 422
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` is requested for a QE in `ABIERTO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Forced vencimiento reapertura creates the same escalation notifications as NO_EFECTIVO
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` reopens a QE from `EN_VERIFICACION`
- **THEN** `CAMBIO_ESTADO` notifications are created for resolvable `ALTA_DIRECCION`, `JEFE_CALIDAD_SYST`, and area `SUPERVISOR` users, plus the original reporter

### Requirement: VERIFICADO and reapertura notify Gerencia, Jefe Calidad, Supervisor, and the reporter
On `resultado: 'EFECTIVO'`, the client SHALL show a success toast confirming verification to the acting user. On any reapertura (`NO_EFECTIVO` or forced vencimiento), the client SHALL show a toast confirming the reapertura to the acting user. The delivery of information to the reporter, Gerencia, Jefe de Calidad, and the area Supervisor SHALL happen via the real, persisted `CAMBIO_ESTADO` notifications created by the handlers above — the acting user's own toast SHALL NOT claim those other parties were notified.

#### Scenario: VERIFICADO toast confirms only the acting user's own action
- **WHEN** a QE transitions to `VERIFICADO`
- **THEN** a success toast is shown to the acting user confirming the verification, without asserting the reporter was notified

#### Scenario: Reapertura toast does not claim an escalation was delivered
- **WHEN** a QE reopens due to `NO_EFECTIVO` or forced vencimiento
- **THEN** a toast confirms the reapertura to the acting user but does not itself assert Gerencia/Jefe de Calidad/Supervisor were notified — that is instead verifiable via the real notifications created for those users
