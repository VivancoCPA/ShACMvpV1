# Spec: quality-event-cierre

## Purpose

`QECierreSection` component covering the `PENDIENTE_CIERRE` closure form, dual electronic signature (Jefe de Calidad + Supervisor, with the same-user/`ALTA_DIRECCION` escalation rule per RN-QE-004), and the `CERRADO` summary display; the `/cerrar` and `/firmar-cierre` MSW endpoints; and the auto-transition into `PENDIENTE_CIERRE`.

---

## Requirements

### Requirement: QECierreSection renders only for PENDIENTE_CIERRE and CERRADO
The system SHALL render a `QECierreSection` component at `src/features/quality-events/components/QECierreSection.tsx` that receives the loaded `QualityEvent` as a prop. It SHALL render its closure-form-and-signature content when `qe.estado === 'PENDIENTE_CIERRE'`, its closure-summary content when `qe.estado === 'CERRADO'` (and beyond, for QEs that have since advanced to `EN_VERIFICACION`, `VERIFICADO`, or been reopened), and, when `qe.estado === 'EN_EJECUCION'`, only the closure-rejection notice (see "Aviso de cierre rechazado") if it applies. For any other `qe.estado`, or `EN_EJECUCION` without a pending rejection notice, it SHALL render `null`.

#### Scenario: Section hidden in ABIERTO
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'ABIERTO'`
- **THEN** the component renders `null`

#### Scenario: Section hidden in EN_EJECUCION without a rejection
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'EN_EJECUCION'` and no `CIERRE_RECHAZADO` audit entry
- **THEN** the component renders `null`

