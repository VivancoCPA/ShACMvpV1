## ADDED Requirements

### Requirement: getDocumentPermissions pure function
The system SHALL export a `getDocumentPermissions(estado: DocStatus, rol: DocRole, context?: { isAssignedAuthor?: boolean })` function from `src/features/documents/permissions.ts` that returns a `DocumentPermissions` object with nine boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview`, `canCancelReview`. When `context` is omitted it SHALL default to `{ isAssignedAuthor: false }`.

#### Scenario: Function returns a complete permissions object for any valid input
- **WHEN** `getDocumentPermissions` is called with any valid `DocStatus` × `DocRole` combination
- **THEN** the returned object contains all nine boolean flags with no undefined values

#### Scenario: Omitting context defaults isAssignedAuthor to false
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR')` is called without a third argument
- **THEN** the result is the same as passing `{ isAssignedAuthor: false }` explicitly

### Requirement: BORRADOR state permissions
The system SHALL implement the BORRADOR permissions matrix:
- `AUTOR`: canRead, canEdit, canDelete = true; canComment = false; canApprove, canReject, canSign, canStartReview = false.
- `REVISOR`: canRead = true; all write flags = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canEdit, canComment = true; canDelete = false; canApprove, canReject, canSign, canStartReview = false.
- `OPERARIO`: all flags = false (sin acceso).

#### Scenario: AUTOR can edit and delete in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'AUTOR')` is called
- **THEN** `canEdit` is `true`, `canDelete` is `true`, and `canRead` is `true`

#### Scenario: OPERARIO has no access in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'OPERARIO')` is called
- **THEN** all eight flags are `false`

#### Scenario: JEFE_CALIDAD can edit and comment in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'JEFE_CALIDAD')` is called
- **THEN** `canEdit` is `true`, `canComment` is `true`, `canDelete` is `false`

### Requirement: EN_REVISION state permissions
The system SHALL implement the EN_REVISION permissions matrix:
- `AUTOR`: canRead = true; all write flags = false.
- `REVISOR`: canRead, canComment, canApprove, canReject = true; canEdit, canDelete, canSign, canStartReview = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canEdit, canComment = true; canApprove, canReject, canSign, canStartReview = false.
- `OPERARIO`: all flags = false.

#### Scenario: REVISOR can approve and reject in EN_REVISION
- **WHEN** `getDocumentPermissions('EN_REVISION', 'REVISOR')` is called
- **THEN** `canApprove` is `true`, `canReject` is `true`, `canComment` is `true`

#### Scenario: AUTOR cannot edit in EN_REVISION
- **WHEN** `getDocumentPermissions('EN_REVISION', 'AUTOR')` is called
- **THEN** `canEdit` is `false`

### Requirement: EN_APROBACION state permissions
The system SHALL implement the EN_APROBACION permissions matrix:
- `AUTOR`: canRead = true; all write flags = false.
- `REVISOR`: canRead = true; all write flags = false.
- `APROBADOR`: canRead, canSign, canReject = true; canEdit, canDelete, canComment, canApprove, canStartReview = false.
- `JEFE_CALIDAD`: canRead = true; all write flags = false.
- `OPERARIO`: all flags = false.

#### Scenario: APROBADOR can sign in EN_APROBACION
- **WHEN** `getDocumentPermissions('EN_APROBACION', 'APROBADOR')` is called
- **THEN** `canSign` is `true`, `canReject` is `true`, `canRead` is `true`

#### Scenario: JEFE_CALIDAD cannot edit in EN_APROBACION
- **WHEN** `getDocumentPermissions('EN_APROBACION', 'JEFE_CALIDAD')` is called
- **THEN** `canEdit` is `false`, `canRead` is `true`

### Requirement: PUBLICADO state permissions
The system SHALL implement the PUBLICADO permissions matrix:
- `AUTOR`: all flags = false (sin acceso).
- `REVISOR`: canRead = true; all write flags = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canStartReview = true; canEdit, canDelete, canComment, canApprove, canReject, canSign = false.
- `OPERARIO`: canRead = true; all write flags = false.

#### Scenario: JEFE_CALIDAD can initiate periodic review from PUBLICADO
- **WHEN** `getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD')` is called
- **THEN** `canStartReview` is `true`, `canEdit` is `false`

#### Scenario: OPERARIO can read a PUBLICADO document
- **WHEN** `getDocumentPermissions('PUBLICADO', 'OPERARIO')` is called
- **THEN** `canRead` is `true` and all write flags are `false`

#### Scenario: AUTOR has no access to PUBLICADO documents
- **WHEN** `getDocumentPermissions('PUBLICADO', 'AUTOR')` is called
- **THEN** all eight flags are `false`

### Requirement: OBSOLETO state permissions enforces RN-DOC-003 read-only
The system SHALL implement the OBSOLETO permissions matrix such that no role can perform any write action. Only `REVISOR`, `APROBADOR`, and `JEFE_CALIDAD` can read; `OPERARIO` and `AUTOR` have no access.

#### Scenario: No role can edit or delete an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', rol)` is called for any `rol`
- **THEN** `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview` are all `false`

#### Scenario: REVISOR can read an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', 'REVISOR')` is called
- **THEN** `canRead` is `true`

#### Scenario: OPERARIO cannot read an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', 'OPERARIO')` is called
- **THEN** `canRead` is `false`

### Requirement: EN_REVISION_PERIODICA state permissions
The system SHALL implement the EN_REVISION_PERIODICA permissions matrix with role-specific and context-aware rules:
- `AUTOR` with `isAssignedAuthor: true`: canRead, canEdit, canComment = true; all others = false.
- `AUTOR` with `isAssignedAuthor: false` (default): canRead = true; all write flags = false.
- `REVISOR`: canRead, canComment = true; canEdit, canDelete, canApprove, canReject, canSign, canStartReview, canCancelReview = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canEdit, canComment, canCancelReview = true; canDelete, canApprove, canReject, canSign, canStartReview = false.
- `OPERARIO`: canRead = true; all write flags = false.

#### Scenario: AUTOR who is the assigned author can edit in EN_REVISION_PERIODICA
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: true })` is called
- **THEN** `canEdit` is `true`, `canComment` is `true`, `canRead` is `true`

#### Scenario: AUTOR who is NOT the assigned author cannot edit in EN_REVISION_PERIODICA
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: false })` is called
- **THEN** `canEdit` is `false`, `canRead` is `true`

#### Scenario: JEFE_CALIDAD can cancel review in EN_REVISION_PERIODICA
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD')` is called
- **THEN** `canCancelReview` is `true`, `canEdit` is `true`, `canComment` is `true`

#### Scenario: REVISOR can comment but not approve in EN_REVISION_PERIODICA
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'REVISOR')` is called
- **THEN** `canComment` is `true`, `canApprove` is `false`, `canReject` is `false`

#### Scenario: OPERARIO can read in EN_REVISION_PERIODICA
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', 'OPERARIO')` is called
- **THEN** `canRead` is `true` and all write flags are `false`

#### Scenario: canCancelReview is false for all roles except JEFE_CALIDAD
- **WHEN** `getDocumentPermissions('EN_REVISION_PERIODICA', rol)` is called for `rol` in `AUTOR`, `REVISOR`, `APROBADOR`, `OPERARIO`
- **THEN** `canCancelReview` is `false`
