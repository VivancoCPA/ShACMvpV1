# Spec: ac-section

## Purpose

Inline Acciones Correctivas management embedded in `NonconformityDetailPage`. Displays the AC list, exposes per-state transition buttons, and provides an inline create form. Uses `DeadlineBadge` for deadline visualization.

---

## Requirements

### Requirement: ACSection renders the AC list with all required fields
The system SHALL render an `ACSection` component in `src/features/nonconformities/components/ACSection.tsx` that receives `ncId: string`, `acciones: AccionCorrectiva[]`, and `nc: NoConformidad` as props. For each AC in `acciones`, it SHALL display:
- `descripcion` (truncated to 2 lines with ellipsis if longer).
- `responsableNombre`.
- `plazoFecha` formatted as dd/mm/yyyy, wrapped in `DeadlineBadge` showing urgency color.
- `estado` via an `ACStatusBadge` (local badge component or inline Tailwind classes for each state).
- `descripcionEvidencia` and `evidenciaUrl` link when `estado === 'CERRADA'`.

#### Scenario: ACSection renders plazoFecha inside DeadlineBadge
- **WHEN** `ACSection` renders an AC with `plazoFecha` 3 days from today
- **THEN** a `DeadlineBadge` with yellow styling is shown for that AC

#### Scenario: ACSection shows evidencia info when AC is CERRADA
- **WHEN** an `AccionCorrectiva` has `estado === 'CERRADA'` and `descripcionEvidencia` set
- **THEN** the description of evidence is visible in the AC row

#### Scenario: ACSection shows empty state when acciones is empty
- **WHEN** `acciones` prop is an empty array
- **THEN** a message from `t('nonconformities:acSection.empty')` is rendered in place of the list

---

### Requirement: ACSection renders Agregar AC button for authorized roles on non-terminal NCs
The system SHALL render an "Agregar AC" button only when `getNCPermissions(nc, userRole).canAsignarAC === true` AND `nc.estado` is not `'CERRADA'` or `'ANULADA'` AND `nc.qeGeneradoId` is not populated. Clicking "Agregar AC" SHALL expand an inline create form below the AC list. Only one inline form SHALL be visible at a time.

#### Scenario: Agregar AC button visible for SUPERVISOR on active NC
- **WHEN** a user with role `SUPERVISOR` renders `ACSection` for an NC in `EN_CORRECCION` state
- **THEN** the "Agregar AC" button is visible

#### Scenario: Agregar AC button not visible for OPERARIO
- **WHEN** a user with role `OPERARIO` renders `ACSection`
- **THEN** no "Agregar AC" button appears

#### Scenario: Agregar AC button not visible when NC is CERRADA
- **WHEN** `nc.estado === 'CERRADA'` regardless of role
- **THEN** no "Agregar AC" button appears

#### Scenario: Agregar AC button not visible when NC has a generated Quality Event
- **WHEN** `nc.qeGeneradoId` is populated, regardless of role or `nc.estado`
- **THEN** no "Agregar AC" button appears

---

### Requirement: ACSection inline create form with validation
The system SHALL render an inline form (not a modal) when "Agregar AC" is clicked, containing:
- `descripcion`: `<textarea>`, required, min 5 chars.
- `responsableId`: `<select>` populated from `GET /api/users` via a query hook, displaying `nombre + apellido` per option. Options SHALL load asynchronously; a loading placeholder SHALL appear while fetching.
- `plazoFecha`: `<input type="date">`, required.
Submitting the form SHALL call `useCreateAccionCorrectiva(ncId).mutate(data)`. The form SHALL close on success or when the user clicks "Cancelar".

#### Scenario: Inline form appears when Agregar AC is clicked
- **WHEN** a user clicks "Agregar AC"
- **THEN** the inline form with descripcion textarea, responsableId select, and plazoFecha input is visible

#### Scenario: responsableId select loads user options from /api/users
- **WHEN** the inline form is open and the users query resolves
- **THEN** the responsableId select contains one option per fixture user

#### Scenario: Inline form closes on successful AC creation
- **WHEN** `useCreateAccionCorrectiva` resolves successfully
- **THEN** the inline form is hidden and the new AC appears in the list (after query invalidation)

#### Scenario: Submitting inline form with empty descripcion shows validation error
- **WHEN** the user submits the inline form without filling in `descripcion`
- **THEN** a Zod validation error appears below the textarea

---

