## ADDED Requirements

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
