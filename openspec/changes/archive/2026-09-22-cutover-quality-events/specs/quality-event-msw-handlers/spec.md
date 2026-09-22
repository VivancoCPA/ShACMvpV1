## MODIFIED Requirements

### Requirement: MSW endpoint PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId`, accepting `{ estado: 'APROBADA' | 'RECHAZADA', comentarioRevision? }` — matching the real backend's `RevisarAjustePlazoACCommand(SolicitudAjustePlazoEstado Estado, string? ComentarioRevision)`, not the client-facing `accion: 'APROBAR' | 'RECHAZAR'` vocabulary (the client translates `accion` into this `estado` body before the request reaches this handler; see `ac-plazo-extension`). It SHALL return 404 with `success: false` when `:id`, `:acId`, or `:solicitudId` does not match, or when the matching request's `estado !== 'PENDIENTE'`. It SHALL return 422 when `estado === 'RECHAZADA'` and `comentarioRevision` is empty, or when the requesting mock user's role does not match the request's `requiereAprobacionGerencia` gate (`JEFE_CALIDAD_SYST` for `false`, `ALTA_DIRECCION` for `true`). On `estado: 'APROBADA'`, it SHALL set `ac.plazoFecha` to the request's `fechaSolicitada`, mark the request `estado: 'APROBADA'` with `revisadoPorId`/`revisadoEn`, and append an `AC_AJUSTE_PLAZO_APROBADO` audit entry to the parent QE. On `estado: 'RECHAZADA'`, it SHALL mark the request `estado: 'RECHAZADA'` with `revisadoPorId`/`revisadoEn`/`comentarioRevision`, leave `ac.plazoFecha` unchanged, and append an `AC_AJUSTE_PLAZO_RECHAZADO` audit entry to the parent QE. On success, it SHALL respond with the updated `AccionCorrectivaQE` (not the parent `QualityEvent`) wrapped in `ApiResponse` — matching what the real backend's `RevisarAjustePlazoACHandler` serializes.

#### Scenario: Unknown solicitudId returns 404
- **WHEN** `PATCH /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo/does-not-exist` is requested
- **THEN** the response status is 404 and `success: false`

#### Scenario: Reviewing an already-decided request returns 404
- **WHEN** the matching request's `estado` is already `'APROBADA'` or `'RECHAZADA'`
- **THEN** the response status is 404 and `success: false`

#### Scenario: RECHAZADA without comentarioRevision is rejected
- **WHEN** `{ estado: 'RECHAZADA' }` is requested with an empty or missing `comentarioRevision`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong role for a Gerencia-required request is rejected
- **WHEN** a request with `requiereAprobacionGerencia: true` is reviewed by a mock user with role `JEFE_CALIDAD_SYST`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Wrong role for a non-Gerencia request is rejected
- **WHEN** a request with `requiereAprobacionGerencia: false` is reviewed by a mock user with role `ALTA_DIRECCION`
- **THEN** the response status is 422 and `success: false`

#### Scenario: Valid APROBADA updates plazoFecha, appends an audit entry, and returns the AC
- **WHEN** `{ estado: 'APROBADA' }` is requested by the correctly-authorized role for a `PENDIENTE` request with `fechaSolicitada: '2026-08-15'`
- **THEN** the response is 200 with `data` being the updated `AccionCorrectivaQE` (`data.plazoFecha === '2026-08-15'`, that request's `estado === 'APROBADA'` within `data.solicitudesAjustePlazo`), and the parent QE's `auditTrail` (verifiable via `GET /api/quality-events/:id/audit-trail`) grown by 1 with `accion: 'AC_AJUSTE_PLAZO_APROBADO'`

#### Scenario: Valid RECHAZADA leaves plazoFecha unchanged, appends an audit entry, and returns the AC
- **WHEN** `{ estado: 'RECHAZADA', comentarioRevision: 'Justificación insuficiente' }` is requested by the correctly-authorized role
- **THEN** the response is 200 with `data` being the updated `AccionCorrectivaQE` (`data.plazoFecha` unchanged, that request's `estado === 'RECHAZADA'` with `comentarioRevision` set within `data.solicitudesAjustePlazo`), and the parent QE's `auditTrail` grown by 1 with `accion: 'AC_AJUSTE_PLAZO_RECHAZADO'`
