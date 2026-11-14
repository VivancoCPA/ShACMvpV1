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
Each AC row SHALL show actions according to the user and the AC state:

| Estado | Responsable (`user.id === ac.responsableId`) | JEFE_CALIDAD_SYST | Otros |
|---|---|---|---|
| `PENDIENTE` | "Iniciar" (`POST …/iniciar`) | — | — |
| `EN_EJECUCION` | "Marcar como ejecutada" (opens the execution modal) | — | — |
| `COMPLETADA` | badge "Pendiente de verificación" | "Verificar" (opens the verification modal) | badge |
| `CERRADA` | "Verificada por {nombre} · {fecha}" | same | same |

A JEFE_CALIDAD_SYST who is also the responsable SHALL see the union of both columns. No action button SHALL render when `readOnly`.

When `estado === 'EN_EJECUCION'` and `motivoDevolucion` is set, the row SHALL show an amber notice "Devuelta por el Jefe de Calidad: {motivo}". A `CERRADA` AC with evidence files SHALL show "Ver evidencias ({n})"; a historical AC with `evidenciaUrl` SHALL show that link as is.

#### Scenario: PENDIENTE AC shows Iniciar only to the responsable
- **WHEN** an AC has `estado === 'PENDIENTE'` and the user is its responsable
- **THEN** an "Iniciar" button is visible for that row

#### Scenario: JCA who is not the responsable cannot start or execute
- **WHEN** a JEFE_CALIDAD_SYST views an AC assigned to an OPERARIO in `PENDIENTE` or `EN_EJECUCION`
- **THEN** neither "Iniciar" nor "Marcar como ejecutada" is rendered

#### Scenario: COMPLETADA AC shows Verificar to the JCA
- **WHEN** an AC has `estado === 'COMPLETADA'` and the user is JEFE_CALIDAD_SYST
- **THEN** a "Verificar" button is visible

#### Scenario: COMPLETADA AC for the responsable
- **WHEN** the responsable (not JCA) views their AC in `COMPLETADA`
- **THEN** the badge "Pendiente de verificación" is shown and no action button is rendered

#### Scenario: JCA responsable sees both
- **WHEN** a JEFE_CALIDAD_SYST is the responsable of an AC in `EN_EJECUCION`
- **THEN** "Marcar como ejecutada" is visible, and after it reaches `COMPLETADA` "Verificar" is visible

#### Scenario: CERRADA AC shows the verifier
- **WHEN** an AC has `estado === 'CERRADA'` with `verificadaPorNombre`
- **THEN** the row shows "Verificada por {nombre} · {fecha}" and no action button

---

### Requirement: Closing a QE AC requires descripcionEvidencia
"Marcar como ejecutada" SHALL open `EjecutarQEACModal`, which contains:
- a drop zone with "Elegir archivos" (`accept=".pdf,.jpg,.jpeg,.png,.mp4,.docx,.xlsx"`);
- on touch devices (`pointer: coarse`), a "Tomar foto" button with `capture="environment"`.

Each file SHALL be uploaded on selection (`POST …/evidencias`), with a progress bar and a ✕ that calls `DELETE …/evidencias/{evId}`. The client SHALL reject files over 50 MB, and more than 5 in total, before uploading. Images SHALL show a thumbnail and other types an icon.

The `descripcionEvidencia` textarea SHALL show a 50–300 character counter. "Confirmar ejecución" SHALL be enabled only with at least 1 uploaded file and a valid description, and SHALL call `POST …/ejecutar`. There SHALL be no URL field.

"Verificar" SHALL open `VerificarQEACModal`, which shows:
- the evidence description;
- the file list (thumbnails for images); clicking a file opens it in a new tab from an authenticated blob.

The modal offers "Aprobar y cerrar" (`POST …/verificar` with `aprobada: true`) and "Devolver", which requires a reason of 20–500 characters (`aprobada: false`).

#### Scenario: Confirm disabled without files
- **WHEN** the execution modal has a valid description but no uploaded file
- **THEN** "Confirmar ejecución" is disabled

