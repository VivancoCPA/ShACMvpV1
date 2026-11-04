## ADDED Requirements

### Requirement: Sidebar documentos pendientes badge is not role-restricted
The `Sidebar`'s pendientes badge on the "Documentos" navigation item SHALL be shown to every role with access to the Documents module (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`), consistent with the fact that any of them can have an assigned pendiente under the current rule. The component SHALL NOT hardcode a smaller role subset for visibility; a `0` count SHALL simply render no badge, same as today.

#### Scenario: AUDITOR_INTERNO sees their pendientes badge
- **WHEN** an `AUDITOR_INTERNO` assigned as `RevisorId` of an `EN_REVISION` document views the Sidebar
- **THEN** the Documentos nav item shows a pendientes badge with a count of at least 1

#### Scenario: ALTA_DIRECCION sees their pendientes badge
- **WHEN** an `ALTA_DIRECCION` assigned as `AprobadorId` of an `EN_APROBACION` document views the Sidebar
- **THEN** the Documentos nav item shows a pendientes badge with a count of at least 1

#### Scenario: Role with zero pendientes shows no badge
- **WHEN** any role with access to the Documents module has zero pendientes
- **THEN** no badge is rendered next to the Documentos nav item
