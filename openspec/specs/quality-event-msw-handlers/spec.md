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
The handler SHALL apply in-memory filtering on `qualityEventFixtures` based on the query params `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, and `soloReincidencias`, then slice the result for pagination. The `fechaDesde` and `fechaHasta` params filter on `fechaHoraEvento` of each fixture — not on `fechaVerificacionProgramada` or any other date field. The response SHALL be an `ApiResponse` with a `pagination` object containing `totalItems` (count of filtered items before slicing), `totalPages` (ceil(totalItems / pageSize)), `page` (current page), and `pageSize`. Default `pageSize` is 10.

#### Scenario: No params returns first 10 fixtures
- **WHEN** `GET /api/quality-events` is requested with no query params
- **THEN** `data.data.length <= 10`, `pagination.page === 1`, and `pagination.totalItems` equals the total fixture count

#### Scenario: Second page returns remaining fixtures
- **WHEN** `GET /api/quality-events?page=2` is requested
- **THEN** `pagination.page === 2` and `data.data` contains the fixtures from index 10 onward

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

---

### Requirement: GET /api/quality-events/:id
The handler SHALL return the quality event with the matching `id` or 404.

#### Scenario: Known id returns quality event
- **WHEN** `GET /api/quality-events/qe-001` is requested
- **THEN** the response is 200 with `data` being the fixture with `id === 'qe-001'`

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: Registered in handlers/index.ts
`qualityEventHandlers` SHALL be imported from `quality-events.handlers.ts` and spread into the `handlers` array in `src/mocks/handlers/index.ts` without removing handlers from other modules.

#### Scenario: handlers/index.ts includes qualityEventHandlers
- **WHEN** `handlers/index.ts` is imported
- **THEN** the exported `handlers` array contains all handlers from `qualityEventHandlers`

---

### Requirement: MSW sub-resource endpoints for QE acciones-correctivas
`quality-events.handlers.ts` SHALL register `GET /api/quality-events/:id/acciones-correctivas`, `POST /api/quality-events/:id/acciones-correctivas`, `PATCH /api/quality-events/:id/acciones-correctivas/:acId`, and `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status`. All four SHALL operate on the matching QE's `accionesCorrectivas` array in `qeStore` and return 404 with `success: false` when `:id` does not match a fixture QE.

#### Scenario: GET AC list for unknown QE returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: POST AC for unknown QE returns 404
- **WHEN** `POST /api/quality-events/does-not-exist/acciones-correctivas` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: PATCH status to CERRADA requires descripcionEvidencia
- **WHEN** `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` is requested with `{ estado: 'CERRADA' }` and no `descripcionEvidencia`
- **THEN** the response status is 422 and `success: false`

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

#### Scenario: Request outside the RN-QE-010 window is rejected
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
