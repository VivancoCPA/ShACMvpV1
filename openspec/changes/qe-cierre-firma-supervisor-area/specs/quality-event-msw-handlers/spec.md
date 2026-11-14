## ADDED Requirements

### Requirement: MSW replica la firma del supervisor del área y el rechazo del cierre
`quality-events.handlers.ts` SHALL replicate the backend closure flow:
- Area supervisors = users in `getUsersStore()` with effective role `SUPERVISOR` in the QE's empresa, active, and `qe.areaId` in their `areaIds`.
- `GET /api/quality-events/:id` SHALL include `cerradoPorNombre`, `cierreFirmaSupervisorNombre` and, only in `PENDIENTE_CIERRE`, `supervisoresArea: [{ id, nombreCompleto, avatarUrl }]`.
- `PATCH /:id/cerrar` and the first signature of `PATCH /:id/firmar-cierre` SHALL respond 422 `errorCode: 'AREA_SIN_SUPERVISOR'` when the area has no supervisors.
- The second signature SHALL respond 403 `errorCode: 'NO_ES_SUPERVISOR_DEL_AREA'` when the signer is not an area supervisor.
- Signature audit entries SHALL use `FIRMA_CIERRE_JEFE_CALIDAD` / `FIRMA_CIERRE_SUPERVISOR` with the signer's name in `valorNuevo`.
- `POST /api/quality-events/:id/rechazar-cierre` SHALL mirror the backend (400 motivo out of 20–500, 404, 422 without first signature, 403 not area supervisor; on success `estado: 'EN_EJECUCION'`, `cerradoPorId` cleared, `resultadoCierre` kept, `CIERRE_RECHAZADO` audit entry with the motivo, linked incident synced, notification to the first signer).

#### Scenario: Detail exposes area supervisors
- **WHEN** `GET /api/quality-events/:id` is requested for a QE in `PENDIENTE_CIERRE` whose area has supervisors
- **THEN** `data.supervisoresArea` lists them

#### Scenario: Supervisor of another area cannot sign
- **WHEN** a SUPERVISOR without the QE's area in `areaIds` sends the second signature
- **THEN** the response is 403 with `errorCode: 'NO_ES_SUPERVISOR_DEL_AREA'`

#### Scenario: Closure on an area without supervisors
- **WHEN** `PATCH /:id/cerrar` is requested for a QE whose area has no supervisors
- **THEN** the response is 422 with `errorCode: 'AREA_SIN_SUPERVISOR'`

#### Scenario: Rejection returns the QE to EN_EJECUCION
- **WHEN** an area supervisor posts a valid motivo to `/rechazar-cierre`
- **THEN** the response is 200 with `estado: 'EN_EJECUCION'` and no `cerradoPorId`
