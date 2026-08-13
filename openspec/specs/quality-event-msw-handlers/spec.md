# Spec: quality-event-msw-handlers

## Purpose

MSW v2 request handlers for the Quality Events module (`src/mocks/handlers/quality-events.handlers.ts`). Intercepts REST endpoints for quality events, applying in-memory filtering, correct server-side pagination, and audit trail updates so development works without a real backend.

---

## Requirements

### Requirement: MSW v2 syntax exclusively
All handlers SHALL use `http.*` from `msw`. The `rest.*` API SHALL NOT be used. Simulated latency SHALL be `await delay(400)` at the start of every handler.

#### Scenario: Import verification
- **WHEN** `quality-events.handlers.ts` is imported
- **THEN** only `http`, `HttpResponse`, and `delay` are imported from `msw` (no `rest`)

---

### Requirement: GET /api/quality-events with filtering and correct pagination
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, and `soloReincidencias`, then slice the result for pagination. Before any other filter is applied, the handler SHALL restrict the candidate set to quality events whose `empresaId` matches the `empresaActivaId` of the requesting session; quality events belonging to any other `empresaId` SHALL never appear in `data.data` or count toward `pagination.totalItems`, regardless of other filters. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

#### Scenario: No params returns first 10 fixtures for the active empresa
- **WHEN** `GET /api/quality-events` is requested with no query params
- **THEN** `data.data.length <= 10`, `pagination.page === 1`, and `pagination.totalItems` equals the count of fixtures whose `empresaId` matches the session's active empresa

#### Scenario: Second page returns remaining fixtures
- **WHEN** `GET /api/quality-events?page=2` is requested
- **THEN** `pagination.page === 2` and `data.data` contains the empresa-scoped fixtures from index 10 onward

#### Scenario: totalPages reflects full fixture set for the active empresa
- **WHEN** `GET /api/quality-events` is requested with 20 fixtures belonging to the active empresa and default pageSize 10
- **THEN** `pagination.totalPages === 2` and `pagination.totalItems === 20`

#### Scenario: Filter by estado
- **WHEN** `GET /api/quality-events?estado=ABIERTO` is requested
- **THEN** only fixtures with `estado === 'ABIERTO'` and `empresaId` equal to the session's active empresa are included before pagination

#### Scenario: Filter by tipo
- **WHEN** `GET /api/quality-events?tipo=SST` is requested
- **THEN** only fixtures with `tipo === 'SST'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by severidad
- **WHEN** `GET /api/quality-events?severidad=CRITICA` is requested
- **THEN** only fixtures with `severidad === 'CRITICA'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by origen
- **WHEN** `GET /api/quality-events?origen=O1_INCIDENTE_CAMPO` is requested
- **THEN** only fixtures with `origen === 'O1_INCIDENTE_CAMPO'` and `empresaId` equal to the session's active empresa are included

#### Scenario: Filter by fechaDesde compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaDesde=2026-04-01` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) >= new Date('2026-04-01')` and `empresaId` equal to the session's active empresa are returned

#### Scenario: Filter by fechaHasta compares against fechaHoraEvento
- **WHEN** `GET /api/quality-events?fechaHasta=2026-03-31` is requested
- **THEN** only fixtures where `new Date(fechaHoraEvento) <= new Date('2026-03-31')` and `empresaId` equal to the session's active empresa are returned

#### Scenario: Combined fechaDesde and fechaHasta narrows result correctly
- **WHEN** `GET /api/quality-events?fechaDesde=2026-02-01&fechaHasta=2026-02-28` is requested
- **THEN** only fixtures whose `fechaHoraEvento` falls within February 2026 and `empresaId` matches the session's active empresa are returned

#### Scenario: soloReincidencias=true filters to ciclo > 1
- **WHEN** `GET /api/quality-events?soloReincidencias=true` is requested
- **THEN** only fixtures with `ciclo > 1` and `empresaId` equal to the session's active empresa are included

#### Scenario: Empty result set returns valid pagination
- **WHEN** all fixtures are filtered out (e.g., `estado=VERIFICADO` when none exist for the active empresa)
- **THEN** `data.data` is an empty array, `pagination.totalItems === 0`, and `pagination.totalPages === 0`

