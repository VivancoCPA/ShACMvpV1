## MODIFIED Requirements

### Requirement: PATCH /api/incidents/:id/status with transition validation
The handler MUST only accept `ABIERTO → ANULADO` for an incident without `qeId`. Any other requested estado, or an annulment of an incident that has a `qeId`, MUST return 422 with `success: false` and `errorCode: 'ESTADO_GOBERNADO_POR_QE'`, mirroring the backend. On a valid annulment, the handler SHALL update the estado, append an audit trail entry, and create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification`) targeting the incident's `reportadoPorId` and the responsables of any of the incident's `accionesCorrectivas` not in a closed state, excluding the acting user and any unresolvable id (RN-NOTIF-001).

#### Scenario: Valid annulment succeeds
- **WHEN** `PATCH /api/incidents/inc-003/status` is called with `{ estado: 'ANULADO' }`, the current estado is `ABIERTO` and the incident has no `qeId`
- **THEN** the response is 200 and `data.estado` is `'ANULADO'`

#### Scenario: Manual advance returns 422
- **WHEN** `PATCH /api/incidents/inc-003/status` is called with `{ estado: 'EN_INVESTIGACION' }`
- **THEN** the response status is 422 with `errorCode: 'ESTADO_GOBERNADO_POR_QE'`

#### Scenario: Audit trail entry added on annulment
- **WHEN** a valid annulment is made
- **THEN** a new `AuditTrailEntry` is appended to the incident's `auditTrail` with `estadoAnterior` and `estadoNuevo`

#### Scenario: Valid annulment notifies the reporter
- **WHEN** an incident is annulled and the acting user is not the incident's `reportadoPorId`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the incident's `reportadoPorId`

#### Scenario: Acting reporter does not notify themselves
- **WHEN** the acting user performing the annulment is the incident's `reportadoPorId`
- **THEN** no notification is created for the acting user

## ADDED Requirements

### Requirement: PATCH /api/incidents/:id rejects qeId changes
The handler MUST return 422 with `errorCode: 'QE_VINCULO_GESTIONADO_POR_QE'` when the body carries a `qeId` different from the incident's current `qeId`, without mutating the incident.

#### Scenario: qeId change rejected
- **WHEN** `PATCH /api/incidents/inc-003` is called with `{ qeId: 'qe-x' }` and the incident has no `qeId`
- **THEN** the response status is 422 with `errorCode: 'QE_VINCULO_GESTIONADO_POR_QE'`
