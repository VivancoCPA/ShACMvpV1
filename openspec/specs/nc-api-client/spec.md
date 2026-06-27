# Spec: nc-api-client

## Purpose

Pure Axios functions encapsulating all HTTP calls for the M2 Non-Conformities domain. The single source of truth for endpoint URLs and request/response shapes. Consumed exclusively by TanStack Query hooks — never called directly from components.

---

## Requirements

### Requirement: getNonconformities pure function for paginated list
The system SHALL export a `getNonconformities` function from `src/features/nonconformities/api/nonconformities.api.ts` with signature `(filters?: NCFilters) => Promise<ApiResponse<NoConformidad[]>>` that calls `GET /api/nonconformities` with all filter fields serialized as query parameters. The function SHALL be a plain async function with no React hooks and no side effects.

#### Scenario: getNonconformities calls the correct endpoint
- **WHEN** a developer calls `getNonconformities({ estado: 'DETECTADA', page: 2 })`
- **THEN** Axios makes a `GET` request to `/api/nonconformities?estado=DETECTADA&page=2`

#### Scenario: getNonconformities with no filters calls endpoint without query params
- **WHEN** a developer calls `getNonconformities()`
- **THEN** Axios makes a `GET` request to `/api/nonconformities` with no query string

#### Scenario: getNonconformities returns ApiResponse<NoConformidad[]>
- **WHEN** the API call resolves successfully
- **THEN** the resolved value satisfies `ApiResponse<NoConformidad[]>` with a `data` array and `pagination` object

---

### Requirement: getNonconformity pure function for single record
The system SHALL export a `getNonconformity` function with signature `(id: string) => Promise<ApiResponse<NoConformidad>>` that calls `GET /api/nonconformities/:id`. The response SHALL include the full `NoConformidad` with `accionesCorrectivas` embedded.

#### Scenario: getNonconformity calls the correct endpoint with the given id
- **WHEN** a developer calls `getNonconformity('nc-001')`
- **THEN** Axios makes a `GET` request to `/api/nonconformities/nc-001`

#### Scenario: getNonconformity resolves with accionesCorrectivas embedded
- **WHEN** the API call resolves successfully for an NC with two ACs
- **THEN** `result.data.accionesCorrectivas` is an array of two `AccionCorrectiva` objects

---

### Requirement: createNonconformity pure function
The system SHALL export a `createNonconformity` function with signature `(data: CreateNCInput) => Promise<ApiResponse<NoConformidad & { warning?: string; ncsSimilares?: NoConformidad[] }>>` that calls `POST /api/nonconformities` with the payload as the JSON body.

#### Scenario: createNonconformity calls POST with correct body
- **WHEN** a developer calls `createNonconformity({ origen: 'INSPECCION_INTERNA', tipo: 'PROCESO', ... })`
- **THEN** Axios makes a `POST` request to `/api/nonconformities` with the payload as JSON body

#### Scenario: createNonconformity response may include duplicate warning
- **WHEN** the API responds with `{ data: {...}, warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }`
- **THEN** the resolved value includes `warning` and `ncsSimilares` alongside the created NC

---

### Requirement: updateNonconformity pure function
The system SHALL export an `updateNonconformity` function with signature `(id: string, data: UpdateNCInput) => Promise<ApiResponse<NoConformidad>>` that calls `PATCH /api/nonconformities/:id` with the partial update payload.

#### Scenario: updateNonconformity calls PATCH on the correct endpoint
- **WHEN** a developer calls `updateNonconformity('nc-001', { causaRaiz: 'Falta de procedimiento' })`
- **THEN** Axios makes a `PATCH` request to `/api/nonconformities/nc-001` with `{ causaRaiz: 'Falta de procedimiento' }` as body

---

### Requirement: anularNonconformity pure function
The system SHALL export an `anularNonconformity` function with signature `(id: string, justificacion: string) => Promise<ApiResponse<NoConformidad>>` that calls `POST /api/nonconformities/:id/anular` with `{ justificacion }` as the JSON body.

#### Scenario: anularNonconformity calls POST to anular endpoint
- **WHEN** a developer calls `anularNonconformity('nc-001', 'NC duplicada')`
- **THEN** Axios makes a `POST` request to `/api/nonconformities/nc-001/anular` with `{ justificacion: 'NC duplicada' }` as body

---

### Requirement: createAccionCorrectiva pure function
The system SHALL export a `createAccionCorrectiva` function with signature `(ncId: string, data: CreateACInput) => Promise<ApiResponse<AccionCorrectiva>>` that calls `POST /api/nonconformities/:ncId/acciones-correctivas` with the payload as JSON body.

#### Scenario: createAccionCorrectiva calls POST on the correct nested endpoint
- **WHEN** a developer calls `createAccionCorrectiva('nc-001', { descripcion: '...', responsableId: 'u-1', plazoFecha: '2025-07-01' })`
- **THEN** Axios makes a `POST` request to `/api/nonconformities/nc-001/acciones-correctivas`

---

### Requirement: updateAccionCorrectiva pure function
The system SHALL export an `updateAccionCorrectiva` function with signature `(ncId: string, acId: string, data: UpdateACInput) => Promise<ApiResponse<AccionCorrectiva>>` that calls `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId`.

#### Scenario: updateAccionCorrectiva calls PATCH on the correct nested endpoint
- **WHEN** a developer calls `updateAccionCorrectiva('nc-001', 'ac-1', { estado: 'EN_EJECUCION' })`
- **THEN** Axios makes a `PATCH` request to `/api/nonconformities/nc-001/acciones-correctivas/ac-1` with `{ estado: 'EN_EJECUCION' }` as body

---

### Requirement: cerrarAccionCorrectiva pure function
The system SHALL export a `cerrarAccionCorrectiva` function with signature `(ncId: string, acId: string, data: CerrarACInput) => Promise<ApiResponse<AccionCorrectiva>>` that calls `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar` with `{ descripcionEvidencia, evidenciaUrl? }` as body.

#### Scenario: cerrarAccionCorrectiva calls POST to cerrar endpoint
- **WHEN** a developer calls `cerrarAccionCorrectiva('nc-001', 'ac-1', { descripcionEvidencia: 'Evidencia fotografica adjunta' })`
- **THEN** Axios makes a `POST` request to `/api/nonconformities/nc-001/acciones-correctivas/ac-1/cerrar`

#### Scenario: cerrarAccionCorrectiva includes optional evidenciaUrl when provided
- **WHEN** a developer calls `cerrarAccionCorrectiva('nc-001', 'ac-1', { descripcionEvidencia: '...', evidenciaUrl: 'https://...' })`
- **THEN** the request body includes both `descripcionEvidencia` and `evidenciaUrl`

---

### Requirement: All nc-api-client functions use the shared Axios instance
The system SHALL import and use the `api` Axios instance from `src/lib/axios.ts` for all HTTP calls. No function SHALL create a new Axios instance or use the global `axios` object directly.

#### Scenario: Bearer token is automatically added to all requests
- **WHEN** any api-client function is called while the user is authenticated
- **THEN** the request includes the `Authorization: Bearer <token>` header injected by the Axios interceptor in `src/lib/axios.ts`
