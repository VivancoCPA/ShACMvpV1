## MODIFIED Requirements

### Requirement: createCambioEstadoNotification for state transitions (RN-NOTIF-001)
The system SHALL export `createCambioEstadoNotification(params): Notificacion[]` from `src/mocks/fixtures/notificationGeneration.ts`, accepting `{ entidadTipo, entidadId, entidadCodigo, empresaId, estadoNuevo, reportadoPorId, responsablesACActivas: string[], actorId, link }`. It SHALL build the recipient set as `[reportadoPorId, ...responsablesACActivas]`, deduplicated, excluding `actorId`, and filtered through `isResolvableAccount`. For each remaining recipient it SHALL construct and append (via `addNotification`) a `Notificacion` with `tipo: 'CAMBIO_ESTADO'`, `empresaId` set to the given `empresaId` (the originating entity's own `empresaId`, passed by every call site since the caller already has the entity loaded), a `mensaje` referencing `entidadCodigo` and `estadoNuevo`, `leida: false`, and `createdAt` set to the current timestamp. It SHALL return the array of notifications actually created.

#### Scenario: Reporter receives a notification when someone else changes state
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-operario-001'`, `actorId: 'user-supervisor-001'`, `empresaId: 'empresa-001'`, and `estadoNuevo: 'EN_INVESTIGACION'`
- **THEN** a notification with `usuarioId: 'user-operario-001'`, `empresaId: 'empresa-001'`, and `tipo: 'CAMBIO_ESTADO'` is created

#### Scenario: Acting user never notifies themselves
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-supervisor-001'` and `actorId: 'user-supervisor-001'` (the reporter performed the transition)
- **THEN** no notification is created for `user-supervisor-001`

#### Scenario: Unresolvable recipient id is silently skipped
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-003'` (not present in `getUsersStore()`) and `actorId` different from `'user-003'`
- **THEN** no notification is created and no error is thrown

#### Scenario: Created notification carries the originating entity's empresaId
- **WHEN** `createCambioEstadoNotification` is called for a QE with `empresaId: 'empresa-002'`
- **THEN** every `Notificacion` created has `empresaId: 'empresa-002'`, matching the QE's own empresa, not the active empresa of the actor performing the transition

### Requirement: generateVencimientoNotifications idempotent deadline scan (RN-NOTIF-003)
The system SHALL export `generateVencimientoNotifications(): Notificacion[]` from `src/mocks/fixtures/notificationGeneration.ts`, called by the `GET /api/notifications` handler before filtering. It SHALL: (1) scan active ACs across the QE, NC, and Incidente domain stores (via each domain's exported `getXStore()`, never a static fixture import) and compute each AC's semaforo state via `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` (from `shared-semaforo-pendientes`); for each AC newly in `'AMARILLO'` whose `buildVencimientoKey('AC', ac.id)` has no existing notification in `getNotificationsStore()`, create one `VENCIMIENTO` notification to the AC's resolvable `responsableId`, with `empresaId` set to the owning QE/NC/Incidente's `empresaId`; (2) scan documents via `getDocumentsStore()` for those within their configured `fechaRevisionProxima` warning window (`RN-DOC-006`); for each newly-in-window document whose `buildVencimientoKey('DOCUMENTO', doc.id)` has no existing notification, create one `VENCIMIENTO` notification (with `empresaId: doc.empresaId`) to the resolvable `autorId` and to every user resolvable via `getRolEfectivo(u.id, doc.empresaId)` as `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST` in `doc.empresaId` — not by reading `MockUser.rol` directly; (3) scan incidents via `getIncidentsStore()` for RN-INC-006 (superó el plazo sin QE vinculado); for each newly-crossed incident whose `buildVencimientoKey('INCIDENTE', inc.id)` has no existing notification, create one `VENCIMIENTO` notification (with `empresaId: inc.empresaId`) to every user resolvable via `getRolEfectivo(u.id, inc.empresaId)` as `JEFE_CALIDAD_SYST`, plus every `SUPERVISOR` (also resolved via `getRolEfectivo(u.id, inc.empresaId)`) whose `areaIds` includes `inc.areaId`. It SHALL return only the newly-created notifications and SHALL NOT create a second notification for an entity that already has one for the same key.

#### Scenario: AC newly crossing to AMARILLO generates exactly one notification
- **WHEN** `generateVencimientoNotifications()` runs and an AC has 3 business days remaining (AMARILLO) with no prior `VENCIMIENTO` notification for it
- **THEN** exactly one `VENCIMIENTO` notification is created for that AC's responsable, with `empresaId` equal to the owning entity's `empresaId`

#### Scenario: Re-running the scan does not duplicate an existing vencimiento notification
- **WHEN** `generateVencimientoNotifications()` is called twice in a row for the same unchanged AC state
- **THEN** the second call creates zero new notifications for that AC

#### Scenario: Document nearing fechaRevisionProxima notifies author and Jefe de Calidad once
- **WHEN** a document's `fechaRevisionProxima` falls within its configured warning window and no prior `VENCIMIENTO` notification exists for it
- **THEN** one notification is created for the document's `autorId` (if resolvable) and one for each user whose effective role in `doc.empresaId` is `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`, each with `empresaId: doc.empresaId`

#### Scenario: A user with the matching base rol in a different empresa is not notified for this document
- **WHEN** a document in `empresa-001` enters its revision warning window, and a user has `MockUser.rol: 'JEFE_CALIDAD_SYST'` but their `UsuarioEmpresa` assignment for `empresa-001` is either absent or a different role
- **THEN** that user does not receive the document vencimiento notification

#### Scenario: RN-INC-006 escalation does not cross empresas
- **WHEN** an incident in `empresa-001` supera su plazo sin QE vinculado (nivel ROJO), and a user is `JEFE_CALIDAD_SYST` only in `empresa-002`
- **THEN** that user does not receive the RN-INC-006 escalation notification for the `empresa-001` incident
