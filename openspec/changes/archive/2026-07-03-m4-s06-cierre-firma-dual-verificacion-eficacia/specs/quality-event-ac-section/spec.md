## MODIFIED Requirements

### Requirement: MSW sub-resource endpoints for QE-owned ACs
The system SHALL register in `src/mocks/handlers/quality-events.handlers.ts`: `GET /api/quality-events/:id/acciones-correctivas` (returns the QE's `accionesCorrectivas` array), `POST /api/quality-events/:id/acciones-correctivas` (appends a new AC with a generated `id`, `estado: 'PENDIENTE'`, and `qeId` set to `:id`), `PATCH /api/quality-events/:id/acciones-correctivas/:acId` (edits AC fields), and `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` (transitions `estado`, requiring `descripcionEvidencia` when the target is `CERRADA`, returning 422 otherwise). When the `:acId/status` transition to `CERRADA` results in every one of the QE's `accionesCorrectivas` having `estado === 'CERRADA'` (with `descripcionEvidencia` set) AND the QE's own `estado` is `EN_EJECUCION`, the handler SHALL additionally transition the QE's `estado` to `PENDIENTE_CIERRE` and append a second `QEAuditTrailEntry` (`accion: 'TRANSICION_AUTOMATICA'`, `estadoAnterior: 'EN_EJECUCION'`, `estadoNuevo: 'PENDIENTE_CIERRE'`) in the same response.

#### Scenario: GET returns the QE's AC array
- **WHEN** `GET /api/quality-events/qe-2026-005/acciones-correctivas` is requested for a QE with 2 ACs
- **THEN** the response is 200 with `data` being an array of 2 ACs, each with `qeId: 'qe-2026-005'`

#### Scenario: POST appends a new AC with PENDIENTE estado
- **WHEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas` is requested with a valid AC payload
- **THEN** the response is 201 with the new AC having `estado: 'PENDIENTE'` and `qeId: 'qe-2026-005'`, and the QE's `accionesCorrectivas` array grows by 1

#### Scenario: PATCH status to CERRADA without evidence returns 422
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA' }` and no `descripcionEvidencia`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Closing the last open AC auto-transitions the QE to PENDIENTE_CIERRE
- **WHEN** a QE in `EN_EJECUCION` has 2 ACs, one already `CERRADA` with evidence, and `PATCH .../acciones-correctivas/:acId/status` closes the second with `{ estado: 'CERRADA', descripcionEvidencia: 'Evidencia final' }`
- **THEN** the response's `data` reflects `estado: 'CERRADA'` for that AC, and a follow-up `GET /api/quality-events/:id` shows the QE's `estado === 'PENDIENTE_CIERRE'` with an added `TRANSICION_AUTOMATICA` audit entry

#### Scenario: Closing an AC while others remain open does not auto-transition the QE
- **WHEN** a QE in `EN_EJECUCION` has 2 ACs and only one is closed with evidence
- **THEN** the QE's `estado` remains `EN_EJECUCION`

#### Scenario: Closing the last AC of a QE not in EN_EJECUCION does not auto-transition
- **WHEN** all ACs of a QE in `ANALISIS_COMPLETADO` are closed with evidence
- **THEN** the QE's `estado` remains `ANALISIS_COMPLETADO` (the auto-transition only applies from `EN_EJECUCION`)

---

## ADDED Requirements

### Requirement: QEACSection notifies JEFE_CALIDAD_SYST and SUPERVISOR on auto-transition to PENDIENTE_CIERRE
When the close-AC mutation's response indicates the QE's `estado` changed to `PENDIENTE_CIERRE` (compared against the QE's `estado` prop before the mutation), `QEACSection` SHALL show a Sonner `toast.info` in-app notification, visible only when the current user's role is `JEFE_CALIDAD_SYST` or `SUPERVISOR`. `QEHeaderSection` SHALL additionally render an informational `DeadlineBadge`-style badge while `qe.estado === 'PENDIENTE_CIERRE'`, computed as 5 business days from the `TRANSICION_AUTOMATICA` audit entry's timestamp, with no functional blocking if the 5 days elapse (informational only in this version).

#### Scenario: JEFE_CALIDAD_SYST sees the auto-transition toast
- **WHEN** closing the last open AC transitions the QE from `EN_EJECUCION` to `PENDIENTE_CIERRE` and the current user's role is `JEFE_CALIDAD_SYST`
- **THEN** a `toast.info` notification is shown

#### Scenario: OPERARIO does not see the auto-transition toast
- **WHEN** the same auto-transition occurs and the current user's role is `OPERARIO`
- **THEN** no auto-transition toast is shown to that user

#### Scenario: Informational plazo badge shown in PENDIENTE_CIERRE
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `estado: 'PENDIENTE_CIERRE'`
- **THEN** an informational badge showing days remaining of the 5-business-day reference plazo is visible, with no disabled or blocked action tied to it
