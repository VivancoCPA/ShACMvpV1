## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: ACSection shows a "Ver en QE" link for each AC when the NC has a generated Quality Event
The system SHALL render, for each AC row, a "Ver en QE →" link that navigates to `/quality-events/{nc.qeGeneradoId}` whenever `nc.qeGeneradoId` is populated. This link SHALL be shown in addition to (not instead of) the AC's own read-only fields (`descripcion`, `responsableNombre`, `plazoFecha`, `estado`, evidencia). When `nc.qeGeneradoId` is not populated, this link SHALL NOT appear.

#### Scenario: Ver en QE link appears on each AC row when NC has a generated QE
- **WHEN** `nc.qeGeneradoId` is populated and the AC list is non-empty
- **THEN** each AC row shows a "Ver en QE →" link that navigates to `/quality-events/{nc.qeGeneradoId}`

#### Scenario: Ver en QE link absent when NC has no generated QE
- **WHEN** `nc.qeGeneradoId` is not populated
- **THEN** no "Ver en QE" link is rendered on any AC row

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
