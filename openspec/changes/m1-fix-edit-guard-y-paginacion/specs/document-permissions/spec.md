## MODIFIED Requirements

### Requirement: Route guard for document edit route
The route `/documents/:id/edit` SHALL be protected by a guard that fetches the target document (via `useDocument(id)`) and allows access if EITHER: (a) the authenticated user's global role is `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`, OR (b) the authenticated user's id equals the fetched document's `autorId`, regardless of global role. `SUPERVISOR` SHALL NOT have edit access via global role alone. Any authenticated user who is neither a matching global role nor the document's author SHALL be redirected to `/no-autorizado`. Unauthenticated users SHALL be redirected to `/login`. While the document fetch is loading, the guard SHALL NOT render the form nor redirect.

#### Scenario: OPERARIO who is the document author can access edit route
- **WHEN** a user with role `OPERARIO` whose id matches the document's `autorId` navigates to `/documents/:id/edit` for that document
- **THEN** `DocumentFormPage` renders in edit mode (subject to estado check)

#### Scenario: OPERARIO who is not the author is redirected from edit route
- **WHEN** a user with role `OPERARIO` who is NOT the document's `autorId` navigates to `/documents/:otroId/edit`
- **THEN** the user is redirected to `/no-autorizado`

#### Scenario: SUPERVISOR without authorship is redirected from edit route
- **WHEN** a user with role `SUPERVISOR` who is not the document's `autorId` navigates to `/documents/:id/edit`
- **THEN** the user is redirected to `/no-autorizado`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO can access edit route for any document
- **WHEN** a user with role `JEFE_CONTROL_DOCUMENTARIO` navigates to `/documents/:id/edit` for any document, authored by them or not
- **THEN** `DocumentFormPage` renders in edit mode (subject to estado check)

#### Scenario: JEFE_CALIDAD_SYST can access edit route for any document
- **WHEN** a user with role `JEFE_CALIDAD_SYST` navigates to `/documents/:id/edit` for any document, authored by them or not
- **THEN** `DocumentFormPage` renders in edit mode (subject to estado check)

#### Scenario: AUDITOR_INTERNO is redirected from edit route
- **WHEN** a user with role `AUDITOR_INTERNO` navigates to `/documents/:id/edit`
- **THEN** the user is redirected to `/no-autorizado`