#### Scenario: Closure form shown in PENDIENTE_CIERRE
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'PENDIENTE_CIERRE'`
- **THEN** the closure form and/or signature controls are visible

#### Scenario: Closure summary shown from CERRADO onward
- **WHEN** `QECierreSection` renders for a `QualityEvent` with `estado: 'CERRADO'`, `'EN_VERIFICACION'`, or `'VERIFICADO'`
- **THEN** the closure summary (fecha de cierre, resultado, plazo) is visible

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
`QECierreSection` SHALL render a "Firmar como Jefe de Calidad" button visible only to role `JEFE_CALIDAD_SYST` when `qe.resultadoCierre` is set and `qe.cerradoPorId` is empty. Clicking it SHALL open a PIN modal (`PinModal`). When the current user's `tienePinFirma` (from `useAuthStore`) is `false`, `PinModal` SHALL NOT render the PIN input — instead it SHALL show a notice (`qualityEvents:detail.cierre.pinModal.noPinConfigured`) with a link to `/perfil`, and the confirm button SHALL be disabled. When `tienePinFirma` is `true`, the modal validates only the PIN's format client-side (exactly 4 numeric digits, `/^\d{4}$/`) — malformed input shows an inline error and does not submit. The system SHALL NOT compare the entered PIN against any hardcoded or mock value; any well-formed PIN SHALL be submitted to the backend via `useFirmarCierre().mutate({ id: qe.id, data: { rol: 'JEFE_CALIDAD_SYST', pin } })`, invoking `PATCH /api/quality-events/:id/firmar-cierre`. The backend is the sole source of truth for whether the PIN is correct. `useFirmarCierre`'s `onError` SHALL distinguish `errorCode === 'PIN_NO_CONFIGURADO'` (switch the modal to the same notice described above, instead of a generic toast) from any other error (toast with the backend's message, as it already does) — an incorrect PIN (401) SHALL surface as a toast error sourced from the backend's response, and the modal SHALL remain open for retry in every error case.

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

#### Scenario: User without a configured PIN sees the setup notice instead of the field
- **WHEN** the current user's `tienePinFirma` is `false` and they open the PIN modal
- **THEN** no PIN input is rendered; instead a notice with a link to `/perfil` is shown, and the confirm button is disabled

#### Scenario: PIN reset mid-session surfaces the same notice
- **WHEN** the backend responds to `PATCH /:id/firmar-cierre` with `errorCode: 'PIN_NO_CONFIGURADO'`
- **THEN** the modal shows the same "no PIN configured" notice with a link to `/perfil`, instead of the generic error toast

---

### Requirement: Second signature role is resolved per the same-user escalation rule
`QECierreSection` SHALL compute the required second-signature role by calling `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId)` once `qe.cerradoPorId` is set and `qe.cierreFirmaSupervisorId` is empty (always `'SUPERVISOR'`). The "Firmar cierre" (second signature) button and the "Rechazar cierre" button SHALL be visible only when the current user's `rol` is `'SUPERVISOR'` **and** the user's id is in `qe.supervisoresArea`. A `SUPERVISOR` not in `qe.supervisoresArea` SHALL instead see the text `qualityEvents:detail.cierre.noEsDelArea` ("Solo los supervisores del área {área} pueden firmar este cierre.") and no buttons. Clicking "Firmar cierre" SHALL open the same `PinModal` described in "First signature (JEFE_CALIDAD_SYST) via PIN modal" — including its "no PIN configured" notice, format-only client-side validation, and `PIN_NO_CONFIGURADO`/401/generic error handling — and, on a well-formed PIN, call `useFirmarCierre().mutate({ id: qe.id, data: { rol: 'SUPERVISOR', pin } })`.

#### Scenario: Area supervisor sees sign and reject buttons
- **WHEN** the current user has `rol: 'SUPERVISOR'` and is listed in `qe.supervisoresArea`, with `cerradoPorId` set
- **THEN** "Firmar cierre" and "Rechazar cierre" are visible

#### Scenario: Supervisor of another area sees the message only
- **WHEN** the current user has `rol: 'SUPERVISOR'` and is not in `qe.supervisoresArea`
- **THEN** the "Solo los supervisores del área…" message is shown and neither button is rendered

#### Scenario: Second signature submits with resolved role
- **WHEN** an area supervisor enters a well-formed 4-digit PIN and confirms
- **THEN** `useFirmarCierre().mutate` is called with `{ id: qe.id, data: { rol: 'SUPERVISOR', pin: <entered value> } }`, and an incorrect PIN surfaces as a toast error from the backend's 401 response without closing the QE

### Requirement: resolveRolSegundaFirma escalation helper
The system SHALL export a pure function `resolveRolSegundaFirma(primerFirmanteId: string, areaId: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` from `src/features/quality-events/utils/qualityEventPermissions.ts` that SHALL always return `'SUPERVISOR'` (RN-QE-004 reconciliada: un usuario no puede ser JCA y SUPERVISOR a la vez). Whether a given supervisor may sign SHALL be decided by `qe.supervisoresArea` in the detail view, and by `user.areaIds?.includes(qe.areaId)` in the dashboard pending-actions list, never by this helper.

#### Scenario: Returns SUPERVISOR for any input
- **WHEN** `resolveRolSegundaFirma` is called with any first-signer id and area id, known or unknown
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Dashboard pending action only for area supervisors
- **WHEN** a QE in PENDIENTE_CIERRE with `cerradoPorId` set belongs to area `area-001` and the current `SUPERVISOR` has `areaIds: ['area-002']`
- **THEN** the dashboard does not list the second signature as a pending action for that user

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

### Requirement: Pista "¿Olvidaste tu PIN?" en el PinModal de cierre
Mientras el input del PIN esté visible, el `PinModal` de `QECierreSection` SHALL mostrar debajo del input un enlace con el texto `qualityEvents:detail.cierre.pinModal.forgotPinLink` hacia `/perfil#pin-firma`. El enlace `configurePinLink` del estado sin PIN SHALL apuntar a `/perfil#pin-firma`. El PIN incorrecto SHALL seguir notificándose como toast desde `useFirmarCierre`.

#### Scenario: Pista visible en el modal de firma de cierre
- **WHEN** un firmante con PIN configurado abre el modal de firma del cierre de un QE
- **THEN** se ve el enlace "¿Olvidaste tu PIN?" con `href="/perfil#pin-firma"`

#### Scenario: Enlace de configurar PIN con ancla
- **WHEN** el firmante no tiene PIN configurado
- **THEN** no se ve la pista, y el enlace de configurar PIN apunta a `/perfil#pin-firma`

### Requirement: Estado de las dos firmas con nombres
While `qe.estado === 'PENDIENTE_CIERRE'` (with or without `qe.resultadoCierre`), `QECierreSection` SHALL show the steps block to every user who can open the QE, regardless of role, with three rows:
- **Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)** (`detail.cierre.paso1`): if `qe.resultadoCierre` is set, "✓ {fecha}", where the date comes from the latest audit entry `CIERRE_INICIADO` (if absent, only "✓"); otherwise `detail.cierre.pendiente`. The closure form SHALL keep being shown only to `JEFE_CALIDAD_SYST` while `resultadoCierre` is not set.
- **Firma 1 — Jefe de Calidad** (`detail.cierre.firma1`): if `qe.cerradoPorId` is set, "✓ {qe.cerradoPorNombre} — {fecha y hora}", where the date comes from the audit entry `FIRMA_CIERRE_JEFE_CALIDAD` or, if absent, the latest `FIRMA_REGISTRADA` with `campoModificado === 'cerradoPorId'`; otherwise `detail.cierre.pendiente`.
- **Firma 2 — Supervisor de {área}** (`detail.cierre.firma2`, area name via `useArea(qe.areaId)`, fallback the id): if signed, "✓ {qe.cierreFirmaSupervisorNombre} — {fecha}"; if pending with the first signature done, `detail.cierre.pendiente` plus `detail.cierre.puedenFirmar` with the names in `qe.supervisoresArea` joined by ", " and `detail.cierre.avisoEnviado`; if pending without the first signature, `detail.cierre.esperaJCA`.