#### Scenario: List excludes quality events from another empresa
- **WHEN** the session's active empresa is `empresa-001` and `GET /api/quality-events` is requested with no filters
- **THEN** no quality event with `empresaId === 'empresa-002'` appears anywhere in `data.data`, even if it would otherwise match every other filter

#### Scenario: Listing scope matches selection scope for batch export
- **WHEN** a user authenticated against `empresa-001` opens `QEList` and selects all visible rows for batch export
- **THEN** none of the selected QE ids belong to `empresa-002`, because the underlying `GET /api/quality-events` response never included them

---

### Requirement: GET /api/quality-events/:id
The handler SHALL return the quality event with the matching `id` or 404. A quality event whose `empresaId` does not match the session's active empresa SHALL be treated identically to a non-existent id: the handler returns 404 with no distinct error message that would reveal the quality event exists in another empresa.

#### Scenario: Known id returns quality event
- **WHEN** `GET /api/quality-events/qe-001` is requested and `qe-001.empresaId` matches the session's active empresa
- **THEN** the response is 200 with `data` being the fixture with `id === 'qe-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Quality event belonging to another empresa returns 404
- **WHEN** `GET /api/quality-events/:id` is requested for an id that exists in the store but whose `empresaId` differs from the session's active empresa
- **THEN** the response status is 404, `success: false`, and the response body is indistinguishable from the unknown-id case

---

### Requirement: POST /api/quality-events assigns empresa-scoped numero and empresaId
The handler SHALL generate the new quality event's `numero` (`QE-2026-NNN`) with the correlative count scoped to the session's active empresa (RN-EMP-003 — two empresas can each have an independent `numero` sequence without colliding), and SHALL set `empresaId` to the session's active empresa rather than a hardcoded value. If the requesting session has no active empresa, the handler SHALL reject the request with 401 instead of creating a quality event.

#### Scenario: Created quality event carries the active empresa
- **WHEN** `POST /api/quality-events` is requested with a valid body from a session whose active empresa is `empresa-002`
- **THEN** the response status is 201 and `data.empresaId === 'empresa-002'`

#### Scenario: Numero sequence is independent per empresa
- **WHEN** five quality events already exist for `empresa-001` and none exist yet for `empresa-002`, and `POST /api/quality-events` is requested from a session whose active empresa is `empresa-002`
- **THEN** the created quality event's `numero` is `QE-2026-001` (the first for `empresa-002`), not `QE-2026-006`

#### Scenario: Create rejects when session has no active empresa
- **WHEN** `POST /api/quality-events` is requested and the session's `empresaActivaId` is `null`
- **THEN** the response status is 401 and no quality event is added to the store

---

### Requirement: Empresa-scoped isolation across all by-id quality event operations
Every MSW handler in `quality-events.handlers.ts` that operates on an existing quality event identified by `:id` — including `PATCH /api/quality-events/:id`, `PATCH /api/quality-events/:id/status`, `DELETE /api/quality-events/:id`, `PATCH /api/quality-events/:id/reactivar`, `POST /api/quality-events/:id/export-pdf`, the `acciones-correctivas` sub-resource endpoints (including `solicitud-plazo`), `PATCH /api/quality-events/:id/cerrar`, `PATCH /api/quality-events/:id/firmar-cierre`, `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, `POST /api/quality-events/:id/verificacion-eficacia`, `PATCH /api/quality-events/:id/solicitar-ac`, `GET /api/quality-events/:id/audit-trail`, `PATCH /api/quality-events/:id/editar-reporte-inicial`, `PATCH /api/quality-events/:id/editar-severidad`, and `PATCH /api/quality-events/:id/editar-mineral` — SHALL first verify that the quality event's `empresaId` matches the session's active empresa before performing any further validation or mutation. Accion correctiva sub-resources do not carry their own `empresaId`; their isolation SHALL be enforced entirely through the parent quality event lookup. When the parent quality event's `empresaId` does not match, the handler SHALL respond exactly as it would for a non-existent quality event id, without performing the requested operation.

#### Scenario: Cierre/firma on another empresa's quality event is rejected as not found
- **WHEN** `PATCH /api/quality-events/:id/cerrar` or `PATCH /api/quality-events/:id/firmar-cierre` is requested for a quality event id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id, and the quality event's `estado` is unchanged

#### Scenario: Accion correctiva sub-resource on another empresa's quality event is rejected as not found
- **WHEN** any `acciones-correctivas` sub-resource endpoint is requested with an `:id` that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown quality event id, and no accion correctiva is created or modified

