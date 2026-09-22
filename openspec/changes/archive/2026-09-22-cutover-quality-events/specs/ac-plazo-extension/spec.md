## MODIFIED Requirements

### Requirement: API client functions for proposing and reviewing a plazo adjustment
The system SHALL export `solicitarAjustePlazoAC(qeId: string, acId: string, data: { fechaSolicitada: string; justificacion: string }): Promise<AccionCorrectivaQE>` and `revisarAjustePlazoAC(qeId: string, acId: string, solicitudId: string, data: { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string }): Promise<AccionCorrectivaQE>` from `src/features/quality-events/api/quality-events.api.ts`, calling `POST /api/quality-events/:qeId/acciones-correctivas/:acId/solicitud-plazo` and `PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/solicitud-plazo/:solicitudId` respectively. Both endpoints respond with the updated `AccionCorrectivaQE`, not the parent `QualityEvent` — the client's declared return type SHALL match what the backend actually serializes.

`revisarAjustePlazoAC` SHALL translate its public `accion` parameter into the HTTP body expected by the backend's `RevisarAjustePlazoACCommand(SolicitudAjustePlazoEstado Estado, string? ComentarioRevision)`: the request body sent over HTTP SHALL be `{ estado: 'APROBADA' | 'RECHAZADA', comentarioRevision }`, mapping `accion: 'APROBAR' → estado: 'APROBADA'` and `accion: 'RECHAZAR' → estado: 'RECHAZADA'`. The function's public signature (parameter name `accion`, values `'APROBAR'`/`'RECHAZAR'`) SHALL NOT change — only the HTTP body it constructs internally.

#### Scenario: solicitarAjustePlazoAC calls the correct endpoint and returns the AC
- **WHEN** `solicitarAjustePlazoAC('qe-2026-005', 'ac-1', { fechaSolicitada: '2026-08-15', justificacion: '...' })` is called
- **THEN** the client performs `POST /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo` with the body and returns the updated `AccionCorrectivaQE` (not a `QualityEvent`)

#### Scenario: revisarAjustePlazoAC translates accion into the estado field for APROBAR
- **WHEN** `revisarAjustePlazoAC('qe-2026-005', 'ac-1', 'sol-1', { accion: 'APROBAR' })` is called
- **THEN** the client performs `PATCH /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo/sol-1` with body `{ estado: 'APROBADA' }` (no `accion` field in the HTTP body) and returns the updated `AccionCorrectivaQE`

#### Scenario: revisarAjustePlazoAC translates accion into the estado field for RECHAZAR
- **WHEN** `revisarAjustePlazoAC('qe-2026-005', 'ac-1', 'sol-1', { accion: 'RECHAZAR', comentarioRevision: 'Plazo insuficientemente justificado' })` is called
- **THEN** the client performs `PATCH /api/quality-events/qe-2026-005/acciones-correctivas/ac-1/solicitud-plazo/sol-1` with body `{ estado: 'RECHAZADA', comentarioRevision: 'Plazo insuficientemente justificado' }` (no `accion` field in the HTTP body) and returns the updated `AccionCorrectivaQE`

## ADDED Requirements

### Requirement: Proposing or reviewing a plazo adjustment refreshes the QE detail and audit trail via invalidation, not a mistyped cache write
`useSolicitarAjustePlazoAC(qeId)` and `useRevisarAjustePlazoAC(qeId)` SHALL NOT write the mutation's result (an `AccionCorrectivaQE`) directly into the `QE_QUERY_KEYS.detail(qeId)` or `QE_AUDIT_TRAIL_QUERY_KEY(qeId)` query caches, since those caches are typed `QualityEvent`/`QEAuditTrailEntry[]` and the mutation result has neither shape. On success, both hooks SHALL call `queryClient.invalidateQueries` for `QE_QUERY_KEYS.detail(qeId)` and `QE_AUDIT_TRAIL_QUERY_KEY(qeId)`, matching the pattern already established by `useCerrarQEAccion`/`useUpdateQEAccion` for the sibling AC-status endpoint (whose response is likewise an `AccionCorrectivaQE`, not a `QualityEvent`).

#### Scenario: Solicitar ajuste de plazo invalidates the QE detail and audit trail queries
- **WHEN** `useSolicitarAjustePlazoAC(qeId).mutate(...)` succeeds
- **THEN** `QE_QUERY_KEYS.detail(qeId)` and `QE_AUDIT_TRAIL_QUERY_KEY(qeId)` are invalidated (triggering a refetch of the real `QualityEvent`), and neither cache is ever set directly to the returned `AccionCorrectivaQE`

#### Scenario: Revisar (aprobar o rechazar) ajuste de plazo invalidates the QE detail and audit trail queries
- **WHEN** `useRevisarAjustePlazoAC(qeId).mutate(...)` succeeds, for either an APROBAR or RECHAZAR review
- **THEN** `QE_QUERY_KEYS.detail(qeId)` and `QE_AUDIT_TRAIL_QUERY_KEY(qeId)` are invalidated, and the QE detail view reflects the real, refetched `QualityEvent` shape (`estado`, `numero`, `accionesCorrectivas`, etc. all present) rather than the shape of an `AccionCorrectivaQE`