From CERRADO onward (`CERRADO`, `EN_VERIFICACION`, `VERIFICADO`) the three rows SHALL keep being shown together with the closure summary. Dates SHALL be formatted with `Intl.DateTimeFormat(i18n.language, …)`. All hooks of `QECierreSection` SHALL run before any early `return`.

#### Scenario: Supervisor sees the steps before the closure result is recorded
- **WHEN** the QE is in PENDIENTE_CIERRE without `resultadoCierre` and the current user is a SUPERVISOR
- **THEN** the section shows "Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)" as "Pendiente", Firma 1 as "Pendiente" and Firma 2 as "Se habilita después de la firma del Jefe de Calidad.", and no closure form

#### Scenario: JCA still sees the closure form
- **WHEN** the QE is in PENDIENTE_CIERRE without `resultadoCierre` and the current user is JEFE_CALIDAD_SYST
- **THEN** the section shows the closure form and the three step rows

#### Scenario: Step 1 done
- **WHEN** the QE has `resultadoCierre` and an audit entry `CIERRE_INICIADO`
- **THEN** Paso 1 shows "✓" with that entry's formatted date

#### Scenario: First signature pending
- **WHEN** the QE has `resultadoCierre` but no `cerradoPorId`
- **THEN** Firma 1 shows "Pendiente" and Firma 2 shows "Se habilita después de la firma del Jefe de Calidad."

#### Scenario: First signature done with legacy audit entry
- **WHEN** `cerradoPorId` is set, `cerradoPorNombre: 'Ana Pérez'`, and the only signature audit entry is `FIRMA_REGISTRADA` with `campoModificado: 'cerradoPorId'`
- **THEN** Firma 1 shows "Ana Pérez" with that entry's formatted date

#### Scenario: Second signature pending lists who can sign
- **WHEN** `cerradoPorId` is set and `supervisoresArea` has "Luis Soto" and "Rosa Vega"
- **THEN** Firma 2 shows "Pendiente", "Pueden firmar: Luis Soto, Rosa Vega" and "Se les envió un aviso."

### Requirement: Rechazo del cierre desde QECierreSection
"Rechazar cierre" SHALL open a modal with a "Motivo del rechazo" textarea (label associated), a character counter, validated with a Zod schema (20–500 characters) through React Hook Form. Submitting SHALL call `useRechazarCierreQE().mutate({ id: qe.id, motivo })` (`POST /api/quality-events/:id/rechazar-cierre`). On success the modal SHALL close and the hook SHALL invalidate the QE detail, its audit trail, the QE list and, when linked, the incidents/NC queries (same as `useFirmarCierre`).

#### Scenario: Short reason blocks submission
- **WHEN** the supervisor types a 10-character reason and submits
- **THEN** a validation error is shown and the mutation is not called

#### Scenario: Valid reason rejects the closure
- **WHEN** the supervisor types a 25-character reason and submits
- **THEN** `useRechazarCierreQE().mutate` is called with that reason

### Requirement: Aviso de cierre rechazado
When `qe.estado === 'EN_EJECUCION'` and, among the audit entries `CIERRE_RECHAZADO` and the entries moving the QE into `PENDIENTE_CIERRE` (`ESTADO_CAMBIADO`/`TRANSICION_AUTOMATICA` with `estadoNuevo === 'PENDIENTE_CIERRE'`), the latest is `CIERRE_RECHAZADO`, `QECierreSection` SHALL show an amber notice `detail.cierre.rechazadoAviso` with the entry's `realizadoPorNombre`, formatted date and `valorNuevo` (motivo).

#### Scenario: Notice after a rejection
- **WHEN** the QE is in `EN_EJECUCION` and its latest relevant entry is `CIERRE_RECHAZADO` by "Luis Soto" with motivo "Falta evidencia fotográfica de la AC 2"
- **THEN** the amber notice shows "Cierre rechazado por Luis Soto el {fecha}: Falta evidencia fotográfica de la AC 2"

### Requirement: Área sin supervisor en el cierre
When `PATCH /:id/cerrar` or the first signature fails with `errorCode: 'AREA_SIN_SUPERVISOR'`, `useCerrarQE`/`useFirmarCierre` SHALL NOT show a toast and `QECierreSection` SHALL show inline `errors.AREA_SIN_SUPERVISOR` with the area name (read from the mutation's `error`, without `useEffect`); for `JEFE_CALIDAD_SYST` it SHALL add a link to `/usuarios`.

#### Scenario: JCA starts closure on an area without supervisor
- **WHEN** the JCA submits the closure form and the server responds 422 `AREA_SIN_SUPERVISOR`
- **THEN** the section shows "El área {área} no tiene un supervisor activo asignado…" with a link to Usuarios, and no toast
