## MODIFIED Requirements

### Requirement: DocumentDetailHeader file access buttons
The system SHALL render the document's file-access actions in `DocumentActionPanel` (corrected from an earlier, stale version of this requirement that named `DocumentDetailHeader` — that component carries no file-access buttons in the real code; the requirement name is kept unchanged so archiving replaces it correctly):

- **"Ver documento"** (new, primary action): visible whenever `getDocumentPermissions(estado, docRole).canRead` is true for the current user — including the CA-34 exception for `OBSOLETO` documents (`document-viewer-api`) — and gated by confidencialidad access (`canAccessDocument`). Opens the embedded `DocumentViewer` (`document-viewer`) in a modal, without leaving the page. Does not require `documento.archivoUrl` to be present (unlike the two actions below): the backend resolves what to show per state (`document-viewer-api`).
- **"Ver archivo"** (secondary, existing, unchanged behavior): visible when `hasFileAccess && !!documento.archivoUrl` (`canVerArchivo`). Calls `useGetArchivoUrl`'s `abrirArchivo`, which requests `GET /api/documents/:id/archivo` and opens the resolved signed URL in a new browser tab (`window.open`). The backend registers `VISUALIZACION` in the audit trail when issuing that URL — the frontend makes no separate audit call.
- **"Exportar PDF controlado"** (secondary, existing, unchanged behavior): visible only when `documento.estado === 'PUBLICADO' && hasFileAccess && !!documento.archivoUrl` (`canExportarPdf`). Shows a cosmetic metadata-preview confirmation modal, then calls `useExportarPdfControlado`'s `exportar`, which requests `POST /api/documents/:id/exportar-pdf`, downloads the returned PDF blob (watermarked, hashed), and triggers a `<a download>`. The backend registers `DESCARGA` in the audit trail — the frontend makes no separate audit call.

"Ver documento" SHALL be visually emphasized (primary button style) over "Ver archivo" and "Exportar PDF controlado" (secondary/outline style).

#### Scenario: All three actions visible when access allows
- **WHEN** the user has confidencialidad access, `canRead` is true, and the document is `PUBLICADO` with `archivoUrl` set
- **THEN** "Ver documento", "Ver archivo", and "Exportar PDF controlado" are all visible, with "Ver documento" visually emphasized as the primary action

#### Scenario: Ver documento visible for the aprobador in EN_APROBACION even though the other two are not
- **WHEN** the `docRole APROBADOR` assigned to a document in `EN_APROBACION` views the detail page
- **THEN** "Ver documento" is visible; "Exportar PDF controlado" is not (it requires `estado === 'PUBLICADO'`)

#### Scenario: Ver documento hidden when canRead is false
- **WHEN** a user whose `(estado, docRole)` combination yields `canRead: false` views the document detail page
- **THEN** "Ver documento" is not rendered

#### Scenario: File actions hidden when user lacks confidencialidad access
- **WHEN** the document's `confidencialidad` is `CONFIDENCIAL` and the user's role is `OPERARIO`
- **THEN** none of "Ver documento", "Ver archivo", or "Exportar PDF controlado" is rendered

#### Scenario: Ver archivo opens in a new tab and is audited server-side
- **WHEN** the user clicks "Ver archivo"
- **THEN** a new browser tab opens with the resolved file, and the document's audit trail gains a `VISUALIZACION` entry registered by the backend — the frontend issues no separate `POST /:id/audit/access` call

#### Scenario: Exportar PDF controlado downloads a blob and is audited server-side
- **WHEN** the user confirms "Exportar PDF controlado"
- **THEN** a watermarked PDF blob downloads via `<a download>`, and the document's audit trail gains a `DESCARGA` entry registered by the backend

#### Scenario: Ver documento triggers no separate audit call from the frontend
- **WHEN** the user clicks "Ver documento" and the embedded viewer loads successfully
- **THEN** the frontend does not call `POST /:id/audit/access` — `GET /:id/visor` registers its own `VISUALIZACION` entry server-side (see `document-viewer-api`)
