# document-pdf-security

PDF access and security utilities for M1 Control Documentario. Implements the signed URL flow, dynamic watermarking, confidencialidad access guard, and MSW handlers for download/view auditing (RN-DOC-007 to RN-DOC-012).

## Requirements

### Requirement: requestDocumentPdf signed URL flow
The `requestDocumentPdf(documento, user)` function in `src/utils/documentPdf.ts` SHALL implement a three-step mock flow:
1. GET `/documents/:id/download-url` to obtain a signed URL with a 15-minute TTL (RN-DOC-009).
2. POST `/documents/:id/audit/access` with `{ accion: 'DESCARGA', timestamp }` to register the access in the audit trail (RN-DOC-008).
3. Open a new browser window with an HTML document containing a dynamic watermark and the document data (RN-DOC-007).

If the signed URL request returns a 403 (expired URL), the function SHALL display `toast.error` with key `documents:errors.downloadUrlExpired` and not proceed to steps 2 or 3.

#### Scenario: Successful download flow registers DESCARGA and opens window
- **WHEN** `requestDocumentPdf` is called for a valid document with an accessible confidencialidad level
- **THEN** a DESCARGA entry is appended to the audit trail and a new window opens with the PDF mock content

#### Scenario: Expired signed URL shows error toast and stops
- **WHEN** MSW returns 403 for GET /download-url (simulating expiry)
- **THEN** `toast.error` with `documents:errors.downloadUrlExpired` is shown and no new window opens

#### Scenario: DESCARGA registered before window opens
- **WHEN** the download URL is valid
- **THEN** the POST /audit/access call completes before the window is opened (sequential, not parallel)

### Requirement: Dynamic watermark in PDF mock
The HTML content opened by `requestDocumentPdf` SHALL include a visible watermark containing (RN-DOC-007):
- The full name of the downloading user (`user.nombre`).
- The current date and time in Lima timezone (GMT-5) formatted via `new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'full', timeStyle: 'medium' })`.
- The legend: "COPIA NO CONTROLADA — Solo válido al momento de impresión".

If `documento.estado === 'OBSOLETO'`, the HTML SHALL additionally display a prominent heading "OBSOLETO — No usar" in red (RN-DOC-003).

A `TODO` comment SHALL note that server-side PDF generation with real watermarks and restrictive permissions (RN-DOC-010) is deferred until the .NET backend exists.

#### Scenario: Watermark contains user name and Lima timestamp
- **WHEN** the PDF mock HTML is generated
- **THEN** the rendered content includes the user's full name and the Lima-timezone timestamp

#### Scenario: COPIA NO CONTROLADA legend is visible
- **WHEN** the PDF mock opens
- **THEN** the text "COPIA NO CONTROLADA — Solo válido al momento de impresión" is present in the HTML

#### Scenario: OBSOLETO documents show red obsolete heading
- **WHEN** `documento.estado === 'OBSOLETO'` and the PDF mock is generated
- **THEN** the HTML includes a prominent "OBSOLETO — No usar" heading in red color

#### Scenario: TODO comment marks deferred server-side behavior
- **WHEN** a developer reads `documentPdf.ts`
- **THEN** a TODO comment explains that RN-DOC-010 (copy/print restrictions) requires the .NET backend

### Requirement: requestDocumentView signed URL flow
The `requestDocumentView(documento, user)` function SHALL follow the same signed URL and audit registration steps as `requestDocumentPdf`, but:
- POST `/documents/:id/audit/access` with `{ accion: 'VISUALIZACION', timestamp }`.
- Open `documento.archivoUrl` in a new tab (not a generated HTML window).

#### Scenario: View flow registers VISUALIZACION
- **WHEN** `requestDocumentView` is called
- **THEN** a VISUALIZACION entry is appended to the audit trail

#### Scenario: View opens archivoUrl in new tab
- **WHEN** the signed URL is valid
- **THEN** `window.open(documento.archivoUrl, '_blank')` is called after audit registration

### Requirement: Confidencialidad access guard in document utilities
Both `requestDocumentPdf` and `requestDocumentView` SHALL check whether the current user has access rights based on `documento.confidencialidad` before proceeding (RN-DOC-011):
- `PUBLICO`: any authenticated user.
- `INTERNO`: any authenticated user.
- `CONFIDENCIAL`: only `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`.
- `RESTRINGIDO`: only users whose role appears in `documento.rolesAutorizados`.

