## 1. API Client

- [x] 1.1 Create `src/api/endpoints/documents.api.ts` and add `ChangeDocumentStatusPayload` type (`nuevoEstado`, `comentario?`, `firma`)
- [x] 1.2 Implement `getDocuments(filters: DocFilters): Promise<DocumentListResponse>` using shared Axios instance with query param serialization
- [x] 1.3 Implement `getDocumentById(id: string): Promise<Documento>`
- [x] 1.4 Implement `createDocument(data: CreateDocumentInput): Promise<Documento>`
- [x] 1.5 Implement `updateDocument(id: string, data: UpdateDocumentInput): Promise<Documento>`
- [x] 1.6 Implement `changeDocumentStatus(id: string, payload: ChangeDocumentStatusPayload): Promise<Documento>`
- [x] 1.7 Implement `deleteDocument(id: string): Promise<void>`

## 2. MSW Fixtures

- [x] 2.1 Create `src/mocks/fixtures/documents.fixtures.ts` with exactly 10 `Documento` fixture objects
- [x] 2.2 Ensure all five required states are represented: `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `PUBLICADO`, `OBSOLETO`
- [x] 2.3 Ensure all seven DocTypes are represented: `POL`, `PRC`, `INS`, `REG`, `INF`, `MAT`, `PLAN`
- [x] 2.4 Add at least one fixture with `historialVersiones` containing 2+ `VersionEntry` entries
- [x] 2.5 Add at least one fixture with a non-empty `qeVinculados` array
- [x] 2.6 Ensure all `codigo` values follow `<DocType>-CD-<NNN>` pattern and are unique
- [x] 2.7 Export `documentFixtures` from `src/mocks/fixtures/index.ts`

## 3. MSW Handlers

- [x] 3.1 Create `src/mocks/handlers/documents.handlers.ts` with a mutable in-memory store initialized from `documentFixtures`
- [x] 3.2 Implement `GET /api/documents` handler with 400 ms delay, pagination (`page`, `pageSize`), and filtering by `estado`, `tipo`, `area`, `search`
- [x] 3.3 Implement `GET /api/documents/:id` handler — return document or 404 with 400 ms delay
- [x] 3.4 Implement `POST /api/documents` handler — create BORRADOR document with generated `id` and `codigo`, respond 201
- [x] 3.5 Implement `PUT /api/documents/:id` handler — allow partial update only if `estado === 'BORRADOR'`, else 409
- [x] 3.6 Implement `POST /api/documents/:id/status` handler with full RN-DOC-001..006 enforcement:
  - Validate transition via `DOC_STATUS_TRANSITIONS`; invalid → 422
  - Require non-empty `firma`; missing → 400 (RN-DOC-004)
  - On transition to `PUBLICADO`, set any other document with same `codigo` and `estado === 'PUBLICADO'` to `OBSOLETO` (RN-DOC-001)
  - Block OBSOLETO transition if `qeVinculados` contains active QE ids → 409 (RN-DOC-005)
  - Append `AuditTrailEntry` (`accion: 'ESTADO_CAMBIADO'`) on every successful transition
- [x] 3.7 Implement `DELETE /api/documents/:id` handler — reject non-BORRADOR (409) and documents with QEs (409); remove from store on success
- [x] 3.8 Import and spread `documentHandlers` into `src/mocks/handlers/index.ts`

## 4. TanStack Query Hooks

- [x] 4.1 Create `src/features/documents/hooks/useDocuments.ts`
- [x] 4.2 Implement `useDocuments(filters: DocFilters)` with `queryKey: QUERY_KEYS.documents.list(filters)` and `queryFn: () => getDocuments(filters)`
- [x] 4.3 Implement `useDocument(id: string)` with `queryKey: QUERY_KEYS.documents.detail(id)` and `enabled: id !== ''`
- [x] 4.4 Implement `useCreateDocument()` mutation: call `createDocument`, invalidate `documents.all` on success, toast `t('documents:toasts.createSuccess')`
- [x] 4.5 Implement `useUpdateDocument()` mutation: call `updateDocument(id, data)` (variable `{ id, data }`), invalidate `documents.all` on success, toast `t('documents:toasts.updateSuccess')`
- [x] 4.6 Implement `useChangeDocumentStatus()` mutation: call `changeDocumentStatus(id, payload)` (variable `{ id, payload }`), invalidate `documents.all` on success, toast success `t('documents:toasts.statusChangeSuccess')`; on error toast `t('documents:toasts.statusChangeError')`
- [x] 4.7 Implement `useDeleteDocument()` mutation: call `deleteDocument(id)`, invalidate `documents.all` on success, toast `t('documents:toasts.deleteSuccess')`; on error toast `t('documents:toasts.deleteError')`
- [x] 4.8 Verify no direct Axios import exists in `useDocuments.ts`

## 5. Tests

- [x] 5.1 Create `src/features/documents/hooks/__tests__/useDocuments.test.ts` with MSW server setup (`setupServer` + `beforeAll/afterEach/afterAll`)
- [x] 5.2 Test: `useDocuments({})` returns fixture list on mount (assert `data.data.length > 0`)
- [x] 5.3 Test: `useDocument('doc-001')` resolves with correct detail (`data.data.id === 'doc-001'`)
- [x] 5.4 Test: `useCreateDocument` calls `invalidateQueries` with `documents.all` after successful mutation
- [x] 5.5 Test: `useChangeDocumentStatus` — override MSW to return 422, assert `toast.error` called with `'documents:toasts.statusChangeError'`
- [x] 5.6 Test: MSW intercepts all six endpoints without 'unhandled request' warnings (smoke test using `server.events.on('request:unhandled', ...)`)