### Requirement: Each AC row shows contextual transition buttons based on ACStatus
The system SHALL render per-AC action buttons based on the AC's current `estado`, only when `nc.qeGeneradoId` is not populated:
- `PENDIENTE`: "Iniciar" button (calls `useUpdateAccionCorrectiva(ncId).mutate({ acId, data: { estado: 'EN_EJECUCION' } })`).
- `EN_EJECUCION`: "Completar" button (calls `useUpdateAccionCorrectiva(ncId).mutate({ acId, data: { estado: 'COMPLETADA' } })`).
- `COMPLETADA`: "Cerrar con evidencia" button, visible only when `getNCPermissions(nc, userRole).canCerrarAC === true` (opens evidence modal).
- `CERRADA` and `VENCIDA`: No action buttons.
Each transition button SHALL show a loading spinner while the mutation is in-flight for that AC (not blocking the whole section). When `nc.qeGeneradoId` is populated, no transition or close buttons SHALL be rendered for any AC regardless of `estado` or role.

#### Scenario: PENDIENTE AC shows Iniciar button
- **WHEN** an `AccionCorrectiva` has `estado === 'PENDIENTE'` and `nc.qeGeneradoId` is not populated
- **THEN** an "Iniciar" button is visible for that AC row

#### Scenario: EN_EJECUCION AC shows Completar button
- **WHEN** an `AccionCorrectiva` has `estado === 'EN_EJECUCION'` and `nc.qeGeneradoId` is not populated
- **THEN** a "Completar" button is visible and "Iniciar" is absent

#### Scenario: COMPLETADA AC shows Cerrar con evidencia only for canCerrarAC roles
- **WHEN** an `AccionCorrectiva` has `estado === 'COMPLETADA'` and user role is `SUPERVISOR` (canCerrarAC=false)
- **THEN** no "Cerrar con evidencia" button appears for that AC

#### Scenario: COMPLETADA AC shows Cerrar con evidencia for JEFE_CALIDAD_SYST
- **WHEN** an `AccionCorrectiva` has `estado === 'COMPLETADA'` and user role is `JEFE_CALIDAD_SYST` and `nc.qeGeneradoId` is not populated
- **THEN** "Cerrar con evidencia" button is visible

#### Scenario: No transition buttons when NC has a generated Quality Event
- **WHEN** `nc.qeGeneradoId` is populated
- **THEN** no "Iniciar", "Completar", or "Cerrar con evidencia" button is rendered for any AC in the list, regardless of role or `estado`

---

### Requirement: Evidence closure modal with required descripcionEvidencia
The system SHALL render a modal overlay when the user clicks "Cerrar con evidencia". The modal SHALL contain:
- `descripcionEvidencia`: `<textarea>`, required, min 1 char.
- `evidenciaUrl`: `<input type="url">`, optional, displayed as "URL de evidencia adjunta".
- "Confirmar cierre" button that calls `useCerrarAccionCorrectiva(ncId).mutate({ acId, data })`.
- "Cancelar" button that closes the modal without submitting.
Submitting with empty `descripcionEvidencia` SHALL show a Zod validation error below the textarea.

#### Scenario: Evidence modal opens on Cerrar con evidencia click
- **WHEN** the user clicks "Cerrar con evidencia" on a COMPLETADA AC
- **THEN** a modal with `descripcionEvidencia` textarea and optional `evidenciaUrl` input is visible

#### Scenario: Evidence modal closes on successful AC closure
- **WHEN** `useCerrarAccionCorrectiva` resolves successfully
- **THEN** the modal closes and the AC row updates to show `estado === 'CERRADA'`

#### Scenario: Evidence modal shows error when descripcionEvidencia is empty
- **WHEN** the user submits the evidence modal with empty `descripcionEvidencia`
- **THEN** a validation error is shown and `mutate` is not called

---

### Requirement: AnularNCModal requires justificacion with minimum 20 characters
The system SHALL render an `AnularNCModal` component in `src/features/nonconformities/components/AnularNCModal.tsx`. The modal SHALL contain a `justificacion` textarea validated by `z.string().min(20, t('nonconformities:annul.errors.justificacionMin'))`. On submit, it calls `useAnularNonconformity().mutate({ id: ncId, justificacion })`. The modal closes on success (parent navigates away) or when the user clicks "Cancelar".

#### Scenario: AnularNCModal shows validation error for short justificacion
- **WHEN** the user types fewer than 20 characters in justificacion and clicks "Confirmar anulación"
- **THEN** a validation error message is shown below the textarea and the mutation is not called

