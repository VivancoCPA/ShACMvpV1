## Why

M1 (Control Documentario) has its data layer complete (types, schemas, constants, permissions, API, MSW handlers from Spec 1 & 2), but has no user-facing view. Users cannot yet browse, filter, or navigate documents. This change delivers the primary list view that makes the module functional.

## What Changes

- New `DocumentsPage` as the module's entry route under `/documents`
- `DocumentListFilters` component — search input (debounced 300 ms), Estado/Tipo/Área selects, all state persisted in URL search params
- `DocumentList` table — 8 columns, pageSize-20 pagination, skeleton loading, empty state, error+retry states
- `DocumentListRow` — per-row rendering with role-based action buttons via `getDocumentPermissions()`, QE-active warning icon (RN-DOC-005)
- `StatusBadge` shared component (`src/components/shared/`) — pill badge for `DocStatus` and `QEStatus`, dark-mode aware, reusable in M2–M4
- `RevisionSemaforo` — 4-tier color indicator (green/yellow/red/red-pulse) with accessible tooltip for upcoming review dates
- `useDocumentList` hook — reads filters from URL params, delegates to `useDocuments()` from Spec 2
- `ErrorBoundary` wrapper in `DocumentsPage`
- i18n keys in `documents` namespace for `es-PE` and `en-US`

## Capabilities

### New Capabilities

- `document-list-view`: Paginated, filterable document table with StatusBadge, RevisionSemaforo, role-based actions, and URL-persisted filter state — the main entry point of M1

### Modified Capabilities

<!-- None — types, schemas, constants, and permissions specs from Spec 1 & 2 remain unchanged -->

## Impact

- **New files**: `src/features/documents/components/DocumentList.tsx`, `DocumentListFilters.tsx`, `DocumentListRow.tsx`, `RevisionSemaforo.tsx`; `src/features/documents/hooks/useDocumentList.ts`; `src/features/documents/pages/DocumentsPage.tsx`; `src/components/shared/StatusBadge.tsx`
- **Modified files**: `src/i18n/es-PE.json`, `src/i18n/en-US.json` (additive keys under `documents` namespace)
- **No MSW changes**: handlers already exist from Spec 2; no new endpoints needed
- **No breaking changes**: StatusBadge is new; does not replace any existing component
- **Router**: `DocumentsPage` must be registered under `/documents` in the app router (out of scope here — to be wired in a route-setup change)
