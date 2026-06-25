# document-permissions

Pure permissions helper for M1 Control Documentario. Implements the full RBAC matrix (state × role) and enforces RN-DOC-003 (OBSOLETO read-only). The `context` parameter enables context-aware rules (e.g., `isAssignedAuthor` for `EN_REVISION_PERIODICA`).

## Requirements

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
- `AUTOR`: canRead, canEdit, canDelete = true; canComment = false; canApprove, canReject, canSign, canStartReview, canCancelReview = false.
- `REVISOR`: canRead = true; all write flags = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canEdit, canComment = true; canDelete = false; canApprove, canReject, canSign, canStartReview, canCancelReview = false.
- `OPERARIO`: all flags = false (sin acceso).

#### Scenario: AUTOR can edit and delete in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'AUTOR')` is called
- **THEN** `canEdit` is `true`, `canDelete` is `true`, and `canRead` is `true`

#### Scenario: OPERARIO has no access in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'OPERARIO')` is called
- **THEN** all nine flags are `false`

#### Scenario: JEFE_CALIDAD can edit and comment in BORRADOR
- **WHEN** `getDocumentPermissions('BORRADOR', 'JEFE_CALIDAD')` is called
- **THEN** `canEdit` is `true`, `canComment` is `true`, `canDelete` is `false`

### Requirement: EN_REVISION state permissions
The system SHALL implement the EN_REVISION permissions matrix:
- `AUTOR`: canRead = true; all write flags = false.
- `REVISOR`: canRead, canComment, canApprove, canReject = true; canEdit, canDelete, canSign, canStartReview, canCancelReview = false.
- `APROBADOR`: canRead = true; all write flags = false.
- `JEFE_CALIDAD`: canRead, canEdit, canComment = true; canApprove, canReject, canSign, canStartReview, canCancelReview = false.
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
- `APROBADOR`: canRead, canSign, canReject = true; canEdit, canDelete, canComment, canApprove, canStartReview, canCancelReview = false.
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
- `JEFE_CALIDAD`: canRead, canStartReview = true; canEdit, canDelete, canComment, canApprove, canReject, canSign, canCancelReview = false.
- `OPERARIO`: canRead = true; all write flags = false.

#### Scenario: JEFE_CALIDAD can initiate periodic review from PUBLICADO
- **WHEN** `getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD')` is called
- **THEN** `canStartReview` is `true`, `canEdit` is `false`

#### Scenario: OPERARIO can read a PUBLICADO document
- **WHEN** `getDocumentPermissions('PUBLICADO', 'OPERARIO')` is called
- **THEN** `canRead` is `true` and all write flags are `false`

#### Scenario: AUTOR has no access to PUBLICADO documents
- **WHEN** `getDocumentPermissions('PUBLICADO', 'AUTOR')` is called
- **THEN** all nine flags are `false`

### Requirement: OBSOLETO state permissions enforces RN-DOC-003 read-only
The system SHALL implement the OBSOLETO permissions matrix such that no role can perform any write action. Only `REVISOR`, `APROBADOR`, and `JEFE_CALIDAD` can read; `OPERARIO` and `AUTOR` have no access.

#### Scenario: No role can edit or delete an OBSOLETO document
- **WHEN** `getDocumentPermissions('OBSOLETO', rol)` is called for any `rol`
- **THEN** `canEdit`, `canDelete`, `canComment`, `canApprove`, `canReject`, `canSign`, `canStartReview`, `canCancelReview` are all `false`

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

### Requirement: Route guard for document create route
The route `/documents/new` SHALL be protected by a `RoleGuard` that allows access only to users with roles `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`. Any authenticated user with a different role SHALL be redirected to `/no-autorizado`. Unauthenticated users SHALL be redirected to `/login`.

#### Scenario: JEFE_CONTROL_DOCUMENTARIO can access create route
- **WHEN** a user with role `JEFE_CONTROL_DOCUMENTARIO` navigates to `/documents/new`
- **THEN** `DocumentFormPage` renders in create mode

#### Scenario: JEFE_CALIDAD_SYST can access create route
- **WHEN** a user with role `JEFE_CALIDAD_SYST` navigates to `/documents/new`
- **THEN** `DocumentFormPage` renders in create mode

#### Scenario: SUPERVISOR is redirected from create route
- **WHEN** a user with role `SUPERVISOR` navigates to `/documents/new`
- **THEN** the user is redirected to `/no-autorizado`

