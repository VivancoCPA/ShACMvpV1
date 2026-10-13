## MODIFIED Requirements

### Requirement: DocumentDetailHeader file access buttons
The system SHALL render the document's file-access actions in `DocumentActionPanel`:

- **"Ver documento"** (primary action): visible whenever `getDocumentPermissions(estado, docRole).canRead` is true for the current user — including the CA-34 exception for `OBSOLETO` documents (`document-viewer-api`) — and gated by confidencialidad access (`canAccessDocument`). Opens the embedded `DocumentViewer` (`document-viewer`) in a modal, without leaving the page.
- **"Descargar copia (PDF)"** (secondary action, renamed from "Exportar PDF controlado"; replaces both the former "Exportar PDF controlado" button and the "Descargar PDF de distribución" button of `DocumentDetailPage`): visible when `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}` and the user has confidencialidad access and `canRead` — it SHALL NOT depend on `documento.archivoUrl` (that field does not exist; the backend resolves what to export by `estado`, same criterion as "Ver documento"). Shows the existing cosmetic metadata-preview confirmation modal, then calls `POST /api/documents/:id/exportar-pdf` (`document-copia-controlada`), downloads the returned watermarked PDF blob, and triggers a `<a download>`. The backend registers `DESCARGA` in the audit trail — the frontend makes no separate audit call. A help text near the button SHALL read "La copia descargada lleva tu nombre y la fecha; es una COPIA NO CONTROLADA".
- **"Ver archivo"** (removed — see `document-copia-controlada`, "Circuito de URL firmada retirado"): the button and its underlying hook no longer exist; `GET /:id/archivo` is retired.

"Ver documento" SHALL be visually emphasized (primary button style) over "Descargar copia (PDF)" (secondary/outline style). In `OBSOLETO`, only "Ver documento" SHALL be shown — no download action is available (RN-DOC-003).

#### Scenario: Ver documento and Descargar copia both visible for a PUBLICADO document
- **WHEN** the user has confidencialidad access and `canRead` is true for a document in `PUBLICADO`
- **THEN** "Ver documento" and "Descargar copia (PDF)" are both visible, with "Ver documento" visually emphasized as the primary action

#### Scenario: Descargar copia visible in EN_REVISION_PERIODICA
- **WHEN** the user has confidencialidad access and `canRead` is true for a document in `EN_REVISION_PERIODICA`
- **THEN** "Descargar copia (PDF)" is visible

#### Scenario: Descargar copia hidden for a document in process
- **WHEN** a document is `BORRADOR`, `EN_REVISION`, or `EN_APROBACION`
- **THEN** "Descargar copia (PDF)" is not rendered, regardless of `canRead`

#### Scenario: OBSOLETO shows only Ver documento, no download
- **WHEN** a user with access views a document in `OBSOLETO`
- **THEN** "Ver documento" is visible and "Descargar copia (PDF)" is not rendered

#### Scenario: Ver documento hidden when canRead is false
- **WHEN** a user whose `(estado, docRole)` combination yields `canRead: false` views the document detail page
- **THEN** "Ver documento" is not rendered

#### Scenario: File actions hidden when user lacks confidencialidad access
- **WHEN** the document's `confidencialidad` is `CONFIDENCIAL` and the user's role is `OPERARIO`
- **THEN** neither "Ver documento" nor "Descargar copia (PDF)" is rendered

#### Scenario: Descargar copia downloads a watermarked blob and is audited server-side
- **WHEN** the user confirms "Descargar copia (PDF)"
- **THEN** a watermarked PDF blob downloads via `<a download>`, and the document's audit trail gains a `DESCARGA` entry registered by the backend

#### Scenario: Ver documento triggers no separate audit call from the frontend
- **WHEN** the user clicks "Ver documento" and the embedded viewer loads successfully
- **THEN** the frontend does not call `POST /:id/audit/access` — `GET /:id/visor` registers its own `VISUALIZACION` entry server-side (see `document-viewer-api`)

#### Scenario: Help text explains the watermark
- **WHEN** "Descargar copia (PDF)" is visible
- **THEN** a help text reading "La copia descargada lleva tu nombre y la fecha; es una COPIA NO CONTROLADA" is visible near the button
