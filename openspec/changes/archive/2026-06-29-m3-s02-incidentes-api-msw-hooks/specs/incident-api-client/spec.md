## ADDED Requirements

### Requirement: Incident list retrieval
The system SHALL provide a typed function `getIncidents(filters?: IncidentFilters)` that sends `GET /api/incidents` with all filter params as query string and returns the unwrapped list response.

#### Scenario: Fetch incidents with no filters
- **WHEN** `getIncidents()` is called with no arguments
- **THEN** an HTTP GET request is sent to `/api/incidents` with no query params and the response data is returned

#### Scenario: Fetch incidents with filters
- **WHEN** `getIncidents({ tipo: 'ACCIDENTE', page: 2, pageSize: 5 })` is called
- **THEN** the request URL includes `tipo=ACCIDENTE&page=2&pageSize=5` and the response data is returned

### Requirement: Incident detail retrieval
The system SHALL provide `getIncident(id: string)` that sends `GET /api/incidents/:id` and returns the single `Incidente` object.

#### Scenario: Fetch existing incident
- **WHEN** `getIncident('inc-001')` is called
- **THEN** a GET request is sent to `/api/incidents/inc-001` and the `Incidente` object is returned

#### Scenario: Fetch non-existent incident
- **WHEN** `getIncident('unknown-id')` is called and the server responds 404
- **THEN** the promise rejects with an error that the caller can handle

### Requirement: Incident creation
The system SHALL provide `createIncident(data: CreateIncidentInput)` that sends `POST /api/incidents` with the payload and returns the created `Incidente`.

#### Scenario: Create a valid incident
- **WHEN** `createIncident({ tipo: 'ACCIDENTE', descripcion: '...', areaId: 'Almacén Norte', turno: 'DIA', fechaEvento: '2026-06-10T08:00:00Z', huboLesionados: false })` is called
- **THEN** a POST request is sent to `/api/incidents` with the body serialized as JSON and the created incident is returned

### Requirement: Incident investigation update
The system SHALL provide `updateIncident(id, data: Partial<UpdateIncidentInvestigacionInput>)` that sends `PATCH /api/incidents/:id` and returns the updated `Incidente`.

#### Scenario: Update investigation fields
- **WHEN** `updateIncident('inc-001', { condicionesEntorno: ['ILUMINACION'] })` is called
- **THEN** a PATCH request is sent to `/api/incidents/inc-001` with the partial body and the updated incident is returned

### Requirement: Incident status transition
The system SHALL provide `updateIncidentStatus(id, { estado, comentario? })` that sends `PATCH /api/incidents/:id/status` and returns the updated `Incidente`.

#### Scenario: Valid status transition
- **WHEN** `updateIncidentStatus('inc-001', { estado: 'EN_INVESTIGACION' })` is called
- **THEN** a PATCH request is sent to `/api/incidents/inc-001/status` with `{ estado: 'EN_INVESTIGACION' }` and the updated incident is returned

### Requirement: Incident soft delete
The system SHALL provide `deleteIncident(id)` that sends `DELETE /api/incidents/:id` and returns `void`.

#### Scenario: Delete an open incident
- **WHEN** `deleteIncident('inc-003')` is called
- **THEN** a DELETE request is sent to `/api/incidents/inc-003` and the promise resolves

### Requirement: Incident restore
The system SHALL provide `restoreIncident(id)` that sends `PATCH /api/incidents/:id/restore` and returns the restored `Incidente`.

#### Scenario: Restore a soft-deleted incident
- **WHEN** `restoreIncident('inc-014')` is called
- **THEN** a PATCH request is sent to `/api/incidents/inc-014/restore` and the restored incident is returned

### Requirement: Corrective action creation
The system SHALL provide `createAC(incidenteId, data: CreateACIncidenteInput)` that sends `POST /api/incidents/:id/acciones` and returns the created `AccionCorrectivaIncidente`.

#### Scenario: Create AC for an incident
- **WHEN** `createAC('inc-005', { descripcion: '...', responsableId: 'user-003', fechaLimite: '2026-07-01' })` is called
- **THEN** a POST request is sent to `/api/incidents/inc-005/acciones` with the body and the created AC is returned

### Requirement: Corrective action update
The system SHALL provide `updateAC(incidenteId, acId, data)` that sends `PATCH /api/incidents/:incidenteId/acciones/:acId` and returns the updated `AccionCorrectivaIncidente`.

#### Scenario: Update AC estado
- **WHEN** `updateAC('inc-005', 'ac-inc-001', { estado: 'COMPLETADA', evidencia: 'url' })` is called
- **THEN** a PATCH request is sent to `/api/incidents/inc-005/acciones/ac-inc-001` with the body and the updated AC is returned

### Requirement: Axios instance reuse
The API client MUST import and use the centralized Axios instance from `src/lib/axios.ts`. It MUST NOT create a new `axios.create()` instance.

#### Scenario: Centralized auth headers applied
- **WHEN** any API function is called
- **THEN** the request includes the Bearer token header injected by the Axios interceptor in `src/lib/axios.ts`
