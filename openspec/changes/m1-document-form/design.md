## Context

M1 has three completed specs: types/schemas (M1-S01), API+MSW+hooks (M1-S02), and DocumentList with filters and pagination (M1-S03). The layout shell, router, RoleGuard, auth flows, and Sonner notifications are all in place. The backend does not exist — MSW v2 is the only data source. The `useDocument(id)` hook already fetches a single document for the edit pre-populate.

The form must handle two modes from a single page component. Mode detection happens via route: `/documents/new` → create, `/documents/:id/edit` → edit. The distinction must not leak into child components; `DocumentForm` receives only a typed `defaultValues` prop and an `onSubmit` callback.

## Goals / Non-Goals

**Goals:**
- Create and edit `BORRADOR` documents via validated RHF + Zod form
- Simulate file upload with progress bar and inline validation
- Enforce role-based access at the route level (RoleGuard) and state-level (edit blocks non-BORRADOR)
- Register all endpoints in MSW v2 (POST /api/documents already exists; add POST /api/documents/:id/upload)
- Full i18n in `documents` namespace, both locales

**Non-Goals:**
- Document signing (Spec 5)
- State transitions beyond creating/updating `BORRADOR`
- Real file transfer or SHA-256 computation (MSW returns mock values)
- Testing upload with multipart/form-data validation in MSW (not supported)

## Decisions

### D1 — Mode detection in the page, not the form

`DocumentFormPage` reads `useParams()` and `useLocation()` to determine create vs edit, fetches the document if in edit mode, then passes `defaultValues` and `onSubmit` down to the stateless `DocumentForm`. This keeps `DocumentForm` a pure controlled component with no routing knowledge.

**Alternative considered**: Single component with internal mode detection via `id` prop. Rejected because it mixes routing concerns with form logic and makes `DocumentForm` harder to test.

### D2 — fechaRevisionProxima auto-calculation in the hook, not Zod

`fechaRevisionProxima` is derived from `fechaVigencia + 365 days` only when the user leaves `fechaRevisionProxima` empty. This calculation happens in `useDocumentForm.onSubmit` before the API call, not in the Zod schema, because Zod runs on user input and the user is allowed to override the default.

**Alternative considered**: Zod `.transform()` to inject the default. Rejected because transforms run on every validation pass, and the transformed value would not be reflected in the form field — confusing UX.

### D3 — FileUploadField is self-contained, not a RHF controller

`FileUploadField` manages its own `File | null` state and exposes a simple `onChange(file: File | null)` prop. The parent form stores the file reference via `setValue('archivo', file)` using a `useController`-free approach. Upload to the API is triggered by `useDocumentForm` on submit, not inside the component.

**Alternative considered**: `Controller`-wrapped field that uploads on selection. Rejected because it would make the upload lifecycle tied to validation, not submission, and complicates error handling.

### D4 — Simulated upload progress via setTimeout cascade

Progress goes from 0 → 100% in steps using `setTimeout` (not `setInterval`) to avoid drift. Total duration ~1.5 s matches typical user perception of "fast upload." The component cleans up pending timeouts on unmount.

### D5 — MSW file upload handler returns deterministic mock values

`POST /api/documents/:id/upload` returns a fixed `archivoUrl` (`/mock/uploads/{id}/{filename}`) and a deterministic `hashArchivo` (SHA-256-formatted hex string based on filename). This is sufficient for development since the backend does not exist. Document in CLAUDE.md: MSW does not validate multipart/form-data.

### D6 — Edit mode blocks non-BORRADOR at the page level, not the router

After fetching the document, `DocumentFormPage` checks `documento.estado !== 'BORRADOR'` and renders an inline error card instead of the form. This is cleaner than a redirect (which loses the URL context) and more honest than a RoleGuard-level block (which is for role, not state).

## Risks / Trade-offs

- **MSW multipart limitation** → The upload handler receives a raw `Request` object but cannot parse multipart boundaries in browser MSW. Mitigation: handler ignores the body and returns a mock response; a comment in the handler warns future developers.
- **fechaRevisionProxima drift** → If the user sets fechaVigencia after fechaRevisionProxima, the auto-fill fires on submit but the field shows the old value. Mitigation: watch `fechaVigencia` in the form and reset `fechaRevisionProxima` when it changes (implemented in `useDocumentForm`).
- **Race condition on edit pre-populate** → If `useDocument` returns stale cache data, the form pre-populates with old values. Mitigation: the query uses `staleTime: 0` for the edit route, ensuring a fresh fetch on mount.
- **RoleGuard redirect loop** → If a `SUPERVISOR` tries to create (only edit is allowed), RoleGuard redirects to `/no-autorizado`. The back button works normally; no loop.
