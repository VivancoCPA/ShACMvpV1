## Context

M1 document downloads currently use two different patterns:
1. `useExportarPdfControlado` (`useDocumentActions.ts:122-158`) — axios POST with `responseType: 'blob'` → `URL.createObjectURL` → temporary `<a download>` → `URL.revokeObjectURL`. This works correctly under MSW because the download happens over `fetch`/`XHR`, which MSW intercepts.
2. `useGetArchivoOriginalUrl` (`useDocumentActions.ts:199-225`) and the inline `archivoDistribucionUrl` button (`DocumentDetailPage.tsx:212-221`) — both call `window.open(url)` on a URL string. For `archivoOriginalUrl` the string comes from `GET /api/documents/:id/archivo-original`, itself a mock-only path (`/mock/originales/:id/...`). For `archivoDistribucionUrl` there is no API call at all — the button reads `documento.archivoDistribucionUrl` straight off the already-loaded document and opens it. `window.open()` is a top-level navigation, which MSW's Service Worker never intercepts, so both buttons 404 against the Vite SPA fallback.

`GET /api/documents/:id/archivo` (used by `useGetArchivoUrl`, the "ver archivo" action) is unaffected — its handler happens to return a real external URL (`https://www.w3.org/...pdf-sample.pdf`), so `window.open` on it actually navigates successfully today. It is out of scope for this fix (no bug reported against it), but the design intentionally does not touch it.

## Goals / Non-Goals

**Goals:**
- Both `archivoOriginalUrl` and `archivoDistribucionUrl` downloads succeed under MSW using the same Blob pattern already proven by `useExportarPdfControlado`.
- Both downloads register a `DESCARGA` audit trail entry (RN-DOC-008), consistent with `exportar-pdf`.
- MSW handlers return a real (placeholder) binary body so the Blob fetch has something to retrieve.

**Non-Goals:**
- Changing confidencialidad guards or RN-DOC-013–018 freeze/lock/role rules — those checks stay exactly where they are (`GET /api/documents/:id/archivo-original` keeps its existing role/state guard).
- Touching `useGetArchivoUrl` / `GET /api/documents/:id/archivo` (already works; not reported as broken).
- Any change to the .NET backend contract — this is a mock-environment-only fix (see CLAUDE.md MSW note added alongside `document-pdf-security` spec).

**Addendum (2026-07-15):** the original non-goal "building a real `.docx`/`.pdf` binary generator" is reversed. Browser verification showed the plain-text placeholder body is not a valid OOXML/PDF file and cannot be opened — see updated Decision 4 below.

## Decisions

