## ADDED Requirements

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
