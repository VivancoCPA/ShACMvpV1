## MODIFIED Requirements

### Requirement: PUBLICADO and EN_REVISION_PERIODICA state actions
In state `PUBLICADO`, any user whose global role is `JEFE_CALIDAD_SYST` or `JEFE_CONTROL_DOCUMENTARIO` (per `canManagePeriodicReview`) SHALL see:
- "Iniciar revisión periódica" → PATCH `/documents/:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }`.
- "Crear nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

In state `EN_REVISION_PERIODICA`, `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` (and the assigned author) SHALL see:
- "Iniciar nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

"Iniciar revisión periódica" SHALL be authorized by `canManagePeriodicReview(user.rol)`, not by `resolveDocRoleForUser`/`getDocumentPermissions(...).canStartReview` — the button SHALL appear for a `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` even when that user is also the document's `autorId`, `revisorId`, or `aprobadorId`.

#### Scenario: JEFE_CALIDAD_SYST can start periodic review from PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `JEFE_CALIDAD_SYST`
- **THEN** "Iniciar revisión periódica" button is visible

#### Scenario: JEFE_CALIDAD_SYST who is also the aprobador can start periodic review
- **WHEN** `estado === 'PUBLICADO'`, user role is `JEFE_CALIDAD_SYST`, and that user is also the document's `aprobadorId`
- **THEN** "Iniciar revisión periódica" button is visible (same as any other `JEFE_CALIDAD_SYST`)

#### Scenario: JEFE_CONTROL_DOCUMENTARIO who is also the autor can start periodic review
- **WHEN** `estado === 'PUBLICADO'`, user role is `JEFE_CONTROL_DOCUMENTARIO`, and that user is also the document's `autorId`
- **THEN** "Iniciar revisión periódica" button is visible

#### Scenario: Crear nueva versión navigates with baseId param
- **WHEN** the user clicks "Crear nueva versión" from PUBLICADO or "Iniciar nueva versión" from EN_REVISION_PERIODICA
- **THEN** router navigates to `/documentos/nuevo?baseId=<documento.id>`

#### Scenario: OPERARIO sees no actions for PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `OPERARIO`
- **THEN** no action buttons are rendered

#### Scenario: SUPERVISOR sees no "Iniciar revisión periódica" button
- **WHEN** `estado === 'PUBLICADO'` and user role is `SUPERVISOR`
- **THEN** "Iniciar revisión periódica" button is not rendered
