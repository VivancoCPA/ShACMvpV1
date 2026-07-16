## Why

Clicking "Descargar archivo original" or "Descargar PDF de distribución" on a document detail page (`DocumentDetailPage.tsx`) results in the app's "Página no encontrada" screen instead of a download. Root cause (confirmed): `useGetArchivoOriginalUrl` (`src/features/documents/hooks/useDocumentActions.ts:199-225`) and the inline `archivoDistribucionUrl` button handler (`src/features/documents/pages/DocumentDetailPage.tsx:215`) both call `window.open(url)` directly on mock-only URL strings produced by MSW fixtures (e.g. `/mock/originales/:id/...`). MSW in Service Worker mode only intercepts `fetch`/`XHR`, never a top-level browser navigation — so `window.open()` on these strings triggers a real navigation that falls through to the Vite SPA fallback and lands on `NotFoundPage`. This affects both M1 download buttons and blocks verifying RN-DOC-013–018 (dual file model) end-to-end in the browser.

## What Changes

- Replace the `window.open(url)` calls in `useGetArchivoOriginalUrl` and the `archivoDistribucionUrl` download button with the Blob-fetch pattern: axios request (intercepted by MSW) → `Blob` response → `URL.createObjectURL` → temporary `<a download>` element → `URL.revokeObjectURL`. `useExportarPdfControlado` (same file, lines 122–158) already implements this correctly and serves as the reference.
- Update the MSW handler `GET /api/documents/:id/archivo-original` to respond with a real binary `Blob` body (minimal placeholder content, not a real `.docx`) instead of only a URL string, so the frontend has a real resource to fetch.
- Add a new axios endpoint + MSW handler for downloading `archivoDistribucionUrl` content as a `Blob` (currently there is no API call at all for this button — it reads the URL directly off the already-loaded `documento` object and calls `window.open` on it).
- Ensure both flows append a `DESCARGA` entry to the document's `auditTrail` (RN-DOC-008) on successful download — the archivo-original handler currently does not register one, and the distribution download currently makes no API call at all, so this is new behavior, not preserved behavior.
- No changes to confidencialidad guards, freeze/lock rules (RN-DOC-013–018), or watermark/PDF-permission rules (RN-DOC-007, RN-DOC-010).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `document-pdf-security`: adds the "Blob-based download pattern for mock file URLs" requirement (RN-DOC-009 adjustment, scenarios CA-DOC-1/2/3/4) — this delta formalizes the requirement already applied to `openspec/specs/document-pdf-security/spec.md` via a prior sync, so implementation has a traceable target. Addendum (2026-07-15): CA-DOC-4 was added after browser verification showed the placeholder `.docx` returned by the handler is not a valid OOXML file and cannot be opened in Word — the mock content must now be a genuinely valid, openable `.docx`/`.pdf`, with a legible suggested filename.

## Impact

- `src/features/documents/hooks/useDocumentActions.ts` (`useGetArchivoOriginalUrl`)
- `src/features/documents/pages/DocumentDetailPage.tsx` (archivoDistribucionUrl button)
- `src/api/endpoints/documents.api.ts` (new/updated endpoint functions returning `Blob`)
- `src/mocks/handlers/documents.handlers.ts` (`GET /api/documents/:id/archivo-original`, new distribución download handler)
- No breaking changes; no changes to public route paths or RBAC.
