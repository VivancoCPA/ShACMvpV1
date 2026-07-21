## MODIFIED Requirements

### Requirement: MSW sub-resource endpoints for QE-owned ACs
The system SHALL register in `src/mocks/handlers/quality-events.handlers.ts`: `GET /api/quality-events/:id/acciones-correctivas` (returns the QE's `accionesCorrectivas` array), `POST /api/quality-events/:id/acciones-correctivas` (appends a new AC with a generated `id`, `estado: 'PENDIENTE'`, and `qeId` set to `:id`), `PATCH /api/quality-events/:id/acciones-correctivas/:acId` (edits AC fields), and `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` (transitions `estado`, requiring `descripcionEvidencia` when the target is `CERRADA`, returning 422 otherwise). When the `:acId/status` transition to `CERRADA` results in every one of the QE's `accionesCorrectivas` having `estado === 'CERRADA'` (with `descripcionEvidencia` set) AND the QE's own `estado` is `EN_EJECUCION`, the handler SHALL additionally transition the QE's `estado` to `PENDIENTE_CIERRE` and append a second `QEAuditTrailEntry` (`accion: 'TRANSICION_AUTOMATICA'`, `estadoAnterior: 'EN_EJECUCION'`, `estadoNuevo: 'PENDIENTE_CIERRE'`) in the same response. When `POST .../acciones-correctivas` sets a `responsableId`, or `PATCH .../:acId` changes `responsableId` to a different value, the handler SHALL create an `ASIGNACION` notification (via `createAsignacionNotification`) for that responsable, excluding the acting user and any unresolvable id. When the auto-transition to `PENDIENTE_CIERRE` occurs, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) for every resolvable user with role `JEFE_CALIDAD_SYST` (the required first signer of closure), excluding the acting user.

#### Scenario: Auto-transition to PENDIENTE_CIERRE notifies JEFE_CALIDAD_SYST users
- **WHEN** the last open AC on a QE in `EN_EJECUCION` is closed with valid `descripcionEvidencia`, triggering the automatic transition to `PENDIENTE_CIERRE`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable user with role `JEFE_CALIDAD_SYST`, excluding whoever closed the AC

#### Scenario: New AC with a responsableId notifies that responsable
- **WHEN** `POST /api/quality-events/:id/acciones-correctivas` is requested with `responsableId: 'user-operario-002'` distinct from the acting user
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'`

#### Scenario: Reassigning an AC's responsableId notifies the new responsable
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId` changes `responsableId` from `'user-operario-001'` to `'user-operario-002'`
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'` and none is created for `'user-operario-001'`

### Requirement: QEACSection notifies JEFE_CALIDAD_SYST and SUPERVISOR on auto-transition to PENDIENTE_CIERRE
When the close-AC mutation's response indicates the QE's `estado` changed to `PENDIENTE_CIERRE` (compared against the QE's `estado` prop before the mutation), `QEACSection` SHALL show a Sonner `toast.info` confirming the closure request was recorded, visible to the acting user regardless of their role. `QEHeaderSection` SHALL additionally render an informational `DeadlineBadge`-style badge while `qe.estado === 'PENDIENTE_CIERRE'`, computed as 5 business days from the `TRANSICION_AUTOMATICA` audit entry's timestamp, with no functional blocking if the 5 days elapse (informational only in this version). The actual notification of `JEFE_CALIDAD_SYST` users that they must sign the closure SHALL be delivered as a real, persisted `CAMBIO_ESTADO` notification (per the `MSW sub-resource endpoints for QE-owned ACs` requirement above), not as toast copy naming those roles.

#### Scenario: Acting user sees a closure-recorded toast
- **WHEN** the AC-close mutation response shows the QE transitioned to `PENDIENTE_CIERRE`
- **THEN** a `toast.info` confirming the closure request was recorded is shown to the acting user

#### Scenario: The toast does not claim other roles were notified
- **WHEN** the AC-close mutation response shows the QE transitioned to `PENDIENTE_CIERRE`
- **THEN** the toast text does not reference `JEFE_CALIDAD_SYST` or `SUPERVISOR` being notified — that delivery happens via the persisted notification instead
