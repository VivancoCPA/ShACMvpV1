## Context

Spec 1 delivered the complete type layer for M1 (`DocStatus`, `DocType`, `DocRole`, `Documento`, Zod schemas, `DOC_STATUS_TRANSITIONS`, `getDocumentPermissions`). Spec 2 builds on that foundation to add the full data layer: a pure Axios API client, realistic MSW fixtures and handlers, TanStack Query hooks, and their tests.

The .NET 10 backend does not yet exist. MSW v2 is the only data source in development. The three-layer data flow is:

```
UI Component → TanStack Query Hook → documents.api.ts (Axios) → MSW interceptor → in-memory fixtures
```

No layer knows whether the layer below it is real or mocked.

## Goals / Non-Goals

**Goals:**
- Define six pure Axios functions in `documents.api.ts` as the sole HTTP interface for the document domain.
- Provide 10 realistic fixture documents covering all states, types, and edge cases required by downstream tests.
- Implement six MSW v2 handlers that enforce M1 business rules (RN-DOC-001..006) at the mock layer.
- Wrap all API calls in TanStack Query hooks with correct cache invalidation and Sonner feedback.
- Achieve ≥ 5 Vitest tests covering the critical paths and error surfaces of the hooks.

**Non-Goals:**
- React components or page layout — deferred to Spec 3.
- i18n translation file content (`es-PE.json` / `en-US.json`) — keys are declared here; values deferred to UI spec.
- Authentication interceptors — already implemented in `src/lib/axios.ts`.
- Backend API integration or contract testing — deferred until backend exists.
- Audit trail persistence beyond what MSW records in the in-memory fixture array.

## Decisions

### D1 — Pure API functions separated from hooks

**Decision:** `documents.api.ts` exports six plain async functions; hooks in `useDocuments.ts` import and call them exclusively.

**Rationale:** (a) Functions are testable without a React wrapper. (b) If a mutation needs to be called outside a component (e.g., an event listener or a Zustand action), the function is directly importable. (c) When the real backend ships, only `documents.api.ts` changes — zero hook modifications.

**Alternative considered:** Inline `axios.get(...)` directly inside `useQuery` fetchers. Rejected: leaks HTTP details into hook layer, complicates testing, and violates the project's layering convention.

### D2 — MSW in-memory state as a mutable module-level array

**Decision:** The handler module initializes a `let documents = [...documentFixtures]` array on import. All mutation handlers (`POST`, `PUT`, `DELETE`, status change) update this array in place. The array resets to fixtures on every page reload.

**Rationale:** Simplest approach that gives realistic CRUD behavior. No external state store, no IndexedDB, no service worker persistence. Fixture reset on reload is acceptable — and desirable — in development: each session starts from a known good state.

**Alternative considered:** Persisting state in `localStorage` via the service worker. Rejected: adds complexity with no benefit; fixtures are deterministic by design.

### D3 — Business rule enforcement inside MSW handlers

**Decision:** The `POST /api/documents/:id/status` handler imports `DOC_STATUS_TRANSITIONS` from `document-constants` and `getDocumentPermissions` from `document-permissions` to validate RN-DOC-001..006 before mutating state.

**Rationale:** Developers should experience realistic rejection behavior during development, not discover rule violations only when the backend is wired up. Importing the same helpers that production code will use means the mock and the real implementation share the same rule definitions — drift is structurally prevented.

### D4 — Cache invalidation scope

**Decision:** `useCreateDocument` and `useDeleteDocument` invalidate `QUERY_KEYS.documents.all`. `useUpdateDocument` and `useChangeDocumentStatus` also invalidate `QUERY_KEYS.documents.all`, which cascades to all list and detail queries.

**Rationale:** A `changeDocumentStatus` to `PUBLICADO` triggers RN-DOC-001 (the previous published version must be set to `OBSOLETO` by the server). The list must refresh to reflect the obsoleted document. Invalidating only `detail(id)` would miss the stale list entry. Broad invalidation is safe here because the stale time is 5 minutes (queryClient global), so most fetches are served from cache anyway.

### D5 — Toast key namespace

**Decision:** All Sonner toasts in hooks use `t('documents:toasts.*')` keys. Keys are declared in this spec as normative requirements; translation values are filled in during the UI spec (Spec 3).

**Rationale:** Decouples hook behavior from translation content. The key contract is testable (toast called with the right key) without needing translation files to exist yet.

## Risks / Trade-offs

- **[Risk] MSW state resets on page reload** → Mitigation: intentional; deterministic fixture state per session is a development feature, not a bug. Document it in `mocks/README`.
- **[Risk] RN-DOC-004 PIN validation is nominal in MSW** → Mitigation: the handler checks that `firma` is a non-empty string — it does not validate the PIN value. Real validation belongs to the backend. The hook and schema enforce the field's presence.
- **[Risk] Broad cache invalidation may cause waterfall re-fetches** → Mitigation: `invalidateQueries` is async and non-blocking; TanStack Query deduplicates in-flight requests. At current data scale (< 100 documents) this is negligible.
- **[Risk] Toast i18n keys used in hooks before translation files exist** → Mitigation: `react-i18next` returns the key itself when no translation is found, so hooks are functional (albeit with raw key strings) until Spec 3 fills translations.

## Open Questions

- Should `useChangeDocumentStatus` show an optimistic UI update before the MSW response? Deferred — current spec uses server-confirmed update only. Revisit if perceived latency is a UX problem.
