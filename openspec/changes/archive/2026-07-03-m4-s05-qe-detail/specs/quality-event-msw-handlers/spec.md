## ADDED Requirements

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
