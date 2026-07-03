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

Campos: `estado?: QEStatus`, `tipo?: QEType`, `severidad?: QESeverity`, `origen?: QEOrigin`, `areaAfectada?: string`, `fechaDesde?: string`, `fechaHasta?: string`, `ciclo?: number`, `page: number`, `pageSize: number`.

#### Scenario: Uso del tipo en la función de lista
- **WHEN** se tipifica el parámetro de `getQualityEvents` con `QEListParams`
- **THEN** TypeScript rechaza en tiempo de compilación cualquier llamada sin `page` y `pageSize`

---

### Requirement: Tipo QEStatusTransitionInput
El sistema SHALL definir el tipo `QEStatusTransitionInput = { nuevoEstado: QEStatus; comentario?: string; firmaPin?: string }` y exportarlo desde el módulo de tipos del feature.

#### Scenario: Uso del tipo en el cliente
- **WHEN** se llama `transitionQEStatus(id, { nuevoEstado: 'EN_EJECUCION', firmaPin: '1234' })`
- **THEN** TypeScript acepta la llamada sin errores de tipo
