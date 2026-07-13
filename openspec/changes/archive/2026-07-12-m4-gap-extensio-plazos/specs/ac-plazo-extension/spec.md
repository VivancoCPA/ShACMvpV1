## ADDED Requirements

### Requirement: SolicitudAjustePlazoAC tracks a history array per AC
The system SHALL redefine `SolicitudAjustePlazoAC` in `src/features/quality-events/types/qualityEvent.types.ts` with fields: `id` (string), `fechaSolicitada` (ISO 8601 date string), `justificacion` (string), `estado` (`'PENDIENTE' | 'APROBADA' | 'RECHAZADA'`), `solicitadoPorId` (string), `solicitadoEn` (ISO 8601 string), `requiereAprobacionGerencia` (boolean), `revisadoPorId?` (string), `revisadoEn?` (ISO 8601 string), `comentarioRevision?` (string). `AccionCorrectivaQE` SHALL expose these as `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]` (required, defaulting to `[]`), replacing the removed `solicitudAjustePlazo?: SolicitudAjustePlazoAC` singular field.

#### Scenario: AccionCorrectivaQE requires solicitudesAjustePlazo as an array
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `solicitudesAjustePlazo`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: SolicitudAjustePlazoAC requires requiereAprobacionGerencia
- **WHEN** a developer constructs a `SolicitudAjustePlazoAC` without `requiereAprobacionGerencia`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: SolicitudAjustePlazoAC accepts absence of review fields before a decision
- **WHEN** a developer constructs a `SolicitudAjustePlazoAC` with `revisadoPorId`, `revisadoEn`, and `comentarioRevision` omitted
- **THEN** TypeScript accepts the object without error

---

### Requirement: PLAZO_SUGERIDO_DIAS_HABILES and PLAZO_MINIMO_DIAS_HABILES constants
The system SHALL export `PLAZO_SUGERIDO_DIAS_HABILES` and `PLAZO_MINIMO_DIAS_HABILES`, each a `Record<QESeverity, number>`, from a constants module under `src/features/quality-events/` (e.g. `constants/plazoAjuste.constants.ts`). Values SHALL be: `PLAZO_SUGERIDO_DIAS_HABILES` — `BAJA: 30, MEDIA: 20, ALTA: 10, CRITICA: 5`; `PLAZO_MINIMO_DIAS_HABILES` — `BAJA: 15, MEDIA: 10, ALTA: 5, CRITICA: 2`, matching PRD §1.6.

#### Scenario: PLAZO_SUGERIDO_DIAS_HABILES covers all four severities
- **WHEN** a developer imports `PLAZO_SUGERIDO_DIAS_HABILES`
- **THEN** the object contains all four `QESeverity` keys with values `30, 20, 10, 5` respectively

#### Scenario: PLAZO_MINIMO_DIAS_HABILES covers all four severities
- **WHEN** a developer imports `PLAZO_MINIMO_DIAS_HABILES`
- **THEN** the object contains all four `QESeverity` keys with values `15, 10, 5, 2` respectively

---

### Requirement: requiereAprobacionGerencia calculation governed by qe.severidad, not ac.prioridad
The system SHALL export a function (e.g. `calcularRequiereAprobacionGerencia(qeSeveridad: QESeverity, incrementoDiasHabiles: number): boolean`) that computes: `true` when `qeSeveridad === 'CRITICA'`; `true` when `qeSeveridad === 'ALTA'` and `incrementoDiasHabiles > PLAZO_SUGERIDO_DIAS_HABILES.ALTA * 0.5`; `false` otherwise (including for `BAJA` and `MEDIA` regardless of increment size). `incrementoDiasHabiles` SHALL be computed as `contarDiasHabiles(ac.plazoFecha, fechaSolicitada)` (reused from `src/utils/businessDays.ts`, not reimplemented), measured from the AC's current `plazoFecha` at the moment of the request. This calculation SHALL be evaluated once when a request is created and stored on `SolicitudAjustePlazoAC.requiereAprobacionGerencia` — it is never recomputed later. `ac.prioridad` SHALL NOT be read anywhere in this calculation.

#### Scenario: BAJA severity extension of 10 days does not require Gerencia
- **WHEN** a request is proposed for an AC on a `QualityEvent` with `severidad: 'BAJA'` and `incrementoDiasHabiles` of 10
- **THEN** `requiereAprobacionGerencia` is `false`