#### Scenario: Confirm disabled with a short description
- **WHEN** one file is uploaded and the description has 20 characters
- **THEN** "Confirmar ejecución" is disabled

#### Scenario: Oversized file rejected client-side
- **WHEN** the user selects a 51 MB file
- **THEN** an error is shown and no upload request is sent

#### Scenario: Upload and remove
- **WHEN** the user uploads a file and then clicks its ✕
- **THEN** the file appears in the list after upload and disappears after the `DELETE` succeeds

#### Scenario: Return requires a reason
- **WHEN** the JCA clicks "Devolver" with an empty reason
- **THEN** a validation error is shown and no request is sent

#### Scenario: Approve closes
- **WHEN** the JCA clicks "Aprobar y cerrar"
- **THEN** `POST …/verificar` is called with `aprobada: true` and the modal closes on success

---

### Requirement: MSW sub-resource endpoints for QE-owned ACs
The system SHALL register in `src/mocks/handlers/quality-events.handlers.ts`:
- `GET /api/quality-events/:id/acciones-correctivas`: returns the QE's `accionesCorrectivas` array.
- `POST /api/quality-events/:id/acciones-correctivas`: appends a new AC with a generated `id`, `estado: 'PENDIENTE'`, `qeId` set to `:id` and `evidencias: []`.
- `PATCH /api/quality-events/:id/acciones-correctivas/:acId`: edits AC fields.
- `PATCH …/:acId/status`: responds 422 `USAR_FLUJO_VERIFICACION` for `CERRADA`, `COMPLETADA` and `PENDIENTE`, and behaves like `iniciar` for `EN_EJECUCION`.
- The new in-memory endpoints `POST …/:acId/iniciar`, `POST …/:acId/evidencias` (multipart, validated by extension, size and count), `DELETE …/:acId/evidencias/:evId`, `GET …/:acId/evidencias/:evId/archivo` (returns a `Blob`), `POST …/:acId/ejecutar` and `POST …/:acId/verificar`. They apply the same 403 (`SOLO_RESPONSABLE_AC` / `SOLO_JCA_VERIFICA`), 400 and 422 rules as the backend.

When `verificar` approves and every one of the QE's ACs is `CERRADA` with evidence (description plus files or historical `evidenciaUrl`), and the QE's `estado` is `EN_EJECUCION`, the handler SHALL:
- transition the QE to `PENDIENTE_CIERRE`;
- append a `TRANSICION_AUTOMATICA` audit entry;
- create a `CAMBIO_ESTADO` notification for every resolvable `JEFE_CALIDAD_SYST`, excluding the acting user.

`ejecutar` SHALL notify the JCA users, and a return (`aprobada: false`) SHALL notify the responsable.

When `POST .../acciones-correctivas` sets a `responsableId`, or `PATCH .../:acId` changes `responsableId` to a different value, the handler SHALL create an `ASIGNACION` notification for that responsable, excluding the acting user and any unresolvable id.

Fixtures SHALL include an AC in `COMPLETADA` with evidence files and a historical `CERRADA` AC with `evidenciaUrl`.

#### Scenario: GET returns the QE's AC array
- **WHEN** `GET /api/quality-events/qe-2026-005/acciones-correctivas` is requested for a QE with 2 ACs
- **THEN** the response is 200 with `data` being an array of 2 ACs, each with `qeId: 'qe-2026-005'`

#### Scenario: POST appends a new AC with PENDIENTE estado
- **WHEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas` is requested with a valid AC payload
- **THEN** the response is 201 with the new AC having `estado: 'PENDIENTE'` and `qeId: 'qe-2026-005'`, and the QE's `accionesCorrectivas` array grows by 1

#### Scenario: PATCH status to CERRADA returns 422
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA', descripcionEvidencia: 'Evidencia adjunta' }`
- **THEN** the response status is 422 with `errorCode: 'USAR_FLUJO_VERIFICACION'`

