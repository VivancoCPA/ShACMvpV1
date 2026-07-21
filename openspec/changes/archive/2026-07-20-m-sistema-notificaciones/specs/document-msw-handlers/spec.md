## MODIFIED Requirements

### Requirement: POST /api/documents/:id/status transition handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/status` that validates the state transition using `DOC_STATUS_TRANSITIONS`, enforces RN-DOC-001 through RN-DOC-006, and records an `AuditTrailEntry` for each successful transition. The handler SHALL require a non-empty `firma` field in the request body (RN-DOC-004). When the transition is `estado: 'BORRADOR'` from `'EN_REVISION'` (a rejection) and the request body includes `notificarAutor: true`, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification` from `notification-generation`) targeting the document's `autorId`, excluding the acting user, silently skipping if `autorId` is not a resolvable account. When `notificarAutor` is absent or `false`, no notification SHALL be created for the rejection. All responses SHALL be delayed by 400 ms.

#### Scenario: Valid transition updates estado and records audit trail
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'EN_REVISION', firma: '1234' }`
- **THEN** the response status is 200, `data.estado` is `'EN_REVISION'`, and `data.auditTrail` contains a new entry with `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Invalid transition rejects with 422 (RN-DOC-001 / state machine)
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'PUBLICADO', firma: '1234' }` (BORRADOR → PUBLICADO is not a valid transition)
- **THEN** the response status is 422 and `success` is `false`

#### Scenario: Publishing obsoletes the previous published version (RN-DOC-001)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`
- **THEN** any other document in the in-memory store with the same `codigo` and `estado === 'PUBLICADO'` is set to `OBSOLETO`

#### Scenario: Missing firma field rejects with 400 (RN-DOC-004)
- **WHEN** `POST /api/documents/:id/status` is requested without a `firma` field
- **THEN** the response status is 400 and `success` is `false`

#### Scenario: Transitioning linked PUBLICADO document to OBSOLETO is blocked if QE active (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` requests `OBSOLETO` on a document that has `qeVinculados` containing an active QE id
- **THEN** the response status is 409 and the error message references the linked QE

#### Scenario: Rejection with notificarAutor true creates a real notification for the author
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: true, motivo: 'Falta evidencia' }` on a document in `EN_REVISION`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the document's `autorId`, referencing the document's `codigo`

#### Scenario: Rejection with notificarAutor false creates no notification
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: false }` on a document in `EN_REVISION`
- **THEN** no notification is created for this transition

### Requirement: POST /api/documents create handler
The system SHALL provide an MSW v2 handler for `POST /api/documents` that creates a new document in `BORRADOR` state, generates a unique `id` (UUID v4 pattern), assigns the next available `codigo` for the given `tipo`, sets `version` to `v1.0`, and appends the document to the in-memory store. When `revisorId` and/or `aprobadorId` are set on creation, the handler SHALL create an `ASIGNACION` notification (via `createAsignacionNotification`) for each, targeting that person, silently skipping any that is not a resolvable account or that equals the acting (creating) user. All responses SHALL be delayed by 400 ms.

#### Scenario: Create handler returns new BORRADOR document
- **WHEN** `POST /api/documents` is requested with a valid `CreateDocumentInput` body
- **THEN** the response status is 201, `data.estado` is `'BORRADOR'`, `data.version` is `'v1.0'`, and `data.id` is a non-empty string

#### Scenario: Create handler stores the new document
- **WHEN** a document is created via `POST /api/documents`
- **THEN** a subsequent `GET /api/documents/:id` with the returned `id` returns the same document

#### Scenario: Creating a document with a revisorId notifies that revisor
- **WHEN** `POST /api/documents` is requested with `revisorId: 'user-supervisor-001'` distinct from the acting user
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-supervisor-001'`

### Requirement: PUT /api/documents/:id update handler
The system SHALL provide an MSW v2 handler for `PUT /api/documents/:id` that applies partial updates to the document. The handler SHALL reject updates to documents not in `BORRADOR` state with a 409 response. When the update changes `revisorId` and/or `aprobadorId` to a new value (create-or-change), the handler SHALL create an `ASIGNACION` notification for the newly assigned person, following the same resolvable-account and not-self-notifying rules as the create handler. All responses SHALL be delayed by 400 ms.

#### Scenario: Update handler applies changes to BORRADOR document
- **WHEN** `PUT /api/documents/doc-borrador-id` is requested with `{ titulo: 'Nuevo Título' }`
- **THEN** the response status is 200 and `data.titulo` is `'Nuevo Título'`

#### Scenario: Update handler rejects changes to non-BORRADOR document
- **WHEN** `PUT /api/documents/doc-publicado-id` is requested for a PUBLICADO document
- **THEN** the response status is 409 and `success` is `false`

#### Scenario: Changing aprobadorId notifies the newly assigned aprobador
- **WHEN** `PUT /api/documents/doc-borrador-id` is requested with `{ aprobadorId: 'user-jefedocs-001' }`, changing it from a previous value
- **THEN** an `ASIGNACION` notification is created with `usuarioId: 'user-jefedocs-001'`