#### Scenario: ALTA severity extension at or under 50% of the suggested plazo does not require Gerencia
- **WHEN** a request is proposed for an AC on a `QualityEvent` with `severidad: 'ALTA'` and `incrementoDiasHabiles` of 5 (50% of the suggested 10-day plazo)
- **THEN** `requiereAprobacionGerencia` is `false`

#### Scenario: ALTA severity extension over 50% of the suggested plazo requires Gerencia
- **WHEN** a request is proposed for an AC on a `QualityEvent` with `severidad: 'ALTA'` and `incrementoDiasHabiles` of 8 (over 50% of the suggested 10-day plazo)
- **THEN** `requiereAprobacionGerencia` is `true`

#### Scenario: CRITICA severity always requires Gerencia
- **WHEN** a request is proposed for an AC on a `QualityEvent` with `severidad: 'CRITICA'`, regardless of `incrementoDiasHabiles`
- **THEN** `requiereAprobacionGerencia` is `true`

---

### Requirement: QEACSection shows "Solicitar ajuste de plazo" only to the AC's responsable
`QEACSection` SHALL render a "Solicitar ajuste de plazo" action on an AC row when `!readOnly && user.id === ac.responsableId && ac.estado !== 'CERRADA'` and the AC has no request with `estado === 'PENDIENTE'` in `solicitudesAjustePlazo`. Clicking it opens a modal (same modal pattern as `CerrarQEACModal`/`AgregarQEACModal`) with a `fechaSolicitada` date input and a `justificacion` textarea (minimum 50 characters, enforced via Zod).

#### Scenario: Button hidden for a user who is not the AC's responsable
- **WHEN** `QEACSection` renders an AC row where `ac.responsableId !== user.id`
- **THEN** the "Solicitar ajuste de plazo" action is not rendered for that row

#### Scenario: Button hidden when the AC is CERRADA
- **WHEN** `QEACSection` renders an AC row with `ac.estado === 'CERRADA'` and `ac.responsableId === user.id`
- **THEN** the "Solicitar ajuste de plazo" action is not rendered for that row

#### Scenario: Button hidden while a PENDIENTE request already exists (no concurrent requests)
- **WHEN** an AC's `solicitudesAjustePlazo` already contains an entry with `estado === 'PENDIENTE'`
- **THEN** the "Solicitar ajuste de plazo" action is not rendered for that row, even for the responsable

#### Scenario: Justificación below 50 characters blocks submission
- **WHEN** the user submits the request modal with a `justificacion` of fewer than 50 characters
- **THEN** a validation error is shown and `POST .../solicitud-plazo` is not called

---

### Requirement: Request modal blocks a fechaSolicitada below the severity's minimum plazo
Before allowing submission, the request modal SHALL compute the total elapsed business days from the AC's original creation context using `PLAZO_MINIMO_DIAS_HABILES[qe.severidad]` as the floor: if the proposed `fechaSolicitada` implies a total plazo shorter than that minimum, the form SHALL show a validation error and SHALL NOT call the mutation.

#### Scenario: Proposed date below the severity minimum is rejected client-side
- **WHEN** the user proposes a `fechaSolicitada` for a `CRITICA`-severity QE's AC that yields a total plazo under the 2-business-day minimum
- **THEN** a validation error is shown and `POST .../solicitud-plazo` is not called

#### Scenario: Proposed date at or above the severity minimum is accepted
- **WHEN** the user proposes a `fechaSolicitada` that yields a total plazo at or above `PLAZO_MINIMO_DIAS_HABILES[qe.severidad]`
- **THEN** no minimum-plazo validation error is shown

---

### Requirement: Request modal previews the required approval level before confirming
Before the user confirms submission, the modal SHALL compute `requiereAprobacionGerencia` from the current form values (`qe.severidad`, `ac.plazoFecha`, `fechaSolicitada`) and display a badge reading "Requiere aprobación de Gerencia" when `true`, or an equivalent "Aprobación de Jefe de Calidad" indicator when `false`.

