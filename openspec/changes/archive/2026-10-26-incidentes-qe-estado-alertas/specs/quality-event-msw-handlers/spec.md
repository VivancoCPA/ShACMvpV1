## ADDED Requirements

### Requirement: Atomic incident link on POST /api/quality-events (O1)
When `POST /api/quality-events` creates a QE with `origen: 'O1_INCIDENTE_CAMPO'`, the handler MUST set `qeId` on the referenced incident in the mutable incidents store (`getIncidentsStore()`) in the same handler call, and append a `QE_VINCULADO` audit entry to the incident.

#### Scenario: Incident linked in the same request
- **WHEN** `POST /api/quality-events` succeeds with `origen: 'O1_INCIDENTE_CAMPO'` and `incidenteId: 'inc-003'`
- **THEN** `getIncidentsStore()` shows `inc-003.qeId` equal to the new QE id, without any further request

### Requirement: Incident estado follows QE estado in MSW
Every MSW handler that changes a QE's `estado` MUST apply the same QE → incident mapping as the backend, via a shared helper, when the QE has `incidenteId`. Those handlers are: `/status`, the AC status change that reaches `PENDIENTE_CIERRE`, `firmar-cierre`, `verificacion-eficacia` and `forzar-vencimiento-verificacion`. When the mapped estado differs, the helper MUST append an `ESTADO_SINCRONIZADO_QE` audit entry with actor "Sistema". `DELETE /api/quality-events/:id` MUST clear the incident's `qeId` and record the reason. Reactivation MUST re-link the QE, or return 422 `INCIDENTE_YA_VINCULADO` if the incident is already linked to another QE.

#### Scenario: QE transition updates the mocked incident
- **WHEN** a mocked QE linked to `inc-003` transitions to `EN_INVESTIGACION`
- **THEN** `inc-003.estado` is `EN_INVESTIGACION` and its audit trail has an `ESTADO_SINCRONIZADO_QE` entry

#### Scenario: Deleting the QE frees the incident
- **WHEN** `DELETE /api/quality-events/:id` deletes a QE linked to `inc-003`
- **THEN** `inc-003.qeId` is undefined

### Requirement: Dashboard summary exposes incidentesSinQeVencidos in MSW
The MSW dashboard summary for `JEFE_CALIDAD` MUST include `incidentesSinQeVencidos` (at most 10, most overdue first) and `incidentesSinQeVencidosTotal`, computed with `getIncidentQEAlertLevel` over the empresa-scoped incidents store.

#### Scenario: Summary includes the new field
- **WHEN** a JEFE_CALIDAD_SYST requests `/api/dashboard/summary` in MSW
- **THEN** the response includes `incidentesSinQeVencidos` as an array and `incidentesSinQeVencidosTotal` as a number
