## ADDED Requirements

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