#### Scenario: Audit trail on another empresa's quality event is rejected as not found
- **WHEN** `GET /api/quality-events/:id/audit-trail` is requested for a quality event id that exists but whose `empresaId` differs from the session's active empresa
- **THEN** the response is the same "not found" response the handler returns for an unknown id

---

### Requirement: Registered in handlers/index.ts
`qualityEventHandlers` SHALL be imported from `quality-events.handlers.ts` and spread into the `handlers` array in `src/mocks/handlers/index.ts` without removing handlers from other modules.

#### Scenario: handlers/index.ts includes qualityEventHandlers
- **WHEN** `handlers/index.ts` is imported
- **THEN** the exported `handlers` array contains all handlers from `qualityEventHandlers`

---

### Requirement: MSW sub-resource endpoints for QE acciones-correctivas
`quality-events.handlers.ts` SHALL register `GET /api/quality-events/:id/acciones-correctivas`, `POST /api/quality-events/:id/acciones-correctivas`, `PATCH /api/quality-events/:id/acciones-correctivas/:acId`, and `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status`. All four SHALL operate on the matching QE's `accionesCorrectivas` array in `qeStore` and return 404 with `success: false` when `:id` does not match a fixture QE. On `POST`, the handler SHALL set the created AC's `responsableNombre` by resolving the request's `responsableId` via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) — it SHALL NOT fall back to the literal string `'Usuario'` for any `responsableId` that resolves to a real `authFixtures` account or a `seedLegacyNames` entry.

#### Scenario: GET AC list for unknown QE returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: POST AC for unknown QE returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: PATCH status to CERRADA requires descripcionEvidencia
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA' }` and no `descripcionEvidencia`
- **THEN** the response status is 422 and `success: false`

#### Scenario: POST resolves responsableNombre for a real, non-legacy account
- **WHEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas` is requested with `{ ..., responsableId: 'user-supervisor-002' }`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the created AC's `responsableNombre` is the resolved display name, never the literal string `'Usuario'`

---

### Requirement: MSW endpoint for QE audit-trail sub-resource
`quality-events.handlers.ts` SHALL register `GET /api/quality-events/:id/audit-trail`, returning the matching QE's `auditTrail` sorted by `timestamp` descending, or 404 with `success: false` when `:id` does not match a fixture QE.

#### Scenario: GET audit-trail for known QE returns sorted entries
- **WHEN** `GET /api/quality-events/qe-2026-001/audit-trail` is requested
- **THEN** the response is 200 with `data` sorted by `timestamp` descending

#### Scenario: GET audit-trail for unknown QE returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/audit-trail` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: PATCH /api/quality-events/:id/solicitar-ac increments solicitudesAC
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/solicitar-ac`, which increments the matching QE's `solicitudesAC` by 1 and returns the updated QE. Unknown `:id` SHALL return 404 with `success: false`.

#### Scenario: Known id increments solicitudesAC and returns updated QE
- **WHEN** `PATCH /api/quality-events/qe-2026-002/solicitar-ac` is requested for a QE with `solicitudesAC === 0`
- **THEN** the response is 200 with `data.solicitudesAC === 1`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/solicitar-ac` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/cerrar
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/cerrar`, accepting `{ resultadoCierre, plazoVerificacionDias }`. It SHALL return 404 with `success: false` when `:id` does not match a fixture QE, and 422 when the matching QE's `estado` is not `PENDIENTE_CIERRE`. On success it SHALL set `resultadoCierre` and `plazoVerificacionDias` on the QE (without changing `estado`) and append a `QEAuditTrailEntry` with `accion: 'CIERRE_INICIADO'`.

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/cerrar` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Wrong estado returns 422
- **WHEN** `PATCH /api/quality-events/:id/cerrar` is requested for a QE in `EN_EJECUCION`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid request updates fields and appends an audit entry
- **WHEN** `PATCH /api/quality-events/:id/cerrar` is requested for a QE in `PENDIENTE_CIERRE` with a valid body
- **THEN** the response is 200, `data.resultadoCierre` and `data.plazoVerificacionDias` reflect the request, and `data.auditTrail` grows by 1 with `accion: 'CIERRE_INICIADO'`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/firmar-cierre
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/firmar-cierre`, accepting `{ rol, pin }`. It SHALL return 404 for an unknown `:id`, and 422 (message tagged `QE-AC-006`) when: `resultadoCierre` is not yet set on the QE; `rol === 'JEFE_CALIDAD_SYST'` and `cerradoPorId` is already set; or `rol` is `'SUPERVISOR'`/`'ALTA_DIRECCION'` and `cerradoPorId` is empty. On a valid first signature it SHALL set `cerradoPorId` and append an audit entry without changing `estado`. On a valid second signature it SHALL set `cierreFirmaSupervisorId`, `cierreFirmaSupervisorRol`, transition `estado → 'CERRADO'`, stamp `fechaCierre`, compute `fechaVerificacionProgramada` as `fechaCierre` + `plazoVerificacionDias` days, and append audit entries for the signature and the `CERRADO` transition.

#### Scenario: Second signature attempted before the first is rejected
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'SUPERVISOR', pin: '1234' }` and `cerradoPorId` is empty
- **THEN** the response status is 422, `success: false`, and the message references `QE-AC-006`

