## Why

With the M1 type layer (Spec 1) in place, the next prerequisite for any UI work is a functioning data layer: pure API functions, realistic MSW fixtures, request handlers, and TanStack Query hooks. Without these, components cannot be built or tested against realistic data flows and business-rule validations.

## What Changes

- Add `src/api/endpoints/documents.api.ts` — six pure Axios functions (no hooks) for all document CRUD and status-transition operations, typed strictly with `ApiResponse<T>`.
- Add `src/mocks/fixtures/documents.fixtures.ts` — 10 realistic fixture documents covering all five states, all seven types, version history, and QE linkage.
- Add `src/mocks/handlers/documents.handlers.ts` — six MSW v2 handlers with 400 ms simulated latency, enforcing RN-DOC-001..006 at the mock layer; wired into `src/mocks/handlers/index.ts`.
- Add `src/features/documents/hooks/useDocuments.ts` — six TanStack Query hooks (`useDocuments`, `useDocument`, `useCreateDocument`, `useUpdateDocument`, `useChangeDocumentStatus`, `useDeleteDocument`) consuming the API client exclusively.
- Add `src/features/documents/hooks/__tests__/useDocuments.test.ts` — five Vitest tests covering list fetch, detail fetch, cache invalidation, and error-path toasts.

## Capabilities

### New Capabilities

- `document-api-client`: Pure Axios functions encapsulating all HTTP calls for the document domain; the single source of truth for endpoint URLs and request shapes.
- `document-msw-fixtures`: Statically-typed fixture dataset (10 documents) used as the in-memory store for MSW handlers in development.
- `document-msw-handlers`: MSW v2 request handlers that simulate the real backend — pagination, filtering, state-machine validation (RN-DOC-001..006), and audit trail recording.
- `document-query-hooks`: TanStack Query wrappers that connect UI components to the API client; handle cache invalidation, optimistic feedback via Sonner toasts, and role-aware error surfaces.

### Modified Capabilities

## Impact

- `src/api/endpoints/` — new file; no existing files touched.
- `src/mocks/fixtures/` and `src/mocks/handlers/` — new files + one-line addition to `handlers/index.ts`.
- `src/features/documents/hooks/` — new directory; downstream UI components (Spec 3+) import from here.
- Depends on: `document-types`, `document-schemas`, `document-constants`, `document-permissions` (all delivered in Spec 1).
- No breaking changes to existing code.