#### Scenario: AnularNCModal calls useAnularNonconformity on valid submit
- **WHEN** the user types 25 characters in justificacion and submits
- **THEN** `useAnularNonconformity().mutate({ id: ncId, justificacion })` is called

#### Scenario: AnularNCModal Cancelar closes without mutation
- **WHEN** the user clicks "Cancelar" in the annulment modal
- **THEN** the modal closes and `mutate` is never called

---

### Requirement: ACSection renders a Ver QE link when the AC has qeId
When an `AccionCorrectiva` row has `qeId` set, `ACSection` SHALL render a "Ver QE → QE-2026-00N" link (using the QE's `numero`, resolved via the QE list/detail lookup) navigating to `/quality-events/{qeId}`. Rows without `qeId` SHALL NOT render this link.

#### Scenario: AC with qeId shows the Ver QE link
- **WHEN** an `AccionCorrectiva` row has `qeId: 'qe-2026-002'` resolving to `numero: 'QE-2026-002'`
- **THEN** a "Ver QE → QE-2026-002" link is visible on that row, navigating to `/quality-events/qe-2026-002`

#### Scenario: AC without qeId shows no Ver QE link
- **WHEN** an `AccionCorrectiva` row has `qeId` undefined
- **THEN** no "Ver QE" link is rendered on that row

---

### Requirement: ACSection shows a "Ver en QE" link for each AC when the NC has a generated Quality Event
The system SHALL render, for each AC row, a "Ver en QE →" link that navigates to `/quality-events/{nc.qeGeneradoId}` whenever `nc.qeGeneradoId` is populated. This link SHALL be shown in addition to (not instead of) the AC's own read-only fields (`descripcion`, `responsableNombre`, `plazoFecha`, `estado`, evidencia). When `nc.qeGeneradoId` is not populated, this link SHALL NOT appear.

#### Scenario: Ver en QE link appears on each AC row when NC has a generated QE
- **WHEN** `nc.qeGeneradoId` is populated and the AC list is non-empty
- **THEN** each AC row shows a "Ver en QE →" link that navigates to `/quality-events/{nc.qeGeneradoId}`

#### Scenario: Ver en QE link absent when NC has no generated QE
- **WHEN** `nc.qeGeneradoId` is not populated
- **THEN** no "Ver en QE" link is rendered on any AC row

---

### Requirement: ACSection allows requesting a new AC in the linked Quality Event
The system SHALL render a "Solicitar AC en QE" button when `nc.qeGeneradoId` is populated AND `getNCPermissions(nc, userRole).canAsignarAC === true`. The button SHALL appear below the AC list, or in the section header when `accionesCorrectivas` is empty. Clicking it SHALL call `PATCH /api/quality-events/{nc.qeGeneradoId}/solicitar-ac`. On success, a Sonner toast SHALL display a message indicating the request was sent and that the Jefe de Calidad will create the AC in the QE. The button SHALL be disabled while the mutation is pending (`isPending`).

#### Scenario: Solicitar AC en QE button visible for authorized role with linked QE
- **WHEN** `nc.qeGeneradoId` is populated and the current user has `canAsignarAC === true`
- **THEN** a "Solicitar AC en QE" button is visible

#### Scenario: Solicitar AC en QE button hidden without linked QE
- **WHEN** `nc.qeGeneradoId` is not populated
- **THEN** no "Solicitar AC en QE" button appears

#### Scenario: Solicitar AC en QE button hidden for unauthorized role
- **WHEN** `nc.qeGeneradoId` is populated and the current user has `canAsignarAC === false`
- **THEN** no "Solicitar AC en QE" button appears

#### Scenario: Clicking Solicitar AC en QE calls the QE endpoint and shows a success toast
- **WHEN** an authorized user clicks "Solicitar AC en QE"
- **THEN** `PATCH /api/quality-events/{nc.qeGeneradoId}/solicitar-ac` is called and a Sonner success toast is shown on completion

#### Scenario: Solicitar AC en QE button disables while pending
- **WHEN** the solicitar-ac mutation is in-flight (`isPending: true`)
- **THEN** the "Solicitar AC en QE" button is disabled

#### Scenario: Solicitar AC en QE button appears in section header when AC list is empty
- **WHEN** `nc.qeGeneradoId` is populated, the current user has `canAsignarAC === true`, and `accionesCorrectivas` is empty
- **THEN** the "Solicitar AC en QE" button is rendered in the section header rather than below a list
