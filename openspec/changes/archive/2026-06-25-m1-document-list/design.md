## Context

M1 Control Documentario has a complete data layer from Spec 1 (types, schemas, constants, permissions) and Spec 2 (API client, MSW handlers, TanStack Query hooks). This change adds the UI layer on top of that foundation — no new endpoints, no new types, no MSW handler additions. The backend still does not exist; MSW continues to be the data source.

Key constraints from CLAUDE.md:
- No `useState` for filter fields — all state must live in URL search params
- No `useEffect` to derive state — `useMemo` or TanStack Query instead
- Dark mode variant required on every Tailwind class
- `getDocumentPermissions()` from Spec 1 is the single source of truth for what actions appear per row

## Goals / Non-Goals

**Goals:**
- `DocumentsPage` as the entry point of M1 (`/documents` route), composing filters + list
- `DocumentListFilters` with debounced search, estado/tipo/área selects, URL-persisted state
- `DocumentList` table with 8 columns, pagination, skeleton, empty, and error states
- `DocumentListRow` with role-based action buttons via `getDocumentPermissions()` and RN-DOC-005 warning icon
- `StatusBadge` shared component (pill, dark-mode, i18n-keyed) reusable across M2–M4
- `RevisionSemaforo` with 4-tier color logic and accessible tooltip
- `useDocumentList` hook — URL params → `useDocuments()` → caller-ready data shape
- Full `es-PE` + `en-US` i18n coverage for all visible strings

**Non-Goals:**
- App router wiring for `/documents` (separate route-setup task)
- Document detail page (`/documents/:id`)
- Create/edit document forms (Spec 4+)
- Deleting or transitioning document state from the list (Spec 4+)
- Virtual scrolling (pageSize-20 pagination satisfies rule #9 at current data volumes)

## Decisions

**D1 — URL search params as the only filter state store**
`useSearchParams` from react-router-dom holds `search`, `estado`, `tipo`, `area`, and `page`. `DocumentListFilters` reads and writes params directly; `useDocumentList` reads params and maps them to `DocFilters`. No `useState`, no `useEffect`, no Zustand slice for filters.
*Why*: Sharable URLs, browser back/forward works correctly, satisfies CLAUDE.md rule #1.
*Alternative rejected*: Zustand slice — overkill for transient filter state that belongs in the URL.

**D2 — StatusBadge lives in `src/components/shared/`, not `features/documents/`**
The component accepts `DocStatus | QEStatus` and maps to semantic color tokens. Placing it in `shared/` avoids duplication when M2–M4 need the same badge.
*Why*: The proposal explicitly marks it reusable; keeping it feature-local would force copy-paste later.

**D3 — Skeleton rows over a global spinner for list loading**
5 skeleton rows mimic the real table layout, preserving visual stability. A page-level spinner causes layout shift when data arrives.
*Why*: Better perceived performance; aligns with CLAUDE.md "skeleton, no global spinner" spec.

**D4 — ErrorBoundary wraps `DocumentList` only, not `DocumentsPage`**
Filters and the "Nuevo Documento" button should remain interactive even when the list fails. A page-level boundary would unmount the entire view on a network error.
*Why*: Minimizes blast radius on error per CLAUDE.md rule #11.

**D5 — `useDocumentList` is a pure data-mapping hook, zero UI**
The hook reads URL params, calls `useDocuments()`, and returns a clean shape. `DocumentList` handles all conditional rendering. This keeps the hook testable without a DOM.
*Why*: Follows the hook/component separation convention in the existing codebase.

**D6 — RevisionSemaforo date math via `date-fns` `differenceInCalendarDays`**
Date arithmetic with `Intl.DateTimeFormat` is error-prone across timezones. `date-fns` is already available in the stack and provides locale-safe calendar-day diff.
*Why*: Consistent, tested date math; avoids `toLocaleDateString()` without explicit locale (CLAUDE.md rule #5).

**D7 — Tooltip in RevisionSemaforo is inline HTML, not a library component**
A `<span role="tooltip">` positioned with `group-hover:visible` covers the requirement without adding a new dependency. The component is self-contained.
*Why*: No headless-UI or Radix dependency needed for a single use-case tooltip.

## Risks / Trade-offs

- **URL param pollution** → Cleared by the "Limpiar filtros" button, which replaces all params. Low risk; standard pattern.
- **StatusBadge QEStatus values unused in M1** → The union type is forward-declared; unused values have no runtime cost. They will be exercised in M2–M4.
- **Date math depends on client clock** → RevisionSemaforo compares `fechaRevisionProxima` against `new Date()`. If the client clock is wrong, semaphore color will be off. Acceptable for an indicator; not used for enforcement.
- **`useDocuments` pagination contract** → This change assumes `useDocuments` returns `{ data, isLoading, isError, refetch }` and `data.pagination` from Spec 2. If that shape changes, `useDocumentList` must be updated.
