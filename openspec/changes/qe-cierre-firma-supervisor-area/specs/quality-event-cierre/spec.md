## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Estado de las dos firmas con nombres
While `qe.estado === 'PENDIENTE_CIERRE'` and `qe.resultadoCierre` is set, `QECierreSection` SHALL show two rows:
- **Firma 1 — Jefe de Calidad** (`detail.cierre.firma1`): if `qe.cerradoPorId` is set, "✓ {qe.cerradoPorNombre} — {fecha y hora}", where the date comes from the audit entry `FIRMA_CIERRE_JEFE_CALIDAD` or, if absent, the latest `FIRMA_REGISTRADA` with `campoModificado === 'cerradoPorId'`; otherwise `detail.cierre.pendiente`.
- **Firma 2 — Supervisor de {área}** (`detail.cierre.firma2`, area name via `useArea(qe.areaId)`, fallback the id): if signed, "✓ {qe.cierreFirmaSupervisorNombre} — {fecha}"; if pending with the first signature done, `detail.cierre.pendiente` plus `detail.cierre.puedenFirmar` with the names in `qe.supervisoresArea` joined by ", " and `detail.cierre.avisoEnviado`; if pending without the first signature, `detail.cierre.esperaJCA`.

Dates SHALL be formatted with `Intl.DateTimeFormat(i18n.language, …)`.

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
