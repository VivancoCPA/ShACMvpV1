## MODIFIED Requirements

### Requirement: PATCH /api/incidents/:id/status with transition validation
The handler MUST validate that the requested estado is a valid transition from the current estado, then update and return 200 or 422. On a valid transition, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) targeting the incident's `reportadoPorId` and the responsables of any of the incident's `accionesCorrectivas` not in a closed state, excluding the acting user and any unresolvable id (RN-NOTIF-001).

#### Scenario: Valid transition succeeds
- **WHEN** `PATCH /api/incidents/inc-003/status` is called with `{ estado: 'EN_INVESTIGACION' }` and current estado is `ABIERTO`
- **THEN** the response is 200 and `data.estado` is `'EN_INVESTIGACION'`

#### Scenario: Invalid transition returns 422
- **WHEN** `PATCH /api/incidents/inc-001/status` is called with `{ estado: 'ABIERTO' }` and current estado is `CERRADO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Audit trail entry added on status change
- **WHEN** a valid status transition is made
- **THEN** a new `AuditTrailEntry` is appended to the incident's `auditTrail` with `estadoAnterior` and `estadoNuevo`

#### Scenario: Valid transition notifies the reporter
- **WHEN** `PATCH /api/incidents/inc-003/status` transitions from `ABIERTO` to `EN_INVESTIGACION` and the acting user is not the incident's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the incident's `reportadoPorId`

#### Scenario: Acting reporter does not notify themselves
- **WHEN** the acting user performing the transition is the incident's `reportadoPorId`
- **THEN** no notification is created for the acting user
