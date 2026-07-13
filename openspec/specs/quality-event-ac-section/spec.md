# Spec: quality-event-ac-section

## Purpose

QE-owned corrective actions (Modelo B): `AccionCorrectivaQE` list embedded in the Quality Event detail page. Displays progress, creation, and state transitions scoped to the active QE, backed by MSW sub-resource endpoints on `quality-events.handlers.ts`.

---

## Requirements

### Requirement: AccionCorrectivaQE is owned by the Quality Event (Modelo B)
The system SHALL type `AccionCorrectivaQE` in `src/features/quality-events/types/qualityEvent.types.ts` with `qeId: string` as the primary reference (the QE that owns the AC) and the following fields, matching the shape already used by `AccionCorrectiva` (M2) and `AccionCorrectivaIncidente` (M3): `id`, `titulo?`, `descripcion`, `responsableId`, `responsableNombre`, `plazoFecha`, `prioridad?` (`'BAJA'|'MEDIA'|'ALTA'|'CRITICA'`), `estado` (`'PENDIENTE'|'EN_EJECUCION'|'CERRADA'`), `creadoEn`, `actualizadoEn`, `descripcionEvidencia?`, `evidenciaUrl?`, `fechaCierre?`, `solicitudesAjustePlazo: SolicitudAjustePlazoAC[]`.

#### Scenario: AccionCorrectivaQE requires qeId
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `qeId`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaQE accepts absence of prioridad and evidence fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` with `prioridad`, `descripcionEvidencia`, and `evidenciaUrl` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: AccionCorrectivaQE requires solicitudesAjustePlazo as an array
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `solicitudesAjustePlazo`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: A new AccionCorrectivaQE defaults solicitudesAjustePlazo to an empty array
- **WHEN** an AC is created via `POST /api/quality-events/:id/acciones-correctivas` (see `quality-event-ac-section`'s creation requirement)
- **THEN** the returned AC has `solicitudesAjustePlazo: []`

---

### Requirement: QEACSection renders the AC list with progress indicator
The system SHALL render a `QEACSection` component at `src/features/quality-events/components/QEACSection.tsx` that receives `qeId: string` and the QE's `accionesCorrectivas: AccionCorrectivaQE[]`. It SHALL render a header showing "N de M ACs cerradas" (N = count with `estado === 'CERRADA'`, M = total count), followed by the AC list. Each row displays `titulo` (if present), `descripcion`, a status badge, `prioridad` badge (if present), `responsableNombre`, and a `DeadlineBadge` for `plazoFecha`.

#### Scenario: Progress indicator reflects closed count
- **WHEN** `QEACSection` renders with 3 ACs, 1 of which has `estado === 'CERRADA'`
- **THEN** the header reads "1 de 3 ACs cerradas"

#### Scenario: Progress indicator updates after closing an AC
- **WHEN** an AC transitions to `CERRADA` via the close modal and the query is invalidated
- **THEN** the header count for closed ACs increases by 1

---

### Requirement: QEACSection creates ACs scoped to the active QE
`QEACSection` SHALL render a "Nueva AC" button visible to `JEFE_CALIDAD_SYST` when `qe.estado` is `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, or `EN_EJECUCION`, and hidden when `qe.estado` is `CERRADO` or `VERIFICADO`. Clicking it opens a create modal (titulo, descripcion, responsableId, prioridad, plazoFecha). Submitting SHALL call `POST /api/quality-events/:qeId/acciones-correctivas`, which SHALL create the AC with `qeId` set to the active QE's id and `estado: 'PENDIENTE'`.

#### Scenario: Nueva AC button visible during EN_EJECUCION for JEFE_CALIDAD_SYST
- **WHEN** `QEACSection` renders for a `QualityEvent` in `EN_EJECUCION` with role `JEFE_CALIDAD_SYST`
- **THEN** the "Nueva AC" button is visible

#### Scenario: Nueva AC button hidden when CERRADO
- **WHEN** `QEACSection` renders for a `QualityEvent` in `CERRADO`
- **THEN** the "Nueva AC" button is not rendered regardless of role

#### Scenario: Created AC has qeId of the active QE
- **WHEN** the create modal is submitted for QE `qe-2026-005`
- **THEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas` is called and the returned AC has `qeId: 'qe-2026-005'` and `estado: 'PENDIENTE'`

---

### Requirement: QEACSection AC state transitions PENDIENTE → EN_EJECUCION → CERRADA
Each AC row SHALL show a contextual transition button: `PENDIENTE` shows "Iniciar" (calls `PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/status` with `estado: 'EN_EJECUCION'`); `EN_EJECUCION` shows "Cerrar con evidencia" (opens the close modal). `CERRADA` shows no action button.

#### Scenario: PENDIENTE AC shows Iniciar button
- **WHEN** an `AccionCorrectivaQE` has `estado === 'PENDIENTE'`
- **THEN** an "Iniciar" button is visible for that row

#### Scenario: EN_EJECUCION AC shows Cerrar con evidencia button
- **WHEN** an `AccionCorrectivaQE` has `estado === 'EN_EJECUCION'`
- **THEN** a "Cerrar con evidencia" button is visible and "Iniciar" is absent

#### Scenario: CERRADA AC shows no action button
- **WHEN** an `AccionCorrectivaQE` has `estado === 'CERRADA'`
- **THEN** no transition button is rendered for that row

---

### Requirement: Closing a QE AC requires descripcionEvidencia
Clicking "Cerrar con evidencia" SHALL open a modal with a required `descripcionEvidencia` textarea and an optional `evidenciaUrl` URL input. Submitting with an empty `descripcionEvidencia` SHALL show a validation error and SHALL NOT call the mutation. On valid submit, the system SHALL call `PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/status` with `{ estado: 'CERRADA', descripcionEvidencia, evidenciaUrl? }`.

#### Scenario: Empty descripcionEvidencia blocks submission
- **WHEN** the user submits the close modal with an empty `descripcionEvidencia`
- **THEN** a validation error is shown below the textarea and the status mutation is not called

#### Scenario: Valid descripcionEvidencia closes the AC
- **WHEN** the user enters a non-empty `descripcionEvidencia` and submits
- **THEN** `PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/status` is called with `estado: 'CERRADA'` and the modal closes on success

---

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

#### Scenario: PATCH status to CERRADA with evidence succeeds
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA', descripcionEvidencia: 'Evidencia adjunta' }`
- **THEN** the response is 200 and the AC's `estado` is `'CERRADA'` with `descripcionEvidencia` set

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

---

### Requirement: QEACSection shows a pending-AC-requests banner for JEFE_CALIDAD_SYST
When `qe.solicitudesAC > 0`, `QEACSection` SHALL render a banner visible only to `JEFE_CALIDAD_SYST` reading "N solicitudes de nueva AC pendientes — registradas desde el origen del QE" (N = `qe.solicitudesAC`). The banner SHALL NOT render when `solicitudesAC` is 0 or for other roles.

#### Scenario: Banner shown for JEFE_CALIDAD_SYST when solicitudesAC > 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `JEFE_CALIDAD_SYST`
- **THEN** a banner reading "2 solicitudes de nueva AC pendientes — registradas desde el origen del QE" is visible

#### Scenario: Banner hidden when solicitudesAC is 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 0`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner hidden for other roles
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `SUPERVISOR`
- **THEN** no pending-AC-requests banner is rendered
