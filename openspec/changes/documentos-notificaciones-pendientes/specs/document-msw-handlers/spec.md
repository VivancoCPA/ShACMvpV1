## MODIFIED Requirements

### Requirement: POST /api/documents/:id/status transition handler
The system SHALL provide an MSW v2 handler for `POST /api/documents/:id/status` that validates the state transition using `DOC_STATUS_TRANSITIONS`, enforces RN-DOC-001 through RN-DOC-006, and records an `AuditTrailEntry` for each successful transition. The handler SHALL require a non-empty `firma` field in the request body (RN-DOC-004). When the transition is `estado: 'BORRADOR'` from `'EN_REVISION'` (a rejection) and the request body includes `notificarAutor: true`, the handler SHALL create a `CAMBIO_ESTADO` notification (via `createCambioEstadoNotification` from `notification-generation`) targeting the document's `autorId`, excluding the acting user, silently skipping if `autorId` is not a resolvable account. When `notificarAutor` is absent or `false`, no notification SHALL be created for the rejection. All responses SHALL be delayed by 400 ms.

#### Scenario: Valid transition updates estado and records audit trail
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'EN_REVISION', firma: '1234' }`
- **THEN** the response status is 200, `data.estado` is `'EN_REVISION'`, and `data.auditTrail` contains a new entry with `accion: 'ESTADO_CAMBIADO'`

#### Scenario: Invalid transition rejects with 422 (RN-DOC-001 / state machine)
- **WHEN** `POST /api/documents/doc-borrador-id/status` is requested with `{ nuevoEstado: 'PUBLICADO', firma: '1234' }` (BORRADOR → PUBLICADO is not a valid transition)
- **THEN** the response status is 422 and `success` is `false`

#### Scenario: Publishing obsoletes the previous published version only if it has no active QE link (RN-DOC-001 + RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`, and another document in the in-memory store has the same `codigo`, `estado === 'PUBLICADO'`, and a `qeVinculados` (now `QeVinculadoResumen[]`, carrying each linked QE's `estado`) with every entry `CERRADO` or `VERIFICADO` (or empty)
- **THEN** that other document is set to `OBSOLETO`

#### Scenario: Publishing is rejected when the prior published version has an active QE link (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` transitions a document to `PUBLICADO`, and the prior `PUBLICADO` document with the same `codigo` has a `qeVinculados` entry with `estado` other than `CERRADO`/`VERIFICADO`
- **THEN** the response status is 409, the error message references the blocking QE's `numero`, and neither document's `estado` changes — this closes a pre-existing gap where the auto-obsoletion loop never checked the prior version's `qeVinculados` at all (RN-DOC-005 previously only guarded a direct manual `OBSOLETO` request, a transition no UI ever triggers)

#### Scenario: Missing firma field rejects with 400 (RN-DOC-004)
- **WHEN** `POST /api/documents/:id/status` is requested without a `firma` field
- **THEN** the response status is 400 and `success` is `false`

#### Scenario: Direct manual transition to OBSOLETO is blocked only if a linked QE is not CERRADO/VERIFICADO (RN-DOC-005)
- **WHEN** `POST /api/documents/:id/status` directly requests `OBSOLETO` (the `PUBLICADO → OBSOLETO` entry in `DOC_STATUS_TRANSITIONS`, unreachable from any current UI action but still a valid request shape) on a document whose `qeVinculados` includes at least one entry with `estado` other than `CERRADO` or `VERIFICADO`
- **THEN** the response status is 409 and the error message references the blocking QE's `numero`

#### Scenario: Direct manual transition to OBSOLETO succeeds when every linked QE is closed or verified
- **WHEN** `POST /api/documents/:id/status` directly requests `OBSOLETO` on a document whose every `qeVinculados` entry has `estado` `CERRADO` or `VERIFICADO`
- **THEN** the response status is 200 and `data.estado` is `'OBSOLETO'`

#### Scenario: Rejection with notificarAutor true creates a real notification for the author
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: true, motivo: 'Falta evidencia' }` on a document in `EN_REVISION`
- **THEN** a `CAMBIO_ESTADO` notification is created with `usuarioId` equal to the document's `autorId`, referencing the document's `codigo`

#### Scenario: Rejection with notificarAutor false creates no notification
- **WHEN** `POST /api/documents/:id/status` is requested with `{ nuevoEstado: 'BORRADOR', firma: '1234', notificarAutor: false }` on a document in `EN_REVISION`
- **THEN** no notification is created for this transition

### Requirement: PATCH /api/documents/:id/status transition handler notifies the right person per transition
Beyond the existing rejection notification (`notificarAutor`), the `PATCH /api/documents/:id/status` handler SHALL create a notification for every other successful transition that has a clear next responsible person, using the same `createAsignacionNotification`/`createCambioEstadoNotification` helpers as the rest of the module, excluding the acting user and skipping any `null` recipient: `BORRADOR → EN_REVISION` creates an `ASIGNACION` notification for `revisorId`; `EN_REVISION → EN_APROBACION` creates an `ASIGNACION` notification for `aprobadorId`; `EN_REVISION → BORRADOR` without `motivo` (cancel review) creates `CAMBIO_ESTADO` notifications for `autorId` and `revisorId`; `PUBLICADO → EN_REVISION_PERIODICA` creates a `CAMBIO_ESTADO` notification for `autorId`. Each notification's `link` SHALL be `/documentos/{id}`.

#### Scenario: Sending to review notifies the assigned reviewer
- **WHEN** `PATCH /api/documents/:id/status` transitions a `BORRADOR` document with `revisorId` set (distinct from the acting user) to `EN_REVISION`
- **THEN** an `ASIGNACION` notification is created for `revisorId`

#### Scenario: Approving review notifies the assigned approver
- **WHEN** `PATCH /api/documents/:id/status` transitions an `EN_REVISION` document with `aprobadorId` set (distinct from the acting user) to `EN_APROBACION`
- **THEN** an `ASIGNACION` notification is created for `aprobadorId`

#### Scenario: Cancelling review (no motivo) notifies author and reviewer
- **WHEN** `PATCH /api/documents/:id/status` transitions an `EN_REVISION` document to `BORRADOR` without a `motivo` field
- **THEN** `CAMBIO_ESTADO` notifications are created for `autorId` and `revisorId`, excluding the acting user if it matches either

#### Scenario: Starting periodic review notifies the author
- **WHEN** `PATCH /api/documents/:id/status` transitions a `PUBLICADO` document to `EN_REVISION_PERIODICA`
- **THEN** a `CAMBIO_ESTADO` notification is created for `autorId`

#### Scenario: Acting user never notifies themselves
- **WHEN** the acting user is also the `revisorId`, `aprobadorId`, or `autorId` targeted by any of these transitions
- **THEN** no notification is created for that match

### Requirement: POST /api/documents/:id/sign handler publishes and notifies
When `POST /api/documents/:id/sign` transitions a document to `PUBLICADO`, the handler SHALL, in addition to its existing publish/obsolete-previous-version behavior, create `CAMBIO_ESTADO` notifications for the document's `autorId` and `revisorId`, excluding the acting user and skipping any `null` recipient.

#### Scenario: Publishing notifies author and reviewer
- **WHEN** `POST /api/documents/:id/sign` successfully publishes a document with `autorId` and `revisorId` both distinct from the acting (approving) user
- **THEN** `CAMBIO_ESTADO` notifications are created for both

### Requirement: POST /api/documents/:id/nueva-version handler notifies inherited assignees
When `POST /api/documents/:id/nueva-version` creates a new version that inherits `revisorId`/`aprobadorId` from the origin document, the handler SHALL create an `ASIGNACION` notification for each of them (excluding the acting user and any `null` value), referencing the new version's `codigo` and `version`.

#### Scenario: New version notifies inherited reviewer and approver
- **WHEN** a new version is created inheriting `revisorId` and `aprobadorId` from the origin document, both distinct from the acting user
- **THEN** `ASIGNACION` notifications are created for both, referencing the new document

### Requirement: GET /api/documents/pendientes/count — count pending docs for current user
The system SHALL provide an MSW v2 handler for `GET /api/documents/pendientes/count` that applies the exact same pendientes rule as `filterPendientes` used by `GET /api/documents?pendientes=true`, scoped to `empresaId` matching the session's active empresa and `deletedAt` absent, AND the same confidencialidad rule already applied by the list handler (`CONFIDENCIAL`/`RESTRINGIDO` visibility by role/`rolesAutorizados`). There SHALL be no role-based early return to `{ count: 0 }` — every role is evaluated through the same assignment-based rule.

#### Scenario: Count matches the filtered list
- **WHEN** the same session requests `GET /api/documents/pendientes/count` and then `GET /api/documents?pendientes=true`
- **THEN** `count` equals the number of items returned by the list

#### Scenario: Confidencialidad-restricted documents are excluded from the count
- **WHEN** a document would otherwise count as pendiente for the actor but is `RESTRINGIDO` without the actor's role in `rolesAutorizados`
- **THEN** it is not included in `count`

#### Scenario: No role returns zero unconditionally anymore
- **WHEN** an `OPERARIO` who authored a `BORRADOR` document requests `GET /api/documents/pendientes/count`
- **THEN** the count reflects that `BORRADOR`, not `0`

### Requirement: filterPendientes applies assignment-only rules
`filterPendientes(docs, userId, userRole)` SHALL compute pendientes using only direct assignment on each document, equally for every role: `estado === 'BORRADOR' && autorId === userId`; `estado === 'EN_REVISION' && revisorId === userId`; `estado === 'EN_APROBACION' && aprobadorId === userId`. The only role-dependent branch SHALL be `estado === 'EN_REVISION_PERIODICA'`, included for `JEFE_CALIDAD_SYST` and `JEFE_CONTROL_DOCUMENTARIO` only. The previous `SUPERVISOR`-only EN_REVISION branch, the `NON_PENDING_ROLES` short-circuit, and the "JEFE_CALIDAD_SYST sees every EN_REVISION" branch SHALL be removed.

#### Scenario: Author sees their own BORRADOR
- **WHEN** `filterPendientes` runs for the `autorId` of a `BORRADOR` document, regardless of their `UserRole`
- **THEN** that document is included

#### Scenario: AUDITOR_INTERNO sees their assigned EN_REVISION
- **WHEN** `filterPendientes` runs for an `AUDITOR_INTERNO` who is the `revisorId` of an `EN_REVISION` document
- **THEN** that document is included

#### Scenario: ALTA_DIRECCION sees their assigned EN_APROBACION
- **WHEN** `filterPendientes` runs for an `ALTA_DIRECCION` who is the `aprobadorId` of an `EN_APROBACION` document
- **THEN** that document is included

#### Scenario: JEFE_CALIDAD_SYST without assignment no longer sees every EN_REVISION
- **WHEN** `filterPendientes` runs for a `JEFE_CALIDAD_SYST` who is not the `revisorId` of an `EN_REVISION` document
- **THEN** that document is NOT included solely by virtue of their role

## ADDED Requirements

### Requirement: PATCH /api/documents/:id/restaurar restricted by role
The MSW handler for `PATCH /api/documents/:id/restaurar` SHALL verify the acting user's role from the session before restoring the document: only `JEFE_CALIDAD_SYST` and `ALTA_DIRECCION` SHALL be allowed. Any other role SHALL receive a 403 response, with the document left unchanged (still `deletedAt` set).

#### Scenario: JEFE_CALIDAD_SYST can restore
- **WHEN** a `JEFE_CALIDAD_SYST` requests `PATCH /api/documents/:id/restaurar` on a deleted document of their empresa
- **THEN** the response status is 200 and the document's `deletedAt` is cleared

#### Scenario: Non-authorized role cannot restore
- **WHEN** a `JEFE_CONTROL_DOCUMENTARIO`, `OPERARIO`, `SUPERVISOR`, or `AUDITOR_INTERNO` requests `PATCH /api/documents/:id/restaurar`
- **THEN** the response status is 403 and the document remains deleted
