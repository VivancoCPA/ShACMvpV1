## ADDED Requirements

### Requirement: useDocuments query hook
The system SHALL export a `useDocuments(filters: DocFilters)` hook from `src/features/documents/hooks/useDocuments.ts` that wraps `useQuery` with `queryKey: QUERY_KEYS.documents.list(filters)` and `queryFn: () => getDocuments(filters)`. The hook SHALL return the full TanStack Query result object.

#### Scenario: useDocuments returns document list on mount
- **WHEN** a component mounts with `useDocuments({})`
- **THEN** after the query resolves, `data` contains the paginated list from the MSW handler

#### Scenario: useDocuments re-fetches when filters change
- **WHEN** the `filters` argument changes (e.g., `estado` changes from undefined to `'PUBLICADO'`)
- **THEN** a new query is triggered with the updated query key and the result reflects the filtered data

### Requirement: useDocument detail query hook
The system SHALL export a `useDocument(id: string)` hook that wraps `useQuery` with `queryKey: QUERY_KEYS.documents.detail(id)` and `queryFn: () => getDocumentById(id)`. The query SHALL be disabled (`enabled: false`) when `id` is an empty string.

#### Scenario: useDocument returns document detail for valid id
- **WHEN** `useDocument('doc-001')` is called and MSW returns the document
- **THEN** `data.data.id` equals `'doc-001'`

#### Scenario: useDocument is disabled for empty id
- **WHEN** `useDocument('')` is called
- **THEN** no network request is made and `status` is `'pending'`

### Requirement: useCreateDocument mutation hook
The system SHALL export a `useCreateDocument()` hook that wraps `useMutation` calling `createDocument(data)`. On `onSuccess`, the hook SHALL call `queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })` and display a Sonner success toast with key `t('documents:toasts.createSuccess')`.

#### Scenario: useCreateDocument invalidates cache on success
- **WHEN** `mutate(validPayload)` is called and the MSW handler returns 201
- **THEN** `queryClient.invalidateQueries` is called with the `documents.all` query key

#### Scenario: useCreateDocument shows success toast
- **WHEN** `mutate(validPayload)` succeeds
- **THEN** Sonner `toast.success` is called with the `documents:toasts.createSuccess` key

### Requirement: useUpdateDocument mutation hook
The system SHALL export a `useUpdateDocument()` hook that wraps `useMutation` calling `updateDocument(id, data)`. The mutation variable SHALL be typed as `{ id: string; data: UpdateDocumentInput }`. On `onSuccess`, the hook SHALL invalidate `QUERY_KEYS.documents.all` and display a success toast with key `t('documents:toasts.updateSuccess')`.

#### Scenario: useUpdateDocument sends correct mutation variables
- **WHEN** `mutate({ id: 'doc-001', data: { titulo: 'Nuevo' } })` is called
- **THEN** the HTTP request goes to `PUT /api/documents/doc-001` with body `{ titulo: 'Nuevo' }`

### Requirement: useChangeDocumentStatus mutation hook
The system SHALL export a `useChangeDocumentStatus()` hook that wraps `useMutation` calling `changeDocumentStatus(id, payload)`. The mutation variable SHALL be typed as `{ id: string; payload: ChangeDocumentStatusPayload }`. On `onSuccess`, the hook SHALL invalidate `QUERY_KEYS.documents.all` and display a success toast with key `t('documents:toasts.statusChangeSuccess')`. On `onError`, the hook SHALL display an error toast with key `t('documents:toasts.statusChangeError')`.

#### Scenario: useChangeDocumentStatus invalidates all document queries on success
- **WHEN** `mutate({ id: 'doc-001', payload: { nuevoEstado: 'EN_REVISION', firma: '1234' } })` succeeds
- **THEN** `queryClient.invalidateQueries` is called with `QUERY_KEYS.documents.all`

#### Scenario: useChangeDocumentStatus shows error toast on rejection
- **WHEN** `mutate` is called with an invalid transition and MSW returns 422
- **THEN** Sonner `toast.error` is called with the `documents:toasts.statusChangeError` key

### Requirement: useDeleteDocument mutation hook
The system SHALL export a `useDeleteDocument()` hook that wraps `useMutation` calling `deleteDocument(id)`. On `onSuccess`, the hook SHALL invalidate `QUERY_KEYS.documents.all` and display a success toast with key `t('documents:toasts.deleteSuccess')`. On `onError`, the hook SHALL display an error toast with key `t('documents:toasts.deleteError')`.

#### Scenario: useDeleteDocument removes document from cache after success
- **WHEN** `mutate('doc-borrador-id')` succeeds
- **THEN** `queryClient.invalidateQueries` is called with `QUERY_KEYS.documents.all`

### Requirement: Hooks use only API client functions
All hooks in `useDocuments.ts` SHALL call only functions imported from `src/api/endpoints/documents.api.ts`. Direct `axios` calls, `api.get(...)`, or any other HTTP call pattern SHALL NOT appear in the hooks file.

#### Scenario: No direct axios usage in hooks file
- **WHEN** `useDocuments.ts` is statically analyzed
- **THEN** no import from `axios` or `src/lib/axios.ts` is found in the file

### Requirement: Hook tests cover critical paths
The system SHALL provide tests in `src/features/documents/hooks/__tests__/useDocuments.test.ts` using Vitest + `@testing-library/react` + the MSW server setup. The test suite SHALL cover: (1) `useDocuments` returns list on mount, (2) `useDocument` returns correct detail, (3) `useCreateDocument` invalidates cache on success, (4) `useChangeDocumentStatus` shows error toast on rejection, (5) MSW intercepts all tested endpoints correctly.

#### Scenario: useDocuments test passes with MSW active
- **WHEN** the test renders a component using `useDocuments({})` with the MSW server running
- **THEN** the test asserts that the query resolves with the fixture dataset

#### Scenario: useChangeDocumentStatus error path test passes
- **WHEN** the test overrides the MSW handler to return 422
- **THEN** the test asserts that `toast.error` was called with the correct key
