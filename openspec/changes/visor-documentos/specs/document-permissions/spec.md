## MODIFIED Requirements

### Requirement: PUBLICADO state permissions
The system SHALL implement the PUBLICADO permissions matrix:
- `AUTOR`: canRead = true; all write flags = false (sin acceso de edición — ver nota debajo).
- `REVISOR`: canRead = true; all write flags = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canStartReview = true; canEdit, canDelete, canComment, canApprove, canReject, canSign, canCancelReview = false.
- `OPERARIO`: canRead = true; all write flags = false.

**autor-lectura-publicado (2026-10-08, decisión de Toño):** el PRD §4.2 describe la celda AUTOR×PUBLICADO como "Sin acceso", que se implementó originalmente como `DenyAll` (incluyendo `canRead`). Decisión explícita: esa celda del PRD se refería a edición, no a lectura — el autor de un documento SHALL poder leer su propio documento una vez publicado, igual que REVISOR/APROBADOR. Esto diverge a propósito del texto literal del PRD; `canEdit`, `canDelete` y `canStartReview` siguen en `false` para AUTOR — solo `canRead` (y, por derivación, `canViewArchivoDistribucion`) cambia.

#### Scenario: JEFE_CALIDAD can initiate periodic review from PUBLICADO
- **WHEN** `getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD')` is called
- **THEN** `canStartReview` is `true`, `canEdit` is `false`

#### Scenario: OPERARIO can read a PUBLICADO document
- **WHEN** `getDocumentPermissions('PUBLICADO', 'OPERARIO')` is called
- **THEN** `canRead` is `true` and all write flags are `false`

#### Scenario: AUTOR can read (but not edit) a PUBLICADO document
- **WHEN** `getDocumentPermissions('PUBLICADO', 'AUTOR')` is called
- **THEN** `canRead` is `true`, and `canEdit`, `canDelete`, `canStartReview` are `false`

### Requirement: OBSOLETO state permissions enforces RN-DOC-003 read-only
The system SHALL implement the OBSOLETO permissions matrix such that no role can perform any write action. `REVISOR`, `APROBADOR`, `JEFE_CALIDAD`, and `AUTOR` can read; `OPERARIO` has no access.

**autor-lectura-publicado (2026-10-08, decisión de Toño):** mismo razonamiento que PUBLICADO — AUTOR lee su documento OBSOLETO (con el sello "OBSOLETO — No usar" aplicado por `document-viewer-api`), pero no puede editarlo ni ninguna otra acción de escritura (RN-DOC-003 sigue sin excepciones de escritura para ningún rol).

#### Scenario: No role can edit or delete an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', rol)` is called for any `rol`
- **THEN** `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview`, `canCancelReview` are all `false`

#### Scenario: REVISOR can read an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', 'REVISOR')` is called
- **THEN** `canRead` is `true`

#### Scenario: OPERARIO cannot read an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', 'OPERARIO')` is called
- **THEN** `canRead` is `false`

#### Scenario: AUTOR can read (but not edit) an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', 'AUTOR')` is called
- **THEN** `canRead` is `true`, and `canEdit`, `canDelete` are `false`
