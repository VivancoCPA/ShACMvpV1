## MODIFIED Requirements

### Requirement: buildVencimientoKey idempotency key
The system SHALL export a pure function `buildVencimientoKey(entidadTipo: 'AC' | 'DOCUMENTO', entidadId: string, cicloClave?: string): string` from `src/mocks/fixtures/notificationGeneration.ts` returning a stable, deterministic string (e.g. `` `VENCIMIENTO:${entidadTipo}:${entidadId}` ``, or with the cycle suffix appended when `cicloClave` is provided) used to detect whether a vencimiento notification already exists for a given entity. Callers that omit `cicloClave` (AC) SHALL get the exact same key as before this change — no behavior change for that block.

#### Scenario: Same inputs always produce the same key
- **WHEN** `buildVencimientoKey('AC', 'ac-001')` is called twice
- **THEN** both calls return the identical string

#### Scenario: Different entity types produce different keys for the same id
- **WHEN** `buildVencimientoKey('AC', 'x-001')` and `buildVencimientoKey('DOCUMENTO', 'x-001')` are called
- **THEN** the two returned strings differ

#### Scenario: Different cicloClave values produce different keys for the same document
- **WHEN** `buildVencimientoKey('DOCUMENTO', 'doc-001', 'PREAVISO:2026-03-01')` and `buildVencimientoKey('DOCUMENTO', 'doc-001', 'VENCIDO:2026-03-01')` are called
- **THEN** the two returned strings differ, so both notifications can coexist for the same document

### Requirement: generateVencimientoNotifications idempotent deadline scan (RN-NOTIF-003)
The system SHALL export `generateVencimientoNotifications(): Notificacion[]` from `src/mocks/fixtures/notificationGeneration.ts`, called by the `GET /api/notifications` handler before filtering. It SHALL: (1) scan active ACs across the QE, NC, and Incidente domain stores (via each domain's exported `getXStore()`, never a static fixture import) and compute each AC's semaforo state via `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` (from `shared-semaforo-pendientes`); for each AC newly in `'AMARILLO'` whose `buildVencimientoKey('AC', ac.id)` has no existing notification in `getNotificationsStore()`, create one `VENCIMIENTO` notification to the AC's resolvable `responsableId`, with `empresaId` set to the owning QE/NC/Incidente's `empresaId`; (2) scan documents via `getDocumentsStore()` **limited to `estado === 'PUBLICADO'`**, computing "today" as a calendar date in `America/Lima` (not the host machine's local time), for a preaviso/vencido split (RN-DOC-006, see below); (3) scan incidents via `getIncidentsStore()` for RN-INC-006 (superó el plazo sin QE vinculado); for each newly-crossed incident whose `buildVencimientoKey('INCIDENTE', inc.id)` has no existing notification, create one `VENCIMIENTO` notification (with `empresaId: inc.empresaId`) to every user resolvable via `getRolEfectivo(u.id, inc.empresaId)` as `JEFE_CALIDAD_SYST`, plus every `SUPERVISOR` (also resolved via `getRolEfectivo(u.id, inc.empresaId)`) whose `areaIds` includes `inc.areaId`. It SHALL return only the newly-created notifications and SHALL NOT create a second notification for an entity+cycle that already has one for the same key.

For (2), documents SHALL split into two mutually exclusive branches using `diasRestantes = diferencia en días de calendario entre fechaRevisionProxima y "hoy" en America/Lima`:
- **Preaviso** (`0 < diasRestantes <= DOC_REVISION_ALERT_DAYS`): one `VENCIMIENTO` notification per resolvable recipient (autor + every user whose effective role in `doc.empresaId` is `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST`), keyed by `buildVencimientoKey('DOCUMENTO', doc.id, `PREAVISO:${doc.fechaRevisionProxima.slice(0,10)}`)`.
- **Vencido** (`diasRestantes <= 0`): same recipients, different message, keyed by `buildVencimientoKey('DOCUMENTO', doc.id, `VENCIDO:${doc.fechaRevisionProxima.slice(0,10)}`)`.
- Documents not `PUBLICADO`, or with `diasRestantes > DOC_REVISION_ALERT_DAYS`, or without `fechaRevisionProxima`, SHALL be skipped.

#### Scenario: AC newly crossing to AMARILLO generates exactly one notification
- **WHEN** `generateVencimientoNotifications()` runs and an AC has 3 business days remaining (AMARILLO) with no prior `VENCIMIENTO` notification for it
- **THEN** exactly one `VENCIMIENTO` notification is created for that AC's responsable, with `empresaId` equal to the owning entity's `empresaId`

#### Scenario: Re-running the scan does not duplicate an existing vencimiento notification
- **WHEN** `generateVencimientoNotifications()` is called twice in a row for the same unchanged AC state
- **THEN** the second call creates zero new notifications for that AC

#### Scenario: PUBLICADO document nearing fechaRevisionProxima notifies author and Jefe de Calidad once (preaviso)
- **WHEN** a `PUBLICADO` document's `fechaRevisionProxima` is within `DOC_REVISION_ALERT_DAYS` of "today" in `America/Lima`, and no prior preaviso notification exists for that cycle
- **THEN** one notification is created for the document's `autorId` (if resolvable) and one for each user whose effective role in `doc.empresaId` is `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`

#### Scenario: Overdue PUBLICADO document generates a distinct vencido notification
- **WHEN** a `PUBLICADO` document's `fechaRevisionProxima` is in the past, and no prior vencido notification exists for that cycle
- **THEN** a `VENCIMIENTO` notification with the vencido message is created for the same recipients, coexisting with any preaviso notification already created for that same cycle

#### Scenario: Non-PUBLICADO documents never generate this notification
- **WHEN** a document in `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `OBSOLETO` or `EN_REVISION_PERIODICA` has a `fechaRevisionProxima` within the alert window
- **THEN** the scan skips it, generating no notification

#### Scenario: Confirming a new fechaRevisionProxima re-arms the scan for the next cycle
- **WHEN** a document already has a preaviso and/or vencido notification for its current `fechaRevisionProxima`, and that field is then updated to a new date
- **THEN** once the new date enters the alert window, the scan generates a new preaviso notification keyed to that new cycle, without needing the old notifications to be removed

#### Scenario: A user with the matching base rol in a different empresa is not notified for this document
- **WHEN** a document in `empresa-001` enters its revision warning window, and a user has `MockUser.rol: 'JEFE_CALIDAD_SYST'` but their `UsuarioEmpresa` assignment for `empresa-001` is either absent or a different role
- **THEN** that user does not receive the document vencimiento notification

#### Scenario: RN-INC-006 escalation does not cross empresas
- **WHEN** an incident in `empresa-001` supera su plazo sin QE vinculado (nivel ROJO), and a user is `JEFE_CALIDAD_SYST` only in `empresa-002`
- **THEN** that user does not receive the RN-INC-006 escalation notification for the `empresa-001` incident