#### Scenario: Non-responsable cannot execute
- **WHEN** a user who is not the AC's responsable calls `POST …/:acId/ejecutar`
- **THEN** the response is 403 with `errorCode: 'SOLO_RESPONSABLE_AC'`

#### Scenario: Verifying the last AC auto-transitions the QE to PENDIENTE_CIERRE
- **WHEN** a QE in `EN_EJECUCION` has 2 ACs, one already `CERRADA` with evidence and the other `COMPLETADA` with files, and the JCA approves the second
- **THEN** a follow-up `GET /api/quality-events/:id` shows the QE's `estado === 'PENDIENTE_CIERRE'` with an added `TRANSICION_AUTOMATICA` audit entry

#### Scenario: Verifying an AC while others remain open does not auto-transition the QE
- **WHEN** a QE in `EN_EJECUCION` has 2 ACs and only one is verified
- **THEN** the QE's `estado` remains `EN_EJECUCION`

#### Scenario: Verifying the last AC of a QE not in EN_EJECUCION does not auto-transition
- **WHEN** all ACs of a QE in `ANALISIS_COMPLETADO` end up `CERRADA` with evidence
- **THEN** the QE's `estado` remains `ANALISIS_COMPLETADO` (the auto-transition only applies from `EN_EJECUCION`)

#### Scenario: Auto-transition to PENDIENTE_CIERRE notifies JEFE_CALIDAD_SYST users
- **WHEN** verifying the last open AC triggers the automatic transition to `PENDIENTE_CIERRE`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable user with role `JEFE_CALIDAD_SYST`, excluding whoever verified

#### Scenario: New AC with a responsableId notifies that responsable
- **WHEN** `POST /api/quality-events/:id/acciones-correctivas` is requested with `responsableId: 'user-operario-002'` distinct from the acting user
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'`

#### Scenario: Reassigning an AC's responsableId notifies the new responsable
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId` changes `responsableId` from `'user-operario-001'` to `'user-operario-002'`
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'` and none is created for `'user-operario-001'`

---

