## MODIFIED Requirements

### Requirement: GET /api/quality-events with filtering and correct pagination
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, and `soloReincidencias`, then slice the result for pagination. Before any of those query-param filters, the handler SHALL filter to only the QEs whose `empresaId` matches the session's active empresa (`getActiveEmpresaId()`) — the same check already applied by the detail, `PATCH`, `DELETE`, and export-pdf endpoints in this file. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

#### Scenario: No params returns first 10 fixtures
- **WHEN** `GET /api/quality-events` is requested with no query params
- **THEN** `data.data.length <= 10`, `pagination.page === 1`, and `pagination.totalItems` equals the total fixture count for the active empresa

#### Scenario: Second page returns remaining fixtures
- **WHEN** `GET /api/quality-events?page=2` is requested
- **THEN** `pagination.page === 2` and `data.data` contains the fixtures from index 10 onward, all belonging to the active empresa

#### Scenario: totalPages reflects full fixture set
- **WHEN** `GET /api/quality-events` is requested with 20 fixtures and default pageSize 10
- **THEN** `pagination.totalPages === 2` and `pagination.totalItems === 20`

#### Scenario: Filter by estado
- **WHEN** `GET /api/quality-events?estado=ABIERTO` is requested
- **THEN** only fixtures with `estado === 'ABIERTO'` are included before pagination

#### Scenario: Filter by tipo
- **WHEN** `GET /api/quality-events?tipo=SST` is requested
- **THEN** only fixtures with `tipo === 'SST'` are included

#### Scenario: Filter by severidad
- **WHEN** `GET /api/quality-events?severidad=CRITICA` is requested
- **THEN** only fixtures with `severidad === 'CRITICA'` are included

#### Scenario: Filter by origen
- **WHEN** `GET /api/quality-events?origen=O1_INCIDENTE_CAMPO` is requested
- **THEN** only fixtures with `origen === 'O1_INCIDENTE_CAMPO'` are included

#### Scenario: Filter by fechaDesde compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaDesde=2026-04-01` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) >= new Date('2026-04-01')` are returned

#### Scenario: Filter by fechaHasta compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaHasta=2026-03-31` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) <= new Date('2026-03-31')` are returned

#### Scenario: Combined fechaDesde and fechaHasta narrows result correctly
- **WHEN** `GET /api/quality-events?fechaDesde=2026-02-01&fechaHasta=2026-02-28` is requested
- **THEN** only fixtures whose `fechaHoraEvento` falls within February 2026 are returned

#### Scenario: soloReincidencias=true filters to ciclo > 1
- **WHEN** `GET /api/quality-events?soloReincidencias=true` is requested
- **THEN** only fixtures with `ciclo > 1` are included

#### Scenario: Empty result set returns valid pagination
- **WHEN** all fixtures are filtered out (e.g., `estado=VERIFICADO` when none exist)
- **THEN** `data.data` is an empty array, `pagination.totalItems === 0`, and `pagination.totalPages === 0`

#### Scenario: QEs from another empresa never appear in the listing (RN-EMP-004)
- **WHEN** the active empresa is `empresa-001` and `qeStore` also contains QEs with `empresaId: 'empresa-002'`
- **THEN** `GET /api/quality-events` (with any combination of query params, including no params) never includes an `empresa-002` QE in `data.data`, and `pagination.totalItems` does not count it

#### Scenario: Listing scope matches selection scope for batch export
- **WHEN** a user authenticated against `empresa-001` opens `QEList` and selects all visible rows for batch export
- **THEN** none of the selected QE ids belong to `empresa-002`, because the underlying `GET /api/quality-events` response never included them

## ADDED Requirements

### Requirement: Role-based notification escalations resolve recipients by the QE's empresa (RN-EMP-004)
The four points in `quality-events.handlers.ts` that build a recipient list by filtering `getUsersStore()` on a fixed role — `notifyReaperturaEscalada` (RN-QE-008, shared by the NO_EFECTIVO reopening and the forced-vencimiento reopening), the `JEFE_CALIDAD_SYST` notification on transition to `PENDIENTE_CIERRE`, and the two `ALTA_DIRECCION` escalations for `severidad` `ALTA`/`CRITICA` (RN-QE-005, on reaching `CERRADO` and on reaching `VERIFICADO` with `resultado: 'EFECTIVO'`) — SHALL determine whether a candidate user qualifies for the role by calling `getRolEfectivo(usuarioId, qe.empresaId)` and comparing its result to the target role, instead of reading the candidate's `MockUser.rol` field directly. The `SUPERVISOR`-by-área branch of `notifyReaperturaEscalada` SHALL apply this same `getRolEfectivo` check in addition to its existing `areaIds` check.

#### Scenario: A user with a different role in another empresa is not notified for this QE
- **WHEN** `user-x` has `rol: 'JEFE_CALIDAD_SYST'` via `UsuarioEmpresa` in `empresa-002` only, and a QE in `empresa-001` transitions to `PENDIENTE_CIERRE`
- **THEN** `user-x` does not receive a `CAMBIO_ESTADO` notification for that QE

#### Scenario: A user whose base MockUser.rol differs from their effective role in the QE's empresa is still notified correctly
- **WHEN** `user-y`'s `MockUser.rol` fixture value is `'SUPERVISOR'` but `getRolEfectivo('user-y', 'empresa-002')` resolves to `'JEFE_CALIDAD_SYST'`, and a QE in `empresa-002` transitions to `PENDIENTE_CIERRE`
- **THEN** `user-y` receives the `JEFE_CALIDAD_SYST` notification for that QE

#### Scenario: RN-QE-005 escalation to Gerencia only reaches Gerencia of the QE's own empresa
- **WHEN** a `CRITICA` QE in `empresa-001` reaches `CERRADO`, and a user has `rol: 'ALTA_DIRECCION'` only in `empresa-002`
- **THEN** that user does not receive the RN-QE-005 escalation notification for the `empresa-001` QE
