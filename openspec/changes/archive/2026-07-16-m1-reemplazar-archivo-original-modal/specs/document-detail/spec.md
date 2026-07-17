## MODIFIED Requirements

### Requirement: Reemplazar archivo original dedicated action (RN-DOC-018)
The "Reemplazar archivo original" button in the document detail page's archivo section SHALL open a dedicated modal scoped exclusively to uploading a replacement for the archivo original file — it SHALL NOT navigate to `/documents/:id/edit`, nor expose any other document metadata field (título, tipo, área, etc.). The button and modal SHALL be available when the document `estado` is `BORRADOR` or `EN_REVISION` (RN-DOC-018), gated by `perms.canReplaceArchivoOriginal` — which is `true` only for `docRole` `AUTOR` or `JEFE_CALIDAD`; `REVISOR` and `APROBADOR` never see this button, in any estado. If the document already has an `archivoOriginalUrl`, the modal SHALL display the existing file's name before accepting a new upload, making clear the action replaces the current file. On successful replacement, the system SHALL append an `ARCHIVO_ORIGINAL_ACTUALIZADO` entry to the document's `auditTrail`, recording the previous file's name — the same behavior already validated for the prior in-form replacement flow (CA-31 of ADD-02). The full document edit form (`/documents/:id/edit`) remains available only for `BORRADOR` documents and is no longer responsible for uploading or replacing the archivo original.

#### Scenario: Reemplazar archivo original opens a dedicated modal, not the edit route (CA-DOC-5)
- **WHEN** a user with `canReplaceArchivoOriginal` clicks "Reemplazar archivo original" on a document in `BORRADOR` or `EN_REVISION`
- **THEN** a dedicated modal opens showing only the file upload control, and the router does not navigate to `/documents/:id/edit`

#### Scenario: Only Autor and Jefe de Calidad see the replace button (CA-DOC-6)
- **WHEN** a user whose `docRole` is `REVISOR` or `APROBADOR` views a document's archivo original section, in any estado
- **THEN** the "Reemplazar archivo original" button is not rendered

#### Scenario: Successful replacement registers audit trail entry (CA-DOC-7)
- **WHEN** a user completes a replacement via the dedicated modal
- **THEN** an `ARCHIVO_ORIGINAL_ACTUALIZADO` entry is appended to `auditTrail`, recording the previous file's name