#### Scenario: Badge shows Gerencia approval preview
- **WHEN** the user enters a `fechaSolicitada` that would set `requiereAprobacionGerencia` to `true`
- **THEN** the modal displays a "Requiere aprobación de Gerencia" badge before submission

#### Scenario: Badge shows Jefe de Calidad approval preview
- **WHEN** the user enters a `fechaSolicitada` that would set `requiereAprobacionGerencia` to `false`
- **THEN** the modal displays a Jefe de Calidad approval indicator, not the Gerencia badge

---

### Requirement: Approve/reject panel is visible only to the role authorized for the pending request
When an AC has a request with `estado === 'PENDIENTE'`, `QEACSection` SHALL render an approve/reject panel showing `fechaSolicitada`, `justificacion`, and `solicitadoPorId`'s name, with "Aprobar"/"Rechazar" buttons visible only when: `solicitud.requiereAprobacionGerencia === false && user.rol === 'JEFE_CALIDAD_SYST'`, or `solicitud.requiereAprobacionGerencia === true && user.rol === 'ALTA_DIRECCION'`. For any other role (including the non-authorized one of these two), the panel SHALL render read-only (no action buttons).

#### Scenario: JEFE_CALIDAD_SYST sees action buttons for a non-Gerencia request
- **WHEN** a pending request has `requiereAprobacionGerencia: false` and the current user's role is `JEFE_CALIDAD_SYST`
- **THEN** "Aprobar" and "Rechazar" buttons are visible

#### Scenario: JEFE_CALIDAD_SYST does not see action buttons for a Gerencia-required request
- **WHEN** a pending request has `requiereAprobacionGerencia: true` and the current user's role is `JEFE_CALIDAD_SYST`
- **THEN** the panel renders read-only, with no "Aprobar"/"Rechazar" buttons

#### Scenario: ALTA_DIRECCION sees action buttons for a Gerencia-required request
- **WHEN** a pending request has `requiereAprobacionGerencia: true` and the current user's role is `ALTA_DIRECCION`
- **THEN** "Aprobar" and "Rechazar" buttons are visible

#### Scenario: Other roles see the panel as read-only
- **WHEN** a pending request exists and the current user's role is `SUPERVISOR`
- **THEN** the panel is visible but no action buttons are rendered

---

### Requirement: Approving a request updates plazoFecha and preserves history
Clicking "Aprobar" SHALL call `PATCH .../acciones-correctivas/:acId/solicitud-plazo/:solicitudId` with `{ accion: 'APROBAR' }`. On success, the system SHALL set `ac.plazoFecha` to the request's `fechaSolicitada`, mark that request's `estado` as `'APROBADA'` with `revisadoPorId` and `revisadoEn` set, append an `AC_AJUSTE_PLAZO_APROBADO` entry to the QE's `auditTrail`, and show `toast.success`. The request SHALL remain in `solicitudesAjustePlazo` (not removed) so history is preserved.

#### Scenario: Approving updates the AC's plazoFecha
- **WHEN** the authorized approver clicks "Aprobar" on a pending request with `fechaSolicitada: '2026-08-15'`
- **THEN** `ac.plazoFecha` becomes `'2026-08-15'` and the request's `estado` becomes `'APROBADA'`

#### Scenario: Approved request remains in solicitudesAjustePlazo history
- **WHEN** a request is approved
- **THEN** `solicitudesAjustePlazo` still contains that request (now `APROBADA`), and its length is unchanged from before the approval

#### Scenario: Approving appends an audit trail entry to the parent QE
- **WHEN** a request is approved
- **THEN** the QE's `auditTrail` grows by 1 entry with `accion: 'AC_AJUSTE_PLAZO_APROBADO'`

---

### Requirement: Rejecting a request requires a comment and does not change plazoFecha
Clicking "Rechazar" SHALL open a confirmation requiring a non-empty `comentarioRevision` before it can be submitted. On confirm, the system SHALL call `PATCH .../acciones-correctivas/:acId/solicitud-plazo/:solicitudId` with `{ accion: 'RECHAZAR', comentarioRevision }`. On success, the system SHALL mark the request's `estado` as `'RECHAZADA'` with `revisadoPorId`, `revisadoEn`, and `comentarioRevision` set, leave `ac.plazoFecha` unchanged, append an `AC_AJUSTE_PLAZO_RECHAZADO` entry to the QE's `auditTrail`, and show `toast.info`.

