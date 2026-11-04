## MODIFIED Requirements

### Requirement: MSW endpoint PATCH /api/quality-events/:id/firmar-cierre
`quality-events.handlers.ts` SHALL register `PATCH /api/quality-events/:id/firmar-cierre`, accepting `{ rol, pin }`. It SHALL return 404 for an unknown `:id`. Before any other check, it SHALL look up the authenticated signing user via the cross-domain mutable store `getUsersStore()` (from `auth.fixtures.ts`), never a static import: if that user's `pin` is `undefined` (no PIN configured), it SHALL respond 422 with `errorCode: 'PIN_NO_CONFIGURADO'`, without registering any signature; if `pin` is configured but `body.pin` does not match it, it SHALL respond 401, without registering any signature. Only when `body.pin === user.pin` SHALL it proceed with the existing signature-order checks: 422 (message tagged `QE-AC-006`) when `resultadoCierre` is not yet set on the QE; `rol === 'JEFE_CALIDAD_SYST'` and `cerradoPorId` is already set; or `rol` is `'SUPERVISOR'`/`'ALTA_DIRECCION'` and `cerradoPorId` is empty. On a valid first signature it SHALL set `cerradoPorId` and append an audit entry without changing `estado`. On a valid second signature it SHALL set `cierreFirmaSupervisorId`, `cierreFirmaSupervisorRol`, transition `estado → 'CERRADO'`, stamp `fechaCierre`, compute `fechaVerificacionProgramada` as `fechaCierre` + `plazoVerificacionDias` days, and append audit entries for the signature and the `CERRADO` transition. The handler SHALL NOT compare against any fixed module-level constant or accept any well-formed PIN as valid — it already did not validate the PIN at all before this change, a gap that let any 4-digit value close a QE.

#### Scenario: User without a configured PIN cannot sign a closure
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested by a user whose `MockUser.pin` is `undefined`
- **THEN** the response status is 422 with `errorCode: 'PIN_NO_CONFIGURADO'`, and no signature is registered

#### Scenario: Wrong PIN is rejected before any signature-order check
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with a `pin` that does not match the signing user's configured `pin`
- **THEN** the response status is 401, and no signature is registered — even if the signature-order would otherwise have been valid

#### Scenario: Second signature attempted before the first is rejected
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'SUPERVISOR', pin }` matching the signing user's configured `pin`, and `cerradoPorId` is empty
- **THEN** the response status is 422, `success: false`, and the message references `QE-AC-006`

#### Scenario: Valid first signature does not change estado
- **WHEN** `PATCH /api/quality-events/:id/firmar-cierre` is requested with `{ rol: 'JEFE_CALIDAD_SYST', pin }` matching the signing user's configured `pin`, for a QE with `resultadoCierre` set and `cerradoPorId` empty
- **THEN** the response is 200 with `data.cerradoPorId` set and `data.estado === 'PENDIENTE_CIERRE'`

#### Scenario: Valid second signature transitions to CERRADO
- **WHEN** the second signature is submitted with a `pin` matching the signing user's configured `pin`, for a QE with `cerradoPorId` already set and `plazoVerificacionDias: 30`
- **THEN** the response is 200 with `data.estado === 'CERRADO'`, `data.fechaCierre` set, and `data.fechaVerificacionProgramada` equal to `fechaCierre` + 30 days

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/quality-events/does-not-exist/firmar-cierre` is requested
- **THEN** the response status is 404 and `success: false`
