## MODIFIED Requirements

### Requirement: DocumentDetailHeader information display
The `DocumentDetailHeader` component SHALL render título, `StatusBadge`, `DocumentConfidencialidadBadge`, `RevisionSemaforo` (when applicable), and the metadata grid (Tipo, Versión, Área, Autor, Revisor, Aprobador, fechaEmision, fechaVigencia, fechaRevisionProxima) all inside a single unified card (`rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated`), matching the card pattern used by `QEHeaderSection` in `QualityEventDetail` — not as a bare, cardless block with a separately-carded metadata grid. Contextual banners (OBSOLETO, QE-vinculados, RESTRINGIDO) and the page's "Volver a lista" back-navigation remain outside this card. It SHALL show a `RevisionSemaforo` when `estado` is `PUBLICADO` or `EN_REVISION_PERIODICA`.

The Autor/Revisor/Aprobador names SHALL be resolved via a `getName(id)` resolver (ultimately backed by `useUserNames`, `user-names-lookup`) passed to `DocumentDetailHeader` as a prop, rather than imported from `src/mocks/` inside the component. `DocumentDetailHeader` itself SHALL NOT call `useUserNames` — see the `DocumentDetailPage` requirement below for where the hook is called.

#### Scenario: Header renders as a single unified card
- **WHEN** the document detail page renders
- **THEN** the título, status/confidencialidad badges, and the metadata grid (Tipo, Versión, Área, Autor, Revisor, Aprobador) are all contained within one card element, not split across a cardless title block and a separate metadata card

#### Scenario: Header shows all document metadata
- **WHEN** a document loads with all optional fields populated
- **THEN** código, título, tipo, versión, área, autor, revisor, aprobador, and all dates are visible within the unified card

#### Scenario: RevisionSemaforo shown for PUBLICADO documents
- **WHEN** `documento.estado === 'PUBLICADO'`
- **THEN** `RevisionSemaforo` renders inside the header card

#### Scenario: Contextual banners remain outside the header card
- **WHEN** `documento.estado === 'OBSOLETO'`, `documento.qeVinculados.length > 0`, or `documento.confidencialidad === 'RESTRINGIDO'`
- **THEN** the corresponding banner renders above the unified header card, not inside it

#### Scenario: RevisionSemaforo shown for EN_REVISION_PERIODICA documents
- **WHEN** `documento.estado === 'EN_REVISION_PERIODICA'`
- **THEN** `RevisionSemaforo` renders in the header

#### Scenario: RevisionSemaforo hidden for non-active states
- **WHEN** `documento.estado` is `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, or `OBSOLETO`
- **THEN** `RevisionSemaforo` is not rendered

#### Scenario: Autor, Revisor, Aprobador show resolved real names, not GUIDs
- **WHEN** the document detail page renders against the real backend and `documento.autorId`/`revisorId`/`aprobadorId` resolve via `GET /api/users/nombres`
- **THEN** the metadata grid shows each resolved display name, never the raw GUID

#### Scenario: Unresolved assignee shows the generic fallback, not the GUID
- **WHEN** `documento.revisorId` does not resolve via `GET /api/users/nombres` (e.g. a stale id)
- **THEN** the Revisor field shows the generic "Usuario no disponible" text, not the raw id

## ADDED Requirements

### Requirement: DocumentDetailPage issues a single names request for header and action panel
`DocumentDetailPage` SHALL call `useUserNames` exactly once with `[documento.autorId, documento.revisorId, documento.aprobadorId]` and pass the resulting `getName` resolver down to both `DocumentDetailHeader` and `DocumentActionPanel` as a prop. Neither child component SHALL call `useUserNames` independently for these ids — this keeps Documentos' name resolution to one HTTP request per page load regardless of how many of these ids a given child needs.

#### Scenario: One request covers both the header and the action panel's PDF preview
- **WHEN** `DocumentDetailPage` renders a document with distinct `autorId`, `revisorId`, and `aprobadorId`
- **THEN** exactly one `GET /api/users/nombres` request is made for the page, and both `DocumentDetailHeader`'s metadata grid and `DocumentActionPanel`'s PDF preview show names resolved from that same request

### Requirement: DocumentActionPanel PDF preview resolves the aprobador's real name
The "Exportar PDF controlado" preview rendered by `DocumentActionPanel` SHALL show the aprobador's resolved display name (via the `getName` prop from `DocumentDetailPage`) in its "Aprobado por" field, instead of importing `resolveUserDisplayName` from `src/mocks/`.

#### Scenario: PDF preview shows the aprobador's real name
- **WHEN** a user with `canExportarPdf` opens the PDF preview for a `PUBLICADO` document with `aprobadorId` set
- **THEN** the "Aprobado por" field in the preview shows the resolved display name, not the raw `aprobadorId`

#### Scenario: PDF preview shows the generic fallback for an unresolved aprobador
- **WHEN** the document's `aprobadorId` does not resolve via `GET /api/users/nombres`
- **THEN** the "Aprobado por" field shows the generic "Usuario no disponible" text, not the raw id
