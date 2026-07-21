## ADDED Requirements

### Requirement: isResolvableAccount identity guard
The system SHALL export a pure function `isResolvableAccount(id: string): boolean` from `src/mocks/fixtures/notificationGeneration.ts` that returns `true` if and only if `id` matches an entry's `id` field in `getUsersStore()` (`auth.fixtures.ts`). It SHALL NOT use `resolveUserDisplayName` or `seedLegacyNames` for this check, since those always resolve to a display string regardless of whether the id has a real, loggable account.

#### Scenario: Real authFixtures id resolves to true
- **WHEN** `isResolvableAccount('user-operario-001')` is called and `getUsersStore()` contains an entry with `id: 'user-operario-001'`
- **THEN** the function returns `true`

#### Scenario: Legacy domain-only id resolves to false
- **WHEN** `isResolvableAccount('user-003')` is called and `getUsersStore()` contains no entry with `id: 'user-003'` (even though `seedLegacyNames['user-003']` exists)
- **THEN** the function returns `false`

### Requirement: createCambioEstadoNotification for state transitions (RN-NOTIF-001)
The system SHALL export `createCambioEstadoNotification(params): Notificacion[]` from `src/mocks/fixtures/notificationGeneration.ts`, accepting `{ entidadTipo, entidadId, entidadCodigo, estadoNuevo, reportadoPorId, responsablesACActivas: string[], actorId, link }`. It SHALL build the recipient set as `[reportadoPorId, ...responsablesACActivas]`, deduplicated, excluding `actorId`, and filtered through `isResolvableAccount`. For each remaining recipient it SHALL construct and append (via `addNotification`) a `Notificacion` with `tipo: 'CAMBIO_ESTADO'`, a `mensaje` referencing `entidadCodigo` and `estadoNuevo`, `leida: false`, and `createdAt` set to the current timestamp. It SHALL return the array of notifications actually created.

#### Scenario: Reporter receives a notification when someone else changes state
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-operario-001'`, `actorId: 'user-supervisor-001'`, and `estadoNuevo: 'EN_INVESTIGACION'`
- **THEN** a notification with `usuarioId: 'user-operario-001'` and `tipo: 'CAMBIO_ESTADO'` is created

#### Scenario: Acting user never notifies themselves
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-supervisor-001'` and `actorId: 'user-supervisor-001'` (the reporter performed the transition)
- **THEN** no notification is created for `user-supervisor-001`

#### Scenario: Unresolvable recipient id is silently skipped
- **WHEN** `createCambioEstadoNotification` is called with `reportadoPorId: 'user-003'` (not present in `getUsersStore()`) and `actorId` different from `'user-003'`
- **THEN** no notification is created and no error is thrown

### Requirement: createAsignacionNotification for assignments (RN-NOTIF-002)
The system SHALL export `createAsignacionNotification(params): Notificacion | null` from `src/mocks/fixtures/notificationGeneration.ts`, accepting `{ entidadTipo, entidadId, entidadCodigo, asignadoId, actorId, link, mensaje }`. It SHALL return `null` without creating anything if `asignadoId === actorId` or `!isResolvableAccount(asignadoId)`. Otherwise it SHALL construct and append a `Notificacion` with `tipo: 'ASIGNACION'`, `usuarioId: asignadoId`, the given `mensaje`, `leida: false`, and current `createdAt`, and return it.

#### Scenario: New AC responsable receives an assignment notification
- **WHEN** `createAsignacionNotification` is called with `asignadoId: 'user-operario-002'` distinct from `actorId`
- **THEN** a notification with `usuarioId: 'user-operario-002'` and `tipo: 'ASIGNACION'` is created and returned

#### Scenario: Self-assignment does not notify
- **WHEN** `createAsignacionNotification` is called with `asignadoId === actorId`
- **THEN** `null` is returned and no notification is created

### Requirement: buildVencimientoKey idempotency key
The system SHALL export a pure function `buildVencimientoKey(entidadTipo: 'AC' | 'DOCUMENTO', entidadId: string): string` from `src/mocks/fixtures/notificationGeneration.ts` returning a stable, deterministic string (e.g. `` `VENCIMIENTO:${entidadTipo}:${entidadId}` ``) used to detect whether a vencimiento notification already exists for a given entity.

#### Scenario: Same inputs always produce the same key
- **WHEN** `buildVencimientoKey('AC', 'ac-001')` is called twice
- **THEN** both calls return the identical string

#### Scenario: Different entity types produce different keys for the same id
- **WHEN** `buildVencimientoKey('AC', 'x-001')` and `buildVencimientoKey('DOCUMENTO', 'x-001')` are called
- **THEN** the two returned strings differ

### Requirement: generateVencimientoNotifications idempotent deadline scan (RN-NOTIF-003)
The system SHALL export `generateVencimientoNotifications(): Notificacion[]` from `src/mocks/fixtures/notificationGeneration.ts`, called by the `GET /api/notifications` handler before filtering. It SHALL: (1) scan active ACs across the QE, NC, and Incidente domain stores (via each domain's exported `getXStore()`, never a static fixture import) and compute each AC's semaforo state via `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` (from `shared-semaforo-pendientes`); for each AC newly in `'AMARILLO'` whose `buildVencimientoKey('AC', ac.id)` has no existing notification in `getNotificationsStore()`, create one `VENCIMIENTO` notification to the AC's resolvable `responsableId`; (2) scan documents via `getDocumentsStore()` for those within their configured `fechaRevisionProxima` warning window (`RN-DOC-006`); for each newly-in-window document whose `buildVencimientoKey('DOCUMENTO', doc.id)` has no existing notification, create one `VENCIMIENTO` notification to the resolvable `autorId` and to every resolvable `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST` found in `getUsersStore()`. It SHALL return only the newly-created notifications and SHALL NOT create a second notification for an entity that already has one for the same key.

#### Scenario: AC newly crossing to AMARILLO generates exactly one notification
- **WHEN** `generateVencimientoNotifications()` runs and an AC has 3 business days remaining (AMARILLO) with no prior `VENCIMIENTO` notification for it
- **THEN** exactly one `VENCIMIENTO` notification is created for that AC's responsable

#### Scenario: Re-running the scan does not duplicate an existing vencimiento notification
- **WHEN** `generateVencimientoNotifications()` is called twice in a row for the same unchanged AC state
- **THEN** the second call creates zero new notifications for that AC

#### Scenario: Document nearing fechaRevisionProxima notifies author and Jefe de Calidad once
- **WHEN** a document's `fechaRevisionProxima` falls within its configured warning window and no prior `VENCIMIENTO` notification exists for it
- **THEN** one notification is created for the document's `autorId` (if resolvable) and one for each resolvable user with role `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`