If the user lacks access, the function SHALL call `toast.error` with key `documents:errors.accessDenied` and return without making any API call.

#### Scenario: OPERARIO blocked from CONFIDENCIAL document
- **WHEN** `requestDocumentPdf` is called by a user with role `OPERARIO` for a CONFIDENCIAL document
- **THEN** `toast.error('documents:errors.accessDenied')` is shown and no API calls are made

#### Scenario: AUDITOR_INTERNO allowed for CONFIDENCIAL document
- **WHEN** `requestDocumentPdf` is called by a user with role `AUDITOR_INTERNO` for a CONFIDENCIAL document
- **THEN** the download flow proceeds normally (no access denied)

#### Scenario: User not in rolesAutorizados blocked from RESTRINGIDO document
- **WHEN** `requestDocumentPdf` is called by a user whose role is not in `documento.rolesAutorizados`
- **THEN** `toast.error('documents:errors.accessDenied')` is shown

#### Scenario: No API call when access is denied
- **WHEN** access is denied due to confidencialidad
- **THEN** neither GET /download-url nor POST /audit/access is called

### Requirement: Signed URL MSW handlers
The MSW handler for `GET /documents/:id/download-url` SHALL return `{ url: 'mock://signed-url-' + id, expiresAt: <ISO timestamp 15 minutes from now> }` wrapped in `ApiResponse`. If the request URL contains the query parameter `?expired=true`, it SHALL return 403 to simulate an expired URL (RN-DOC-009).

The MSW handler for `POST /documents/:id/audit/access` SHALL accept `{ accion: 'DESCARGA' | 'VISUALIZACION', timestamp }` and append an `AuditTrailEntry` to the in-memory document fixture. It SHALL return `{ success: true }`.

#### Scenario: Download URL returns 15-minute TTL
- **WHEN** GET /documents/:id/download-url is called without ?expired=true
- **THEN** MSW returns `{ url: 'mock://signed-url-<id>', expiresAt: <now + 15 min> }` with HTTP 200

#### Scenario: Expired URL returns 403
- **WHEN** GET /documents/:id/download-url?expired=true is called
- **THEN** MSW returns HTTP 403

#### Scenario: POST /audit/access appends entry to in-memory fixture
- **WHEN** POST /documents/:id/audit/access is called with `{ accion: 'DESCARGA', timestamp }`
- **THEN** the document's in-memory auditTrail gains a new entry with `accion: 'DESCARGA'`

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

### Requirement: Confidencialidad filtering in MSW document list
The MSW handler for `GET /documents` (list) SHALL filter fixtures by confidencialidad based on the simulated user role (RN-DOC-012, CA-21, CA-22):
- `CONFIDENCIAL` fixtures SHALL be excluded from results for `OPERARIO` and `SUPERVISOR`.
- `RESTRINGIDO` fixtures SHALL be excluded from results for users not listed in `rolesAutorizados`.

#### Scenario: OPERARIO does not receive CONFIDENCIAL documents in list
- **WHEN** GET /documents is called with a simulated OPERARIO user
- **THEN** documents with `confidencialidad === 'CONFIDENCIAL'` are absent from the response

#### Scenario: User not in rolesAutorizados does not receive RESTRINGIDO document
- **WHEN** GET /documents is called by a user whose role is not in `rolesAutorizados`
- **THEN** the RESTRINGIDO document is absent from the response

### Requirement: Document fixtures enriched with addendum fields
All document fixtures in `src/mocks/fixtures/documents.fixtures.ts` SHALL include:
- `confidencialidad`: distributed as 2 PUBLICO, 3 INTERNO, 1 CONFIDENCIAL, 1 RESTRINGIDO (across 7 fixtures).
- `rolesAutorizados: ['JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO']` on the RESTRINGIDO fixture only.
- `historialVersiones`: 2–3 realistic `VersionEntry` objects per fixture.
- `auditTrail`: 4–6 realistic `AuditTrailEntry` objects per fixture (covering creation, state changes, etc.).

#### Scenario: RESTRINGIDO fixture has rolesAutorizados
- **WHEN** the fixtures are loaded
- **THEN** the fixture with `confidencialidad === 'RESTRINGIDO'` has a non-empty `rolesAutorizados` array

#### Scenario: Every fixture has historialVersiones and auditTrail populated
- **WHEN** any document fixture is retrieved via GET /documents/:id
- **THEN** `historialVersiones` has at least 2 entries and `auditTrail` has at least 4 entries
