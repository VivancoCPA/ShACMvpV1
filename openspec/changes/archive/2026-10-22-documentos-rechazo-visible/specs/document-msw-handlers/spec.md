## ADDED Requirements

### Requirement: PATCH /api/documents/:id/status transition handler
The system SHALL provide an MSW v2 handler for `PATCH /api/documents/:id/status` (the handler actually used by the frontend's status-change actions, including `DocumentRejectModal` — see `document-approval-flow`) that accepts `{ estado, motivo?, notificarAutor? }`, validates the transition using `DOC_STATUS_TRANSITIONS`, and records an `AuditTrailEntry` for each successful transition. For the three transitions that land on `BORRADOR`, it SHALL record the entry with the action matching the real transition, with `motivo` stored in a `motivo` field (never in `valorAnterior`):
- `EN_REVISION → BORRADOR` with `motivo` present → `accion: 'RECHAZADO_EN_REVISION'`.
- `EN_APROBACION → BORRADOR` → `accion: 'RECHAZADO_EN_APROBACION'`.
- `EN_REVISION → BORRADOR` without `motivo` → `accion: 'REVISION_CANCELADA'`, no `motivo`.

All other transitions SHALL keep recording `accion: 'ESTADO_CAMBIADO'` as before. All responses SHALL be delayed by 400 ms (`LATENCY`).

#### Scenario: Valid non-rejection transition still records ESTADO_CAMBIADO
- **WHEN** `PATCH /api/documents/doc-borrador-id/status` is requested with `{ estado: 'EN_REVISION' }`
- **THEN** the response status is 200, `data.estado` is `'EN_REVISION'`, and `data.auditTrail` contains a new entry with `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Rejection from EN_REVISION with motivo records RECHAZADO_EN_REVISION
- **WHEN** `PATCH /api/documents/:id/status` is requested with `{ estado: 'BORRADOR', motivo: 'Falta evidencia fotográfica.', notificarAutor: true }` on a document in `EN_REVISION`
- **THEN** the response status is 200 and `data.auditTrail` contains a new entry with `accion: 'RECHAZADO_EN_REVISION'`, `estadoAnterior: 'EN_REVISION'`, `estadoNuevo: 'BORRADOR'`, and `motivo: 'Falta evidencia fotográfica.'`

#### Scenario: Rejection from EN_APROBACION records RECHAZADO_EN_APROBACION
- **WHEN** `PATCH /api/documents/:id/status` is requested with `{ estado: 'BORRADOR', motivo: 'Documento incompleto.', notificarAutor: true }` on a document in `EN_APROBACION`
- **THEN** the response status is 200 and `data.auditTrail` contains a new entry with `accion: 'RECHAZADO_EN_APROBACION'`, `estadoAnterior: 'EN_APROBACION'`, `estadoNuevo: 'BORRADOR'`, and the given `motivo`

#### Scenario: Cancellation from EN_REVISION without motivo records REVISION_CANCELADA
- **WHEN** `PATCH /api/documents/:id/status` is requested with `{ estado: 'BORRADOR' }` (no `motivo`) on a document in `EN_REVISION`
- **THEN** the response status is 200 and `data.auditTrail` contains a new entry with `accion: 'REVISION_CANCELADA'`, `estadoAnterior: 'EN_REVISION'`, `estadoNuevo: 'BORRADOR'`, and no `motivo` field

#### Scenario: Invalid transition rejects with 422
- **WHEN** `PATCH /api/documents/doc-borrador-id/status` is requested with `{ estado: 'PUBLICADO' }` (BORRADOR → PUBLICADO is not a valid transition)
- **THEN** the response status is 422 and `success` is `false`

#### Scenario: Rejection with notificarAutor true creates a real notification for the author
- **WHEN** `PATCH /api/documents/:id/status` is requested with `{ estado: 'BORRADOR', motivo: 'Falta evidencia', notificarAutor: true }` on a document in `EN_REVISION`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the document's `autorId`, referencing the document's `codigo`
