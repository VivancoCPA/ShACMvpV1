# ac-section

Inline Acciones Correctivas management embedded in `NonconformityDetailPage`. Displays the AC list, exposes per-state transition buttons, and provides an inline create form. Uses `DeadlineBadge` for deadline visualization.

## ADDED Requirements

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

### Requirement: ACSection renders Agregar AC button for authorized roles on non-terminal NCs
The system SHALL render an "Agregar AC" button only when `getNCPermissions(nc, userRole).canAsignarAC === true` AND `nc.estado` is not `'CERRADA'` or `'ANULADA'`. Clicking "Agregar AC" SHALL expand an inline create form below the AC list. Only one inline form SHALL be visible at a time.

#### Scenario: Agregar AC button visible for SUPERVISOR on active NC
- **WHEN** a user with role `SUPERVISOR` renders `ACSection` for an NC in `EN_CORRECCION` state
- **THEN** the "Agregar AC" button is visible

#### Scenario: Agregar AC button not visible for OPERARIO
- **WHEN** a user with role `OPERARIO` renders `ACSection`
- **THEN** no "Agregar AC" button appears

#### Scenario: Agregar AC button not visible when NC is CERRADA
- **WHEN** `nc.estado === 'CERRADA'` regardless of role
- **THEN** no "Agregar AC" button appears

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

### Requirement: Each AC row shows contextual transition buttons based on ACStatus
The system SHALL render per-AC action buttons based on the AC's current `estado`:
- `PENDIENTE`: "Iniciar" button (calls `useUpdateAccionCorrectiva(ncId).mutate({ acId, data: { estado: 'EN_EJECUCION' } })`).
- `EN_EJECUCION`: "Completar" button (calls `useUpdateAccionCorrectiva(ncId).mutate({ acId, data: { estado: 'COMPLETADA' } })`).
- `COMPLETADA`: "Cerrar con evidencia" button, visible only when `getNCPermissions(nc, userRole).canCerrarAC === true` (opens evidence modal).
- `CERRADA` and `VENCIDA`: No action buttons.
Each transition button SHALL show a loading spinner while the mutation is in-flight for that AC (not blocking the whole section).

#### Scenario: PENDIENTE AC shows Iniciar button
- **WHEN** an `AccionCorrectiva` has `estado === 'PENDIENTE'`
- **THEN** an "Iniciar" button is visible for that AC row

#### Scenario: EN_EJECUCION AC shows Completar button
- **WHEN** an `AccionCorrectiva` has `estado === 'EN_EJECUCION'`
- **THEN** a "Completar" button is visible and "Iniciar" is absent

#### Scenario: COMPLETADA AC shows Cerrar con evidencia only for canCerrarAC roles
- **WHEN** an `AccionCorrectiva` has `estado === 'COMPLETADA'` and user role is `SUPERVISOR` (canCerrarAC=false)
- **THEN** no "Cerrar con evidencia" button appears for that AC

#### Scenario: COMPLETADA AC shows Cerrar con evidencia for JEFE_CALIDAD_SYST
- **WHEN** an `AccionCorrectiva` has `estado === 'COMPLETADA'` and user role is `JEFE_CALIDAD_SYST`
- **THEN** "Cerrar con evidencia" button is visible

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