### Requirement: QEACSection notifies JEFE_CALIDAD_SYST and SUPERVISOR on auto-transition to PENDIENTE_CIERRE
When the close-AC mutation's response indicates the QE's `estado` changed to `PENDIENTE_CIERRE` (compared against the QE's `estado` prop before the mutation), `QEACSection` SHALL show a Sonner `toast.info` confirming the closure request was recorded, visible to the acting user regardless of their role. `QEHeaderSection` SHALL additionally render an informational `DeadlineBadge`-style badge while `qe.estado === 'PENDIENTE_CIERRE'`, computed as 5 business days from the `TRANSICION_AUTOMATICA` audit entry's timestamp, with no functional blocking if the 5 days elapse (informational only in this version). The actual notification of `JEFE_CALIDAD_SYST` users that they must sign the closure SHALL be delivered as a real, persisted `CAMBIO_ESTADO` notification (per the `MSW sub-resource endpoints for QE-owned ACs` requirement above), not as toast copy naming those roles.

#### Scenario: Acting user sees a closure-recorded toast
- **WHEN** the AC-close mutation response shows the QE transitioned to `PENDIENTE_CIERRE`
- **THEN** a `toast.info` confirming the closure request was recorded is shown to the acting user

#### Scenario: The toast does not claim other roles were notified
- **WHEN** the AC-close mutation response shows the QE transitioned to `PENDIENTE_CIERRE`
- **THEN** the toast text does not reference `JEFE_CALIDAD_SYST` or `SUPERVISOR` being notified — that delivery happens via the persisted notification instead

#### Scenario: Informational plazo badge shown in PENDIENTE_CIERRE
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `estado: 'PENDIENTE_CIERRE'`
- **THEN** an informational badge showing days remaining of the 5-business-day reference plazo is visible, with no disabled or blocked action tied to it

---

### Requirement: QEACSection shows a pending-AC-requests banner for JEFE_CALIDAD_SYST
When `qe.solicitudesAC > 0`, `QEACSection` SHALL render a banner visible only to `JEFE_CALIDAD_SYST` reading "N solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala." (N = `qe.solicitudesAC`). The banner SHALL NOT render when `solicitudesAC` is 0 or for other roles.

The banner SHALL include only a "Descartar solicitud" button (opens a reason modal, 20–500 characters; not when `readOnly`). The banner MUST NOT include its own "Crear AC" button: ACs are created with the "Nueva AC" button in the section header, which opens the same add-AC modal. Creating an AC consumes one pending request server-side, and dismissing consumes one with a reason; both refresh the QE detail, the QE list and the dashboard so the banner, the list badge and RN-QE-009 update immediately.

#### Scenario: Banner shown for JEFE_CALIDAD_SYST when solicitudesAC > 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `JEFE_CALIDAD_SYST`
- **THEN** a banner reading "2 solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala." is visible

#### Scenario: Banner hidden when solicitudesAC is 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 0`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner hidden for other roles
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `SUPERVISOR`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner offers only Descartar solicitud
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 1`, `qeEstado: 'EN_INVESTIGACION'` and role `JEFE_CALIDAD_SYST`
- **THEN** the banner shows "Descartar solicitud" and no "Crear AC" button, and the section header shows "Nueva AC"

#### Scenario: Creating from Nueva AC clears the banner
- **WHEN** the JCA creates an AC from "Nueva AC" on a QE with `solicitudesAC === 1` and the refreshed QE comes back with `solicitudesAC === 0`
- **THEN** the banner is no longer rendered

#### Scenario: Read-only hides banner actions
- **WHEN** `QEACSection` renders with `readOnly` and `qe.solicitudesAC === 1` for a JEFE_CALIDAD_SYST
- **THEN** the banner text is shown without "Descartar solicitud"

### Requirement: QEACSection crea AC con tipo y responsable validado por tipo
La creación de AC desde `QEACSection` (y desde "Crear AC" del asistente IA en `QEInvestigationSection`) SHALL enviar `tipo` en el body de `POST /api/quality-events/:id/acciones-correctivas` y SHALL elegir el responsable solo entre los candidatos de `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` (ver capability `ac-tipo-responsables`). Un error de validación de `responsableId` devuelto por el servidor SHALL mostrarse en el campo.

#### Scenario: Body con tipo
- **WHEN** el JCA guarda una AC con tipo `PREVENTIVA`
- **THEN** el `POST` incluye `tipo: 'PREVENTIVA'` y la AC aparece en la lista con el badge "Preventiva"

### Requirement: Panel de ajuste de plazo muestra el nombre del solicitante
`AjustePlazoPanel` SHALL resolver el nombre de `solicitud.solicitadoPorId` con `useUserNames` (`GET /api/users/nombres`) y MUST NOT mostrar el id; si no se resuelve SHALL mostrar "Usuario no disponible".

#### Scenario: Solicitud pendiente
- **WHEN** una AC tiene una solicitud de ajuste de plazo pendiente
- **THEN** el panel muestra "Solicitado por {nombre del solicitante}"

### Requirement: Mensaje de lista vacía de candidatos orientado por rol
Cuando la lista de candidatos a responsable para el tipo elegido viene vacía, `QEACSection` SHALL mostrar "No hay usuarios activos que puedan ser responsables de este tipo de acción." seguido de "Revisa la configuración en Usuarios → Responsables de acciones correctivas." si el usuario es ADMINISTRADOR_EMPRESA, o de "Consulta al administrador de tu empresa." para cualquier otro rol.

#### Scenario: Lista vacía para el JCA
- **WHEN** un JEFE_CALIDAD_SYST elige un tipo sin candidatos
- **THEN** el formulario muestra el mensaje de lista vacía y "Consulta al administrador de tu empresa."

#### Scenario: Lista vacía para el ADMINISTRADOR_EMPRESA
- **WHEN** un ADMINISTRADOR_EMPRESA ve el formulario con un tipo sin candidatos
- **THEN** el mensaje incluye "Revisa la configuración en Usuarios → Responsables de acciones correctivas."