#### Scenario: OPERARIO is redirected from create route
- **WHEN** a user with role `OPERARIO` navigates to `/documents/new`
- **THEN** the user is redirected to `/no-autorizado`

### Requirement: Route guard for document edit route
The route `/documents/:id/edit` SHALL be protected by a `RoleGuard` that allows access to users with roles `JEFE_CONTROL_DOCUMENTARIO`, `JEFE_CALIDAD_SYST`, or `SUPERVISOR`. Any authenticated user with a different role SHALL be redirected to `/no-autorizado`. Unauthenticated users SHALL be redirected to `/login`.

#### Scenario: SUPERVISOR can access edit route
- **WHEN** a user with role `SUPERVISOR` navigates to `/documents/:id/edit`
- **THEN** `DocumentFormPage` renders in edit mode (subject to estado check)

#### Scenario: OPERARIO is redirected from edit route
- **WHEN** a user with role `OPERARIO` navigates to `/documents/:id/edit`
- **THEN** the user is redirected to `/no-autorizado`

#### Scenario: AUDITOR_INTERNO is redirected from edit route
- **WHEN** a user with role `AUDITOR_INTERNO` navigates to `/documents/:id/edit`
- **THEN** the user is redirected to `/no-autorizado`

### Requirement: Confidencialidad access control helper
The system SHALL export a `canAccessDocument(confidencialidad: DocConfidencialidad, userRole: string, rolesAutorizados: string[])` function from `src/features/documents/utils/documentPermissions.ts` (or the canonical permissions utility file for M1) that returns a boolean indicating whether the user may view, download, or access the document's content.

Access rules:
- `PUBLICO`: always returns `true` for any authenticated user.
- `INTERNO`: always returns `true` for any authenticated user.
- `CONFIDENCIAL`: returns `true` only if `userRole` is one of `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, or `ALTA_DIRECCION`.
- `RESTRINGIDO`: returns `true` only if `userRole` appears in `rolesAutorizados`.

#### Scenario: PUBLICO is accessible to all roles
- **WHEN** `canAccessDocument('PUBLICO', anyRole, [])` is called
- **THEN** the function returns `true` regardless of `anyRole`

#### Scenario: INTERNO is accessible to all roles
- **WHEN** `canAccessDocument('INTERNO', anyRole, [])` is called
- **THEN** the function returns `true` regardless of `anyRole`

#### Scenario: CONFIDENCIAL is blocked for OPERARIO
- **WHEN** `canAccessDocument('CONFIDENCIAL', 'OPERARIO', [])` is called
- **THEN** the function returns `false`

#### Scenario: CONFIDENCIAL is allowed for AUDITOR_INTERNO
- **WHEN** `canAccessDocument('CONFIDENCIAL', 'AUDITOR_INTERNO', [])` is called
- **THEN** the function returns `true`

#### Scenario: CONFIDENCIAL is blocked for SUPERVISOR
- **WHEN** `canAccessDocument('CONFIDENCIAL', 'SUPERVISOR', [])` is called
- **THEN** the function returns `false`

#### Scenario: RESTRINGIDO allowed when role is in rolesAutorizados
- **WHEN** `canAccessDocument('RESTRINGIDO', 'JEFE_CALIDAD_SYST', ['JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO'])` is called
- **THEN** the function returns `true`

#### Scenario: RESTRINGIDO blocked when role is not in rolesAutorizados
- **WHEN** `canAccessDocument('RESTRINGIDO', 'SUPERVISOR', ['JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO'])` is called
- **THEN** the function returns `false`

#### Scenario: RESTRINGIDO blocked when rolesAutorizados is empty
- **WHEN** `canAccessDocument('RESTRINGIDO', 'JEFE_CALIDAD_SYST', [])` is called
- **THEN** the function returns `false`

### Requirement: Route guard for document detail route
The route `/documentos/:id` SHALL be accessible to all authenticated users. Unauthenticated users SHALL be redirected to `/login`. Confidencialidad-based visibility is enforced by the backend (RN-DOC-012); the frontend route itself does not filter by confidencialidad.

#### Scenario: Authenticated user can navigate to document detail
- **WHEN** an authenticated user navigates to `/documentos/:id`
- **THEN** `DocumentDetailPage` renders (subject to data-level access from the API)

#### Scenario: Unauthenticated user redirected to login
- **WHEN** an unauthenticated user navigates to `/documentos/:id`
- **THEN** the router redirects to `/login`
