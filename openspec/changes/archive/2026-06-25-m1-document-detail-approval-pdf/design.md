## Context

M1 Control Documentario has a working document list (Spec 3) and creation form (Spec 4, including confidencialidad fields added by addendum sync). The route `/documentos/:id` exists as a placeholder in the router. The backend (.NET 10 + PostgreSQL) does not yet exist; MSW v2 is the sole data source.

This change closes the M1 feature loop: document detail view, approval state machine, electronic signature, and the security controls from addendum SHAC-PRD-003-ADD-01 (watermark, signed URLs, download audit trail, confidencialidad access gating).

Existing foundations to reuse:
- `getDocumentPermissions()` at `src/features/documents/utils/documentPermissions.ts`
- `useDocument(id)` TanStack Query hook
- `StatusBadge`, `RevisionSemaforo` shared components
- `Documento`, `DocStatus`, `DocConfidencialidad`, `VersionEntry`, `AuditTrailEntry` types

## Goals / Non-Goals

**Goals:**
- Render `/documentos/:id` with full document metadata, confidencialidad badge, and contextual banners.
- Implement the full approval action panel (BORRADOR → EN_REVISION → EN_APROBACION → PUBLICADO) with role-gated buttons and confirmation modals.
- Implement `DocumentSignatureModal` with PIN validation, inline error on 401, and RN-DOC-004 audit registration.
- Implement `DocumentRejectModal` with motivo textarea and notificarAutor checkbox.
- Implement `DocumentHistorial` and `DocumentAuditTrail` tabs (data from document query, no extra API calls).
- Implement `requestDocumentPdf` / `requestDocumentView` utilities with signed URL flow, DESCARGA/VISUALIZACION audit registration, and dynamic watermark mock.
- Add 5 new MSW handlers; enrich fixtures with addendum fields.
- Add `canAccessDocument()` helper for confidencialidad access gating on the frontend.
- All i18n strings via `t()` (es-PE + en-US), full dark mode coverage.

**Non-Goals:**
- Real server-side PDF generation with restrictive permissions (RN-DOC-010) — deferred to .NET backend.
- Real SHA-256 hashing — mock value `'sha256-mock-' + id` is sufficient for this phase.
- Real email notification for `notificarAutor` — MSW logs it; no email infra exists.
- Real JWT-based signed URL generation — MSW returns a mock URL string.
- Print/copy restriction enforcement (CA-20, CA-24) — TODO comments only.
- Edit form for document metadata (separate concern, covered by Spec 4).

## Decisions

### D1: Two-column layout, action panel sticky
The right column uses `position: sticky; top: <offset>` so the action panel remains visible while scrolling long document metadata. Desktop: `grid-cols-3` (left 2, right 1). Mobile: single column with action panel below header. Avoids a floating fixed panel to prevent z-index conflicts with modals.

### D2: Tabs (Detalle | Historial | Audit Trail) are client-side state, not routes
Using a `useState` tab index rather than sub-routes (`/documentos/:id/historial`) keeps the URL clean and matches existing patterns in the codebase. The audit trail data is already in the document query response — no lazy loading needed.

### D3: DocumentSignatureModal inline error on 401, not toast
The spec requires the modal to stay open with an inline error when the password is wrong. This is implemented by catching the mutation error in `onError` and using `setError('password', { message: ... })` from React Hook Form — no component-level useState. This avoids the confusing UX of a toast firing while a modal is open.

### D4: canAccessDocument() as a pure helper, not a hook
Access gating is synchronous (role + confidencialidad + rolesAutorizados are all available in the document object and authStore). A pure function is easier to test and compose than a hook. It lives alongside `getDocumentPermissions()` in `documentPermissions.ts`.

### D5: requestDocumentPdf / requestDocumentView as async utility functions, not hooks
These functions orchestrate multiple sequential side effects (API calls + window.open). Extracting them as utilities (not hooks) keeps components thin and the logic testable in isolation. They receive `documento` and `user` as arguments, call axios directly (not via TanStack Query mutations), and call `toast` from sonner.

**Alternative considered**: wrapping as mutations in `useDocumentActions`. Rejected because the "mutation" result is opening a window, not server state — TanStack Query's cache invalidation adds no value here.

### D6: MSW in-memory mutation for auditTrail
The existing MSW fixtures are module-level arrays. When `POST /audit/access` runs, it mutates the in-memory fixture array (push). This is the established pattern for MSW state in this project (same as status changes). No persistence across page reloads is needed or expected in mock mode.

### D7: Fixture distribution for confidencialidad
7 total fixtures: 2 PUBLICO, 3 INTERNO, 1 CONFIDENCIAL, 1 RESTRINGIDO. The RESTRINGIDO fixture has `rolesAutorizados: ['JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO']`. This distribution allows testing all four paths in the MSW list filter without an overwhelming fixture count.

### D8: PDF mock opens a new window with inline HTML
No PDF library is used (jsPDF, pdfmake, etc.) — they would add bundle weight for a mock. A `window.open` call with `document.write(html)` produces a printable HTML page with the watermark. The TODO comment points to the .NET backend for real PDF generation. This approach ships immediately, is visually testable, and creates zero production-bundle overhead.

## Risks / Trade-offs

[Risk: Focus trap in modals breaks on non-standard tab order] → Mitigation: use a minimal focus-trap implementation (manual `querySelectorAll('[tabindex], button, input')` on mount) or a lightweight library. Keep the implementation inside each modal's useEffect (the one valid exception to the no-useEffect-for-state rule).

[Risk: MSW in-memory state resets on page reload] → Mitigation: this is expected and acceptable in mock mode. Document it in `documents.fixtures.ts` with a comment.

[Risk: RN-DOC-001 applied client-side in MSW may diverge from backend logic] → Mitigation: the MSW handler checks for a matching `codigo + estado === 'PUBLICADO'` fixture and obsoletes it. The backend will have the authoritative implementation; MSW is only for development validation.

[Risk: canAccessDocument() duplicates backend filtering] → Mitigation: this is intentional — the frontend check is a UX guard (hides buttons), not a security control. RN-DOC-012 states the backend never sends restricted documents in the first place; `canAccessDocument()` only handles edge cases where a document arrives via a direct URL navigation.

[Risk: `window.open` blocked by popup blockers] → Mitigation: call `window.open` synchronously in the click handler (not inside a promise chain). MSW calls are async — trigger the window open with a loading state first, then write content. Alternatively, use an anchor download link if popup is blocked.

## Migration Plan

No migration needed — this adds new files and extends existing MSW fixtures. The router placeholder for `/documentos/:id` is replaced with the real page component. No schema migrations or breaking API changes.

Deployment sequence (when real backend exists):
1. Remove MSW initialization from `main.tsx`.
2. Set `VITE_API_BASE_URL` to production API.
3. Delete mock-specific TODO comments and replace with real PDF endpoint calls.

## Open Questions

1. **Focus trap library**: Should we use a lightweight npm package (`focus-trap-react`) or a hand-rolled implementation? Hand-rolled is simpler to vendor but focus-trap-react handles edge cases (shadow DOM, portal). Decision deferred to implementation — either is acceptable.

2. **Pagination for audit trail**: 20 entries per page using local slice state. If audit trail grows very large (100+ entries), consider virtualization. For now, slice is sufficient.

3. **PIN validation in MSW**: Currently validates against a hardcoded fixture password. Should the fixture include a `password` field per user, or use a single global mock password (e.g., `"123456"`)? Recommendation: global mock password `"123456"` with a comment, to keep fixtures simple.