#### Scenario: Valid first signature does not change estado
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'JEFE_CALIDAD_SYST', pin: '1234' }` for a QE with `resultadoCierre` set and `cerradoPorId` empty
- **THEN** the response is 200 with `data.cerradoPorId` set and `data.estado === 'PENDIENTE_CIERRE'`

#### Scenario: Valid second signature transitions to CERRADO
- **WHEN** the second valid signature is submitted for a QE with `cerradoPorId` already set and `plazoVerificacionDias: 30`
- **THEN** the response is 200 with `data.estado === 'CERRADO'`, `data.fechaCierre` set, and `data.fechaVerificacionProgramada` equal to `fechaCierre` + 30 days

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/firmar-cierre` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/forzar-vencimiento-verificacion
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` (dev-only, no body). It SHALL return 404 for an unknown `:id`. For a QE in `CERRADO`, it SHALL transition `estado → 'EN_VERIFICACION'` and append an audit entry creating the verification task. For a QE in `EN_VERIFICACION`, it SHALL increment `ciclo`, transition `estado → 'EN_INVESTIGACION'`, and append audit entries for the timeout and a `'REABIERTO'` entry with motive `VENCIMIENTO_PLAZO`. For any other `estado`, it SHALL return 422.

#### Scenario: Forcing from CERRADO transitions to EN_VERIFICACION
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` is requested for a QE in `CERRADO`
- **THEN** the response is 200 with `data.estado === 'EN_VERIFICACION'`

#### Scenario: Forcing from EN_VERIFICACION reopens with incremented ciclo
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` is requested for a QE in `EN_VERIFICACION` with `ciclo: 1`
- **THEN** the response is 200 with `data.estado === 'EN_INVESTIGACION'` and `data.ciclo === 2`

#### Scenario: Forcing on an invalid estado returns 422
- **WHEN** `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` is requested for a QE in `ABIERTO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/forzar-vencimiento-verificacion` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: MSW endpoint POST /api/quality-events/:id/verificacion-eficacia
`quality-events.handlers.ts` SHALL register `POST /api/quality-events/:id/verificacion-eficacia`, accepting `{ resultado, evidencia }`. It SHALL return 404 for an unknown `:id`, and 422 when the QE's `estado !== 'EN_VERIFICACION'` or `evidencia` is empty. On `resultado: 'EFECTIVO'` it SHALL set `resultadoVerificacion`, `evidenciaVerificacion`, `verificadoPorId`, `fechaVerificacionRealizada`, transition `estado → 'VERIFICADO'`, and append an audit entry. On `resultado: 'NO_EFECTIVO'` it SHALL set the same verification fields, increment `ciclo`, transition `estado → 'EN_INVESTIGACION'`, and append audit entries for the result and a `'REABIERTO'` entry with motive `NO_EFECTIVO`.

#### Scenario: EFECTIVO transitions to VERIFICADO
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: 'Sin recurrencias' }` for a QE in `EN_VERIFICACION`
- **THEN** the response is 200 with `data.estado === 'VERIFICADO'`

