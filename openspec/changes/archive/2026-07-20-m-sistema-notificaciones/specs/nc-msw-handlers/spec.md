## MODIFIED Requirements

### Requirement: PATCH /api/nonconformities/:id handler blocking closed/anulada edits
The system SHALL implement an MSW v2 handler for `PATCH /api/nonconformities/:id` that: (1) returns HTTP 404 if the NC does not exist; (2) returns HTTP 409 with `{ success: false, message: 'nonconformities:errors.editBlockedByStatus' }` if the NC `estado` is `'CERRADA'` or `'ANULADA'`; (3) otherwise applies the `UpdateNCInput` fields to the NC, updates `actualizadoEn`, appends an audit trail entry for each changed field, and returns HTTP 200 with the updated NC. When the applied fields change `estado` to a different value, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) targeting the NC's `reportadoPorId` and the responsables of any of the NC's `accionesCorrectivas` not in a closed state, excluding the acting user and any unresolvable id (RN-NOTIF-001).

#### Scenario: PATCH returns 409 when NC is in CERRADA state
- **WHEN** a client calls `PATCH /api/nonconformities/nc-cerrada` and that NC has `estado === 'CERRADA'`
- **THEN** the handler returns HTTP 409 with `message: 'nonconformities:errors.editBlockedByStatus'`

#### Scenario: PATCH returns 409 when NC is in ANULADA state
- **WHEN** a client calls `PATCH /api/nonconformities/nc-anulada` and that NC has `estado === 'ANULADA'`
- **THEN** the handler returns HTTP 409 with `message: 'nonconformities:errors.editBlockedByStatus'`

#### Scenario: PATCH updates allowed fields and records audit trail entry
- **WHEN** a client calls `PATCH /api/nonconformities/nc-001` with `{ causaRaiz: 'Falta de procedimiento' }` on an NC in `EN_INVESTIGACION` state
- **THEN** the handler returns HTTP 200 with `data.causaRaiz === 'Falta de procedimiento'` and a new `auditTrail` entry with `accion === 'CAMPO_EDITADO'` and `campoModificado === 'causaRaiz'`

#### Scenario: Changing estado notifies the reporter
- **WHEN** `PATCH /api/nonconformities/nc-001` is requested with `{ estado: 'EN_INVESTIGACION' }` by a user other than the NC's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to `nc.reportadoPorId`

#### Scenario: Editing a field other than estado creates no state-change notification
- **WHEN** `PATCH /api/nonconformities/nc-001` is requested with `{ causaRaiz: 'Falta de procedimiento' }` only, not changing `estado`
- **THEN** no `CAMBIO_ESTADO` notification is created for this request

#### Scenario: Acting user changing their own NC's estado does not notify themselves
- **WHEN** `PATCH /api/nonconformities/:id` changes `estado` and the acting user is the NC's `reportadoPorId`
- **THEN** no notification is created for the acting user
