## MODIFIED Requirements

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

#### Scenario: Auto-transition to PENDIENTE_CIERRE notifies JEFE_CALIDAD_SYST users
- **WHEN** verifying the last open AC triggers the automatic transition to `PENDIENTE_CIERRE`
- **THEN** a `CAMBIO_ESTADO` notification is created for every resolvable user with role `JEFE_CALIDAD_SYST`, excluding whoever verified

#### Scenario: New AC with a responsableId notifies that responsable
- **WHEN** `POST /api/quality-events/:id/acciones-correctivas` is requested with `responsableId: 'user-operario-002'` distinct from the acting user
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'`

#### Scenario: Reassigning an AC's responsableId notifies the new responsable
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId` changes `responsableId` from `'user-operario-001'` to `'user-operario-002'`
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-operario-002'` and none is created for `'user-operario-001'`