#### Scenario: Empty comment blocks rejection
- **WHEN** the approver attempts to confirm "Rechazar" with an empty `comentarioRevision`
- **THEN** a validation error is shown and the mutation is not called

#### Scenario: Rejecting leaves plazoFecha unchanged
- **WHEN** a pending request for an AC with `plazoFecha: '2026-08-01'` is rejected
- **THEN** `ac.plazoFecha` remains `'2026-08-01'` and the request's `estado` becomes `'RECHAZADA'`

#### Scenario: Rejecting shows the comment on the request
- **WHEN** a request is rejected with `comentarioRevision: 'Plazo insuficientemente justificado'`
- **THEN** the rejected request displays that comment

---

### Requirement: Toast notifications follow the existing pattern for propose/approve/reject
On successful proposal, `QEACSection` SHALL show `toast.success` to the requester and `toast.info` (informational, in-app only — no real notification backend exists) indicating the correct approver (Jefe de Calidad or Gerencia) has been notified. On approve or reject, the system SHALL show a toast (`toast.success` for approve, `toast.info` for reject) indicating the responsable has been notified, following the pattern already used in `QECierreSection.tsx`/`QEVerificacionSection.tsx`.

#### Scenario: Proposing shows a success toast and an approver-notified toast
- **WHEN** a request is successfully proposed
- **THEN** `toast.success` is shown for the proposal and a separate `toast.info` indicates the approver was notified

#### Scenario: Approving shows a responsable-notified toast
- **WHEN** a request is approved
- **THEN** `toast.success` is shown and includes or is followed by a `toast.info` indicating the responsable was notified

---

### Requirement: ACsExtensionPlazoWidget reads solicitudesAjustePlazo and filters to Gerencia-pending requests
`ACsExtensionPlazoWidget.tsx` SHALL read `ACSolicitudAjustePlazoResumen.solicitudesAjustePlazo` (renamed from the removed singular `solicitudAjustePlazo`) and render only entries whose latest request has `estado === 'PENDIENTE' && requiereAprobacionGerencia === true`. ACs whose only pending request does not require Gerencia approval SHALL NOT appear in this widget.

#### Scenario: Widget shows an AC with a pending Gerencia-required request
- **WHEN** the widget receives an AC summary whose `solicitudesAjustePlazo` includes an entry with `estado: 'PENDIENTE'` and `requiereAprobacionGerencia: true`
- **THEN** that AC row is rendered

#### Scenario: Widget hides an AC whose pending request only needs Jefe de Calidad
- **WHEN** the widget receives an AC summary whose only pending request has `requiereAprobacionGerencia: false`
- **THEN** that AC row is not rendered

#### Scenario: Widget hides an AC with no PENDIENTE request
- **WHEN** an AC summary's `solicitudesAjustePlazo` contains only `APROBADA`/`RECHAZADA` entries
- **THEN** that AC row is not rendered

---

### Requirement: API client functions for proposing and reviewing a plazo adjustment
The system SHALL export `solicitarAjustePlazoAC(qeId: string, acId: string, data: { fechaSolicitada: string; justificacion: string }): Promise<AccionCorrectivaQE>` and `revisarAjustePlazoAC(qeId: string, acId: string, solicitudId: string, data: { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string }): Promise<AccionCorrectivaQE>` from `src/features/quality-events/api/quality-events.api.ts`, calling `POST /api/quality-events/:qeId/acciones-correctivas/:acId/solicitud-plazo` and `PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/solicitud-plazo/:solicitudId` respectively.

#### Scenario: solicitarAjustePlazoAC calls the correct endpoint
- **WHEN** `solicitarAjustePlazoAC('qe-2026-005', 'ac-1', { fechaSolicitada: '2026-08-15', justificacion: '...' })` is called
- **THEN** the client performs `POST /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo` with the body and returns the updated `AccionCorrectivaQE`

#### Scenario: revisarAjustePlazoAC calls the correct endpoint
- **WHEN** `revisarAjustePlazoAC('qe-2026-005', 'ac-1', 'sol-1', { accion: 'APROBAR' })` is called
- **THEN** the client performs `PATCH /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo/sol-1` with the body and returns the updated `AccionCorrectivaQE`
