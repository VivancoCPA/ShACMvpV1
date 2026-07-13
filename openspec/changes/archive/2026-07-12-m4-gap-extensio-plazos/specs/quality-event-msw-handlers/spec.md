## ADDED Requirements

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
