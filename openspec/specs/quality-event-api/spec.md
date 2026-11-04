# Spec: quality-event-api

## Purpose

Pure Axios client for the Quality Event resource. Exposes five side-effect-free functions in `src/features/quality-events/api/quality-events.api.ts`, each returning `Promise<ApiResponse<T>>` via the shared `api` instance from `src/lib/axios.ts`. No TanStack Query logic lives here — that belongs to `quality-event-hooks`.

---
## Requirements
### Requirement: Cliente Axios puro para Quality Event
El sistema SHALL exponer 5 funciones Axios puras en `src/features/quality-events/api/quality-events.api.ts`, sin lógica de TanStack Query ni efectos secundarios. Cada función retorna `Promise<ApiResponse<T>>` usando la instancia `api` de `src/lib/axios.ts`.

Las firmas obligatorias son:
- `getQualityEvents(params: QEListParams): Promise<ApiResponse<QualityEvent[]>>`
- `getQualityEvent(id: string): Promise<ApiResponse<QualityEvent>>`
- `createQualityEvent(data: QualityEventCreateInput): Promise<ApiResponse<QualityEvent>>`
- `updateQualityEvent(id: string, data: QualityEventUpdateInput): Promise<ApiResponse<QualityEvent>>`
- `transitionQEStatus(id: string, data: QEStatusTransitionInput): Promise<ApiResponse<QualityEvent>>`

#### Scenario: Obtención de lista con filtros
- **WHEN** se llama `getQualityEvents({ estado: 'ABIERTO', page: 1, pageSize: 10 })`
- **THEN** el cliente realiza `GET /api/quality-events?estado=ABIERTO&page=1&pageSize=10` y retorna `ApiResponse<QualityEvent[]>`

#### Scenario: Obtención de detalle por ID
- **WHEN** se llama `getQualityEvent('qe-2026-001')`
- **THEN** el cliente realiza `GET /api/quality-events/qe-2026-001` y retorna `ApiResponse<QualityEvent>`

#### Scenario: Creación de nuevo QE
- **WHEN** se llama `createQualityEvent(data)` con datos válidos
- **THEN** el cliente realiza `POST /api/quality-events` con el body serializado y retorna `ApiResponse<QualityEvent>`

#### Scenario: Actualización de campos editables
- **WHEN** se llama `updateQualityEvent('qe-2026-001', data)`
- **THEN** el cliente realiza `PATCH /api/quality-events/qe-2026-001` con el body serializado y retorna `ApiResponse<QualityEvent>`

#### Scenario: Transición de estado
- **WHEN** se llama `transitionQEStatus('qe-2026-001', { nuevoEstado: 'EN_INVESTIGACION' })`
- **THEN** el cliente realiza `PATCH /api/quality-events/qe-2026-001/status` con el body y retorna `ApiResponse<QualityEvent>`

---

### Requirement: Tipo QEListParams
El sistema SHALL definir el tipo `QEListParams` con los campos de filtrado y paginación requeridos, todos opcionales excepto `page` y `pageSize`.

Campos: `estado?: QEStatus`, `tipo?: QEType`, `severidad?: QESeverity`, `origen?: QEOrigin`, `search?: string`, `fechaDesde?: string`, `fechaHasta?: string`, `ciclo?: number`, `page: number`, `pageSize: number`.

#### Scenario: Uso del tipo en la función de lista
- **WHEN** se tipifica el parámetro de `getQualityEvents` con `QEListParams`
- **THEN** TypeScript rechaza en tiempo de compilación cualquier llamada sin `page` y `pageSize`

#### Scenario: search es un filtro opcional de texto
- **WHEN** se llama `getQualityEvents({ search: 'corros', page: 1, pageSize: 10 })`
- **THEN** el cliente realiza `GET /api/quality-events?search=corros&page=1&pageSize=10` y retorna `ApiResponse<QualityEvent[]>`

---

### Requirement: vincularDocumento pure function
El sistema SHALL exponer `vincularDocumento(qeId: string, documentoId: string)` en `src/features/quality-events/api/quality-events.api.ts`, que llama `POST /api/quality-events/:id/documentos-vinculados` con `{ documentoId }` y retorna `Promise<ApiResponse<QualityEvent>>`.

