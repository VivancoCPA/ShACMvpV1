## MODIFIED Requirements

### Requirement: Blob-based download pattern for mock file URLs (RN-DOC-009 adjustment)
Any M1 UI action that triggers a file download from a mock-provided URL string — including `archivoOriginalUrl` (RN-DOC-013) and `archivoDistribucionUrl` (RN-DOC-018) — SHALL NOT call `window.open(url)` directly on that string. `window.open()` triggers a top-level browser navigation, which MSW in Service Worker mode never intercepts (it only intercepts `fetch`/`XHR`); navigating to a mock-only path (e.g. `/mock/originales/:id/...`) falls through to the Vite SPA fallback and lands on the app's `NotFoundPage` instead of downloading a file.

The frontend SHALL instead: (1) request the file via `fetch`/axios (intercepted by MSW), (2) read the response as a `Blob`, (3) create an object URL with `URL.createObjectURL(blob)`, (4) trigger the download via a temporary `<a download>` element created and appended to the DOM, clicked, then removed, and (5) revoke the object URL afterward.

The MSW handlers `GET /api/documents/:id/archivo-original` and the equivalent handler serving `archivoDistribucionUrl` SHALL respond with a real binary `Blob` that is genuinely valid and openable in its corresponding application — not merely a byte sequence that satisfies the download mechanism:
- For `archivo-original`: a minimal but valid OOXML `.docx` (openable in Word/LibreOffice without error; a single line of placeholder text is sufficient, no elaborate content required).
- For `archivo-distribucion`: a minimal but valid `.pdf`, generated with `jspdf` (already in the stack), with a single placeholder page.

The suggested filename for the download (`Content-Disposition` header and/or the `<a download>` attribute) SHALL be human-readable and coherent with the document — e.g. `REG-CD-001-v1.0-original.docx` — and SHALL NOT expose raw timestamps or mock-internal paths as part of the visible name.

This Blob conversion is a limitation exclusive to the mocked environment (MSW cannot intercept top-level navigations). The real .NET backend SHALL continue to return directly navigable pre-signed storage URLs; once that backend exists, the frontend may revert to plain `window.open(url)` or keep the Blob pattern for consistency — that choice is deferred until the backend exists.

#### Scenario: Downloading archivo original produces a real file, not a 404 (CA-DOC-1)
- **WHEN** a user with permission clicks "Descargar archivo original" on a document in `BORRADOR` or `EN_REVISION`
- **THEN** the browser downloads a file via the Blob/object-URL pattern; it does not navigate to the app's "Página no encontrada" route

#### Scenario: Downloading distribution PDF produces a real file, not a 404 (CA-DOC-2)
- **WHEN** a user with permission clicks "Descargar PDF de distribución" on a document in `PUBLICADO`
- **THEN** the browser downloads a file via the Blob/object-URL pattern; it does not navigate to the app's "Página no encontrada" route

#### Scenario: Download still registers DESCARGA in the audit trail (CA-DOC-3)
- **WHEN** either download completes via the Blob pattern
- **THEN** a `DESCARGA` entry is appended to the document's `auditTrail` (RN-DOC-008), registered server-side by the MSW handler

#### Scenario: Downloaded file is genuinely openable with a legible name (CA-DOC-4)
- **WHEN** a user downloads the archivo original or the PDF de distribución
- **THEN** the file opens without errors in its corresponding application (Word/LibreOffice for `.docx`, a PDF reader for `.pdf`), and its suggested filename is legible and does not expose internal timestamps or mock paths
