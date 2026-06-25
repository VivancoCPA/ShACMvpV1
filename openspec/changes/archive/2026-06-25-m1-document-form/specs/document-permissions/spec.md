## ADDED Requirements

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
