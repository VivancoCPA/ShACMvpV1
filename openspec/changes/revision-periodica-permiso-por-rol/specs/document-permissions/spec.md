## ADDED Requirements

### Requirement: Periodic review authorization is role-based, not docRole-based
The system SHALL export a `canManagePeriodicReview(userRol: UserRole): boolean` function from `src/features/documents/permissions.ts` that returns `true` only when `userRol` is `JEFE_CALIDAD_SYST` or `JEFE_CONTROL_DOCUMENTARIO`, and `false` for every other role. This function SHALL be the sole authorization gate for the three periodic-review actions (iniciar revisión periódica, confirmar vigencia, cancelar revisión periódica) across the UI — it SHALL NOT depend on `resolveDocRoleForUser`/`docRole`, and in particular SHALL return `true` for a `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` even when that user is also the document's `autorId`, `revisorId`, or `aprobadorId`. The existing `canStartReview`/`canCancelReview` flags returned by `getDocumentPermissions` (the `(estado, docRole)` matrix) SHALL remain unchanged and SHALL NOT be used as the gate for these three actions.

#### Scenario: JEFE_CALIDAD_SYST who is also the document's autor can manage periodic review
- **WHEN** `canManagePeriodicReview('JEFE_CALIDAD_SYST')` is called
- **THEN** it returns `true`, regardless of whether that user is the document's `autorId`, `revisorId`, or `aprobadorId`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO can manage periodic review
- **WHEN** `canManagePeriodicReview('JEFE_CONTROL_DOCUMENTARIO')` is called
- **THEN** it returns `true`

#### Scenario: SUPERVISOR cannot manage periodic review
- **WHEN** `canManagePeriodicReview('SUPERVISOR')` is called
- **THEN** it returns `false`

#### Scenario: OPERARIO cannot manage periodic review
- **WHEN** `canManagePeriodicReview('OPERARIO')` is called
- **THEN** it returns `false`