#### Scenario: Vincular un documento a un QE
- **WHEN** se llama `vincularDocumento('qe-2026-001', 'doc-001')`
- **THEN** el cliente realiza `POST /api/quality-events/qe-2026-001/documentos-vinculados` y retorna un `ApiResponse<QualityEvent>` cuyo `data.documentosVinculados` incluye `doc-001`

### Requirement: desvincularDocumento pure function
El sistema SHALL exponer `desvincularDocumento(qeId: string, documentoId: string)`, que llama `DELETE /api/quality-events/:id/documentos-vinculados/:documentoId` y retorna `Promise<ApiResponse<QualityEvent>>`.

#### Scenario: Desvincular un documento existente
- **WHEN** se llama `desvincularDocumento('qe-2026-001', 'doc-001')` sobre un QE con ese documento vinculado
- **THEN** el cliente realiza `DELETE /api/quality-events/qe-2026-001/documentos-vinculados/doc-001` y el `data.documentosVinculados` resultante ya no incluye `doc-001`

---

### Requirement: Tipo QEStatusTransitionInput
El sistema SHALL definir el tipo `QEStatusTransitionInput = { nuevoEstado: QEStatus; comentario?: string; firmaPin?: string }` y exportarlo desde el módulo de tipos del feature.

#### Scenario: Uso del tipo en el cliente
- **WHEN** se llama `transitionQEStatus(id, { nuevoEstado: 'EN_EJECUCION', firmaPin: '1234' })`
- **THEN** TypeScript acepta la llamada sin errores de tipo

### Requirement: aprobarCausaRaiz pure function
`src/features/quality-events/api/quality-events.api.ts` SHALL export `aprobarCausaRaiz(id: string, pin: string): Promise<QualityEvent>`, which calls `POST /api/quality-events/:id/aprobar-causa-raiz` with body `{ pin }` and returns the updated QE from the `ApiResponse` envelope.

#### Scenario: Sends only the PIN
- **WHEN** `aprobarCausaRaiz('qe-1', '1234')` is called
- **THEN** a `POST /api/quality-events/qe-1/aprobar-causa-raiz` request is sent with body `{ pin: '1234' }`

### Requirement: QualityEventUpdateInput excludes the approval fields
`QualityEventUpdateInput` in `qualityEvent.types.ts` SHALL NOT include `causaRaizAprobadaPorId` or `causaRaizFirmadaEn`. Those fields remain on `QualityEvent` as read-only data written only by the approval endpoint.

#### Scenario: Type rejects approval fields
- **WHEN** a developer passes `{ causaRaizFirmadaEn: '...' }` as `QualityEventUpdateInput`
- **THEN** `tsc --noEmit` reports a type error

### Requirement: getFuncionalidades and asistirCausaRaizIA pure functions
`src/features/quality-events/api/quality-events.api.ts` SHALL export two functions, both returning `data` from the `ApiResponse` envelope:
- `getFuncionalidades(): Promise<Funcionalidades>`, which calls `GET /api/config/funcionalidades`;
- `asistirCausaRaizIA(id: string): Promise<SugerenciaCausaRaizIA>`, which calls `POST /api/quality-events/:id/asistente-ia` with no body.

The types SHALL be:
- `SugerenciaCausaRaizIA = { causaRaizProbable: string; cincoPorques: CincoPorques[]; accionesSugeridas: AccionSugeridaIA[]; modelo: string; generadoEn: string }`;
- `AccionSugeridaIA = { descripcion: string; tipo: 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA'; rolResponsableSugerido: string; plazoDiasHabiles: number }`.

#### Scenario: Calls the assistant endpoint
- **WHEN** `asistirCausaRaizIA('qe-1')` is called
- **THEN** a `POST /api/quality-events/qe-1/asistente-ia` request is sent

### Requirement: QualityEventUpdateInput carries origenIA
`QualityEventUpdateInput` SHALL include an optional `origenIA?: { causaRaiz?: OrigenIAValor; cincoPorques?: OrigenIAValor }`, with `OrigenIAValor = 'IA' | 'IA_EDITADO'`.

#### Scenario: Type accepts origenIA
- **WHEN** a developer passes `{ causaRaizDefinitiva: '...', origenIA: { causaRaiz: 'IA' } }` as `QualityEventUpdateInput`
- **THEN** `tsc --noEmit` reports no error

