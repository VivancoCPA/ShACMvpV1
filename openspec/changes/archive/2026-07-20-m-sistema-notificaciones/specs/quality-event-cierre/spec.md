## MODIFIED Requirements

### Requirement: PATCH /api/quality-events/:id/firmar-cierre validates signature order and transitions to CERRADO
The system SHALL register `PATCH /api/quality-events/:id/firmar-cierre` accepting `{ rol, pin }`. It SHALL reject (422, `success: false`, message tagged `QE-AC-006`) any request where: `qe.resultadoCierre` is not yet set; `rol === 'JEFE_CALIDAD_SYST'` but `qe.cerradoPorId` is already set; or `rol` is `'SUPERVISOR'`/`'ALTA_DIRECCION'` but `qe.cerradoPorId` is empty (second signature attempted before the first). On a valid first signature (`rol: 'JEFE_CALIDAD_SYST'`, `cerradoPorId` empty), it SHALL set `cerradoPorId` and append an audit entry, without changing `estado`. On a valid second signature (`rol` matching `resolveRolSegundaFirma`, `cierreFirmaSupervisorId` empty), it SHALL set `cierreFirmaSupervisorId`, `cierreFirmaSupervisorRol: rol`, transition `estado → 'CERRADO'`, stamp `fechaCierre` to the current timestamp, compute `fechaVerificacionProgramada` as `fechaCierre` plus `plazoVerificacionDias` days, and append two audit entries (the signature, then the `CERRADO` transition). On the transition to `CERRADO`, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) for the QE's original `reportadoPorId`, excluding the signing user, and additionally for every resolvable user with role `ALTA_DIRECCION` when `qe.severidad` is `'ALTA'` or `'CRITICA'`.

#### Scenario: First signature accepted, second rejected before first
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'SUPERVISOR', pin: '1234' }` and `qe.cerradoPorId` is empty
- **THEN** the response status is 422 with a `QE-AC-006` tagged message

#### Scenario: Second valid signature transitions to CERRADO and stamps dates
- **WHEN** the first signature has already been recorded and a valid second signature is submitted
- **THEN** `estado` becomes `'CERRADO'`, `fechaCierre` and `fechaVerificacionProgramada` are set, and two audit entries are appended

#### Scenario: CERRADO transition notifies the original reporter with a real notification
- **WHEN** the second signature transitions a QE to `CERRADO` and the signing user is not the QE's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to `qe.reportadoPorId`

#### Scenario: CRITICA/ALTA severity additionally notifies Gerencia
- **WHEN** the second signature transitions a QE with `severidad: 'CRITICA'` to `CERRADO`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable user with role `ALTA_DIRECCION`

### Requirement: CERRADO transition notifies Gerencia and the original reporter
When the second signature transitions a QE to `CERRADO`, the client SHALL show a Sonner success toast to the signing user confirming the closure. The delivery of information to Gerencia (for `ALTA`/`CRITICA` severity) and to the original reporter SHALL happen via the real, persisted `CAMBIO_ESTADO` notifications created by the `PATCH /api/quality-events/:id/firmar-cierre` handler (see above) — the signer's own toast SHALL NOT claim those other parties were notified, since the signer's session has no way to confirm cross-session delivery.

#### Scenario: Standard closure toast confirms only the signer's own action
- **WHEN** the second signature succeeds for a QE with `severidad: 'MEDIA'`
- **THEN** a success toast confirming the closure is shown to the signer, with no claim about other parties being notified

#### Scenario: CRITICA closure toast does not claim Gerencia was notified
- **WHEN** the second signature succeeds for a QE with `severidad: 'CRITICA'`
- **THEN** the signer's toast confirms the closure but does not itself assert Gerencia was notified — that is instead verifiable via a real notification created for `ALTA_DIRECCION` users
