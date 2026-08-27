## MODIFIED Requirements

### Requirement: Tipo QEListParams
El sistema SHALL definir el tipo `QEListParams` con los campos de filtrado y paginación requeridos, todos opcionales excepto `page` y `pageSize`.

Campos: `estado?: QEStatus`, `tipo?: QEType`, `severidad?: QESeverity`, `origen?: QEOrigin`, `search?: string`, `fechaDesde?: string`, `fechaHasta?: string`, `ciclo?: number`, `page: number`, `pageSize: number`.

#### Scenario: Uso del tipo en la función de lista
- **WHEN** se tipifica el parámetro de `getQualityEvents` con `QEListParams`
- **THEN** TypeScript rechaza en tiempo de compilación cualquier llamada sin `page` y `pageSize`

#### Scenario: search es un filtro opcional de texto
- **WHEN** se llama `getQualityEvents({ search: 'corros', page: 1, pageSize: 10 })`
- **THEN** el cliente realiza `GET /api/quality-events?search=corros&page=1&pageSize=10` y retorna `ApiResponse<QualityEvent[]>`

## ADDED Requirements

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