**1. Convert `archivo-original` download to axios + Blob, keep the same endpoint.**
`getArchivoOriginalUrl` in `documents.api.ts` currently does a plain JSON GET and returns `{ url, nombre, bloqueado }`. Change the download path to a second axios call with `{ responseType: 'blob' }` against the same `GET /api/documents/:id/archivo-original` endpoint (add an `Accept`-based or explicit query-driven branch server-side, or simpler: keep the metadata GET as-is for `bloqueado`/`nombre` display purposes elsewhere if needed, and have the hook's download action call axios directly with `responseType: 'blob'`). Chosen approach: the hook's `mutationFn` calls `getArchivoOriginalUrl` axios GET with `responseType: 'blob'` directly — the endpoint response becomes a `Blob`, and the MSW handler is updated to return binary content with a `Content-Disposition` filename header (mirroring `exportarPdfControlado`'s handler), matching the established pattern in this codebase exactly.
*Alternative considered*: keep a JSON metadata endpoint separate from a new binary endpoint. Rejected — adds an extra round trip and a new route for no behavioral benefit; `exportar-pdf` already proves a single blob-returning endpoint is sufficient.

**2. Add a new endpoint + hook for `archivoDistribucionUrl` download.**
There is currently no API call backing this button at all. Add `getArchivoDistribucionBlob(id)` in `documents.api.ts` (axios GET `/api/documents/:id/archivo-distribucion`, `responseType: 'blob'`) and a corresponding `useGetArchivoDistribucionUrl()` hook in `useDocumentActions.ts`, following the same shape as `useGetArchivoOriginalUrl`. Add the matching MSW handler. The `DocumentDetailPage.tsx` button switches from `window.open(distUrl, ...)` to calling this hook's action; it keeps using `documento.archivoDistribucionUrl` presence only to decide whether to render the button (`!distUrl` empty state stays as-is).
*Alternative considered*: reuse `archivo-original`'s endpoint with a query param toggle. Rejected — distinct RN-DOC clauses (013 vs 018) and distinct guard logic (original is BORRADOR/EN_REVISION-gated; distribución is PUBLICADO-gated) read more clearly as separate handlers, consistent with how `archivo` and `archivo-original` are already separate handlers today.

**3. Audit trail: register `DESCARGA` server-side in both handlers, not client-side.**
Follow the `exportar-pdf` handler's existing pattern (`makeAuditEntry(doc.id, 'DESCARGA', { timestamp, valorNuevo })`) — append the entry inside the MSW handler when the blob is served, not via a separate client-side `POST /audit/access` call. This avoids a second round trip and matches the precedent already in the codebase for blob downloads.

**4. Real, openable binary content (revised 2026-07-15).**
The original decision (a plain string body tagged with an `application/octet-stream`/`application/pdf` `Content-Type`) is superseded: it satisfies the browser's download mechanism but is not a valid file, so Word/a PDF reader reports it as corrupt. Both handlers now generate a minimal but genuinely valid file:
- `archivo-original`: a minimal valid OOXML `.docx` (a proper zip container with `[Content_Types].xml`, `_rels/.rels`, and `word/document.xml` containing one placeholder paragraph). No third-party `.docx`-writing library is added — the OOXML skeleton is small enough to construct inline (a handful of fixed XML strings zipped together); reuse a zip utility already available in the stack if one exists, otherwise a minimal in-repo zip writer.
- `archivo-distribucion`: a minimal valid `.pdf` generated with `jspdf` (already a dependency, used elsewhere for `exportar-pdf`/reports) — one page with placeholder text naming the document code and version.

Filenames also change: instead of embedding raw fixture data verbatim, both handlers build a human-readable name from `codigo` + `version` (e.g. `REG-CD-001-v1.0-original.docx`, `POL-CD-002-v2.0-distribucion.pdf`), with no raw timestamps or mock-internal path fragments in the visible name.

## Risks / Trade-offs

- **[Risk]** Two similar-but-not-identical blob-download hooks (`useGetArchivoOriginalUrl`, new `useGetArchivoDistribucionUrl`) duplicate a bit of boilerplate (mutation + onSuccess blob-to-anchor logic) → **Mitigation**: keep the duplication minimal and consistent with the existing `useExportarPdfControlado` shape; do not introduce a shared abstraction for two call sites per project convention (no premature abstraction).
- **[Risk]** Changing `getArchivoOriginalUrl`'s response type from JSON metadata to Blob could break other callers that rely on `{ nombre, bloqueado }` metadata → **Mitigation**: audit call sites of `getArchivoOriginalUrl` before changing its signature; if metadata is used elsewhere (e.g. to show the "congelado" badge, which currently reads `documento.archivoOriginalBloqueado` directly off the document, not from this endpoint), no separate metadata fetch needs to change.
- **[Risk, materialized 2026-07-15]** Placeholder binary content was not a real `.docx`/`.pdf` — the downloaded `.docx` failed to open in Word. → **Resolution**: addressed by the revised Decision 4 (minimal valid OOXML `.docx` / `jspdf`-generated `.pdf`) and new scenario CA-DOC-4, which require the file to actually open without error.

## Migration Plan

No data migration. Rollout is a frontend + MSW handler change only, gated behind existing `VITE_ENABLE_MSW`. No rollback concerns beyond reverting the commit — no persisted state changes shape.