#### Scenario: NO_EFECTIVO reopens and increments ciclo
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'NO_EFECTIVO', evidencia: 'Recurrencia detectada' }` for a QE with `ciclo: 2` in `EN_VERIFICACION`
- **THEN** the response is 200 with `data.estado === 'EN_INVESTIGACION'` and `data.ciclo === 3`

#### Scenario: Empty evidencia rejected
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested with `{ resultado: 'EFECTIVO', evidencia: '' }`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong estado rejected
- **WHEN** `POST /api/quality-events/:id/verificacion-eficacia` is requested for a QE in `CERRADO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Unknown id returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/verificacion-eficacia` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/editar-reporte-inicial
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/editar-reporte-inicial`, accepting a body validated against `qualityEventEditReporteInicialSchema`. It SHALL return 404 with `success: false` for an unknown `:id`. It SHALL return 422 with `success: false` when the requesting mock user does not satisfy `resolveQEEditAccess(qe, usuario).reporteInicial` (re-derived server-side using `ventanaReporteInicialAbierta` and the same creator/Supervisor-of-area check used in `quality-event-permissions`, evaluated against the fixture QE's current `estado` and `fechaHoraReporte`). It SHALL return 422 when the request body contains any of `numero`, `origen`, `tipo`, `fechaHoraReporte`, `reportadoPorId`, or `severidad`, regardless of what the Zod client-side schema would have stripped. On success it SHALL update only the changed fields on the matching QE and append one `QEAuditTrailEntry` with `accion: 'QE_REPORTE_INICIAL_EDITADO'` per changed field, each with `campoModificado`/`valorAnterior`/`valorNuevo` set.

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/editar-reporte-inicial` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Request outside the RN-QE-014 window is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-reporte-inicial` is requested for a QE whose `fechaHoraReporte` is more than 2 hours in the past
- **THEN** the response status is 422 and `success: false`

#### Scenario: Request from a user who is neither creator nor area Supervisor is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-reporte-inicial` is requested by a mock user who is not `qe.reportadoPorId` and not a `SUPERVISOR` of `qe.areaAfectada`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Payload containing a protected field is rejected even if otherwise valid
- **WHEN** `PATCH /api/quality-events/:id/editar-reporte-inicial` is requested within the valid window with a body that includes `{ numero: 'QE-2026-999', descripcion: 'Cambio' }`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid request updates only changed fields and appends one audit entry per field
- **WHEN** `PATCH /api/quality-events/:id/editar-reporte-inicial` is requested within the valid window with `{ areaAfectada: 'Almacén Sur' }` (all other fields unchanged from the current QE)
- **THEN** the response is 200, `data.areaAfectada === 'Almacén Sur'`, and `data.auditTrail` grows by exactly 1 entry with `accion: 'QE_REPORTE_INICIAL_EDITADO'` and `campoModificado: 'areaAfectada'`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/editar-severidad
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/editar-severidad`, accepting a body validated against `qualityEventEditSeveridadSchema`. It SHALL return 404 for an unknown `:id`. It SHALL return 422 when the requesting mock user's role is not `JEFE_CALIDAD_SYST` or when the matching QE's `estado` is `'CERRADO'`, `'EN_VERIFICACION'`, or `'VERIFICADO'`. On success it SHALL set `severidad` on the matching QE and append a `QEAuditTrailEntry` with `accion: 'QE_SEVERIDAD_EDITADA'`, `valorAnterior` (the prior severidad), and `valorNuevo` (the new severidad). When the new `severidad` is `'CRITICA'` and differs from the prior value, or the prior value was `'CRITICA'` and the new value is not, the response SHALL additionally include a flag equivalent to `requiereNotificacionUrgente` (`true`) so the client can surface the RN-QE-005/011 Gerencia notification.

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/editar-severidad` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Non-JEFE_CALIDAD_SYST request is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-severidad` is requested by a mock user with role `SUPERVISOR`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Request on a CERRADO QE is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-severidad` is requested for a QE with `estado: 'CERRADO'`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid request updates severidad and appends an audit entry
- **WHEN** `PATCH /api/quality-events/:id/editar-severidad` is requested by a `JEFE_CALIDAD_SYST` for a QE in `EN_INVESTIGACION` with `{ severidad: 'ALTA' }`
- **THEN** the response is 200, `data.severidad === 'ALTA'`, and `data.auditTrail` grows by 1 with `accion: 'QE_SEVERIDAD_EDITADA'`

#### Scenario: Changing to CRITICA flags the notification requirement
- **WHEN** `PATCH /api/quality-events/:id/editar-severidad` is requested with `{ severidad: 'CRITICA' }` for a QE with a prior `severidad` of `'MEDIA'`
- **THEN** the response is 200 and indicates the RN-QE-005/011 notification is required

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/editar-mineral
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/editar-mineral`, accepting a body validated against `qualityEventEditMineralSchema`. It SHALL return 404 for an unknown `:id`. It SHALL return 422 when the requesting mock user's role is not `JEFE_CALIDAD_SYST`, when the matching QE's `estado` is `'CERRADO'`, `'EN_VERIFICACION'`, or `'VERIFICADO'`, or when the matching QE's `tipo` is not `'CALIDAD'` or `'OPERACIONAL'`. On success it SHALL set `mineralInvolucrado` on the matching QE and append a `QEAuditTrailEntry` with `accion: 'QE_MINERAL_EDITADO'`, `valorAnterior`, and `valorNuevo`.

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/editar-mineral` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Request on a SST-tipo QE is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-mineral` is requested for a QE with `tipo: 'SST'`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Non-JEFE_CALIDAD_SYST request is rejected
- **WHEN** `PATCH /api/quality-events/:id/editar-mineral` is requested by a mock user with role `AUDITOR_INTERNO`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid request updates mineralInvolucrado and appends an audit entry
- **WHEN** `PATCH /api/quality-events/:id/editar-mineral` is requested by a `JEFE_CALIDAD_SYST` for a QE with `tipo: 'CALIDAD'` in `ANALISIS_COMPLETADO` with `{ mineralInvolucrado: 'Zinc' }`
- **THEN** the response is 200, `data.mineralInvolucrado === 'Zinc'`, and `data.auditTrail` grows by 1 with `accion: 'QE_MINERAL_EDITADO'`

---

### Requirement: MSW endpoint POST /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo
`quality-events.handlers.ts` SHALL register `POST /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo`, accepting `{ fechaSolicitada, justificacion }`. It SHALL return 404 with `success: false` when `:id` or `:acId` does not match a fixture QE/AC. It SHALL return 422 when the requesting mock user's id does not equal the AC's `responsableId`, when the AC's `estado === 'CERRADA'`, when the AC already has a `solicitudesAjustePlazo` entry with `estado === 'PENDIENTE'`, or when the implied total plazo falls below `PLAZO_MINIMO_DIAS_HABILES[qe.severidad]`. On success it SHALL compute `requiereAprobacionGerencia` via the same calculation as `ac-plazo-extension`'s `calcularRequiereAprobacionGerencia`, append a new `SolicitudAjustePlazoAC` (with generated `id`, `estado: 'PENDIENTE'`) to `ac.solicitudesAjustePlazo`, append an `AC_AJUSTE_PLAZO_SOLICITADO` entry to the QE's `auditTrail`, and return the updated `AccionCorrectivaQE`.

#### Scenario: Unknown QE id returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/acciones-correctivas/ac-1/solicitud-plazo` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Unknown AC id returns 404
- **WHEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas/does-not-exist/solicitud-plazo` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Non-responsable request is rejected
- **WHEN** the requesting mock user's id does not equal `ac.responsableId`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Second concurrent PENDIENTE request is rejected
- **WHEN** the AC already has a `solicitudesAjustePlazo` entry with `estado === 'PENDIENTE'`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Request below the severity minimum plazo is rejected server-side
- **WHEN** the proposed `fechaSolicitada` implies a total plazo under `PLAZO_MINIMO_DIAS_HABILES[qe.severidad]`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid request appends a PENDIENTE entry and an audit entry
- **WHEN** `POST /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo` is requested by the AC's responsable with a valid body
- **THEN** the response is 201, the returned AC's `solicitudesAjustePlazo` grows by 1 with `estado: 'PENDIENTE'`, and a follow-up `GET /api/quality-events/qe-2026-005` shows the QE's `auditTrail` grown by 1 with `accion: 'AC_AJUSTE_PLAZO_SOLICITADO'`

---

### Requirement: MSW endpoint PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId`, accepting `{ accion: 'APROBAR' | 'RECHAZAR', comentarioRevision? }`. It SHALL return 404 with `success: false` when `:id`, `:acId`, or `:solicitudId` does not match, or when the matching request's `estado !== 'PENDIENTE'`. It SHALL return 422 when `accion === 'RECHAZAR'` and `comentarioRevision` is empty, or when the requesting mock user's role does not match the request's `requiereAprobacionGerencia` gate (`JEFE_CALIDAD_SYST` for `false`, `ALTA_DIRECCION` for `true`). On `accion: 'APROBAR'`, it SHALL set `ac.plazoFecha` to the request's `fechaSolicitada`, mark the request `estado: 'APROBADA'` with `revisadoPorId`/`revisadoEn`, and append an `AC_AJUSTE_PLAZO_APROBADO` audit entry. On `accion: 'RECHAZAR'`, it SHALL mark the request `estado: 'RECHAZADA'` with `revisadoPorId`/`revisadoEn`/`comentarioRevision`, leave `ac.plazoFecha` unchanged, and append an `AC_AJUSTE_PLAZO_RECHAZADO` audit entry.

#### Scenario: Unknown solicitudId returns 404
- **WHEN** `PATCH /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Reviewing an already-decided request returns 404
- **WHEN** the matching request's `estado` is already `'APROBADA'` or `'RECHAZADA'`
- **THEN** the response status is 404 and `success: false`

#### Scenario: RECHAZAR without comentarioRevision is rejected
- **WHEN** `{ accion: 'RECHAZAR' }` is requested with an empty or missing `comentarioRevision`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong role for a Gerencia-required request is rejected
- **WHEN** a request with `requiereAprobacionGerencia: true` is reviewed by a mock user with role `JEFE_CALIDAD_SYST`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong role for a non-Gerencia request is rejected
- **WHEN** a request with `requiereAprobacionGerencia: false` is reviewed by a mock user with role `ALTA_DIRECCION`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid APROBAR updates plazoFecha and appends an audit entry
- **WHEN** `{ accion: 'APROBAR' }` is requested by the correctly-authorized role for a `PENDIENTE` request with `fechaSolicitada: '2026-08-15'`
- **THEN** the response is 200 with the AC's `plazoFecha === '2026-08-15'`, that request's `estado === 'APROBADA'`, and the QE's `auditTrail` grown by 1 with `accion: 'AC_AJUSTE_PLAZO_APROBADO'`

#### Scenario: Valid RECHAZAR leaves plazoFecha unchanged and appends an audit entry
- **WHEN** `{ accion: 'RECHAZAR', comentarioRevision: 'Justificación insuficiente' }` is requested by the correctly-authorized role
- **THEN** the response is 200 with the AC's `plazoFecha` unchanged, that request's `estado === 'RECHAZADA'` with `comentarioRevision` set, and the QE's `auditTrail` grown by 1 with `accion: 'AC_AJUSTE_PLAZO_RECHAZADO'`

---

### Requirement: MSW endpoint POST /api/quality-events/:id/export-pdf
`quality-events.handlers.ts` SHALL register `POST /api/quality-events/:id/export-pdf`, accepting no request body. It SHALL return 404 with `success: false` for an unknown `:id`. On success it SHALL append one `QEAuditTrailEntry` to the matching QE's `auditTrail` with `accion: 'EXPORTACION_PDF'`, `realizadoPorId`/`realizadoPorNombre` set from the requesting mock user, `timestamp` set to the current mock time, and `generadoPorIA: false`, then return 200 with `data` being the full updated `QualityEvent` (including the new audit entry). This endpoint SHALL be called by the client before generating the PDF, both for individual exports and for each QE within a batch export, per `quality-event-pdf-export` and `quality-event-batch-pdf-export`.

#### Scenario: Successful export-pdf call appends the audit entry and returns the updated QE
- **WHEN** `POST /api/quality-events/qe-2026-010/export-pdf` is requested by mock user `jc-1` (`realizadoPorNombre: 'Ana Torres'`)
- **THEN** the response is 200, `data.auditTrail` grows by exactly 1 entry with `accion: 'EXPORTACION_PDF'`, `realizadoPorNombre: 'Ana Torres'`, and `generadoPorIA: false`

#### Scenario: Unknown id returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/export-pdf` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Consecutive calls each append their own entry
- **WHEN** `POST /api/quality-events/qe-2026-010/export-pdf` is requested twice in a row
- **THEN** `auditTrail` grows by exactly 2 entries total, one `EXPORTACION_PDF` entry per call, each with its own `timestamp`

---

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
