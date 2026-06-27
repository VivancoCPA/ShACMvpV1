# nonconformity-permissions

Pure permission helper function for the M2 domain. Determines what actions each role can take on a non-conformity based on its current state. No side effects, no hooks, fully testable.

## ADDED Requirements

### Requirement: getNCPermissions is a pure function returning NCPermissions
The system SHALL export a `getNCPermissions` function from `src/features/nonconformities/utils/ncPermissions.ts` with signature `(nc: NoConformidad, userRole: UserRole) => NCPermissions`. The function SHALL be a pure function with no side effects: same inputs always produce the same output, no store access, no API calls.

#### Scenario: getNCPermissions returns NCPermissions with all nine flags
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')`
- **THEN** the returned object satisfies the `NCPermissions` interface with all nine flags as booleans

#### Scenario: getNCPermissions does not mutate its inputs
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` multiple times
- **THEN** the `nc` object is unchanged after each call

### Requirement: OPERARIO permissions follow M2 role matrix
The system SHALL compute `NCPermissions` for role `OPERARIO` according to this matrix:
- `DETECTADA`: `canRead=true, canEdit=false, canDelete=false, canComment=true, canIniciarInvestigacion=false, canRegistrarCorreccion=false, canSolicitarCierre=false, canCerrar=false, canReabrir=false`
- All other states: `canRead=true`, all write flags `false`

OPERARIO can only read NCs after initial reporting. Reporting itself is handled by the create mutation (not a permission flag on existing NCs).

#### Scenario: OPERARIO cannot iniciarInvestigacion on DETECTADA
- **WHEN** a developer calls `getNCPermissions(nc, 'OPERARIO')` with `nc.estado = 'DETECTADA'`
- **THEN** `canIniciarInvestigacion` is `false`

#### Scenario: OPERARIO cannot cerrar any NC
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC state
- **THEN** `canCerrar` is always `false`

### Requirement: SUPERVISOR permissions follow M2 role matrix
The system SHALL compute `NCPermissions` for role `SUPERVISOR` according to this matrix:
- `DETECTADA`: `canIniciarInvestigacion=true, canEdit=true, canComment=true`, others false
- `EN_INVESTIGACION`: `canRegistrarCorreccion=true, canEdit=true, canComment=true`, others false
- `EN_CORRECCION`: `canSolicitarCierre=true, canEdit=true, canComment=true`, others false
- `PENDIENTE_CIERRE`: `canComment=true`, all write flags false (supervisor cannot close)
- `CERRADA`: `canRead=true`, all write flags false
- `REABIERTA`: `canIniciarInvestigacion=true, canEdit=true, canComment=true`

#### Scenario: SUPERVISOR can iniciarInvestigacion on DETECTADA
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.estado = 'DETECTADA'`
- **THEN** `canIniciarInvestigacion` is `true`

#### Scenario: SUPERVISOR cannot cerrar NCs in any state
- **WHEN** a developer calls `getNCPermissions` with role `SUPERVISOR` for any NC state
- **THEN** `canCerrar` is always `false`

### Requirement: JEFE_CALIDAD_SYST permissions follow M2 role matrix
The system SHALL compute `NCPermissions` for role `JEFE_CALIDAD_SYST` according to this matrix:
- All states: `canRead=true, canComment=true`
- `DETECTADA`: `canEdit=true, canIniciarInvestigacion=true`
- `EN_INVESTIGACION`: `canEdit=true`
- `EN_CORRECCION`: `canEdit=true`
- `PENDIENTE_CIERRE`: `canCerrar=true`
- `CERRADA`: `canReabrir=true`
- `REABIERTA`: `canEdit=true, canIniciarInvestigacion=true`

#### Scenario: JEFE_CALIDAD_SYST can cerrar NC in PENDIENTE_CIERRE
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` with `nc.estado = 'PENDIENTE_CIERRE'`
- **THEN** `canCerrar` is `true`

#### Scenario: JEFE_CALIDAD_SYST can reabrir NC in CERRADA
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` with `nc.estado = 'CERRADA'`
- **THEN** `canReabrir` is `true`

#### Scenario: JEFE_CALIDAD_SYST cannot cerrar NC that is not in PENDIENTE_CIERRE
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` with `nc.estado = 'EN_CORRECCION'`
- **THEN** `canCerrar` is `false`

### Requirement: AUDITOR_INTERNO has read-only permissions with comment access
The system SHALL compute `NCPermissions` for role `AUDITOR_INTERNO` as: `canRead=true, canComment=true` for all states, all other flags `false`.

#### Scenario: AUDITOR_INTERNO cannot perform any write action
- **WHEN** a developer calls `getNCPermissions` with role `AUDITOR_INTERNO` for any NC state
- **THEN** `canEdit`, `canDelete`, `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre`, `canCerrar`, `canReabrir` are all `false`

### Requirement: ALTA_DIRECCION has full read access and can reabrir
The system SHALL compute `NCPermissions` for role `ALTA_DIRECCION` as: `canRead=true, canComment=true` for all states, plus `canCerrar=true` when state is `PENDIENTE_CIERRE`, and `canReabrir=true` when state is `CERRADA`.

#### Scenario: ALTA_DIRECCION can cerrar NC in PENDIENTE_CIERRE
- **WHEN** a developer calls `getNCPermissions(nc, 'ALTA_DIRECCION')` with `nc.estado = 'PENDIENTE_CIERRE'`
- **THEN** `canCerrar` is `true`

#### Scenario: ALTA_DIRECCION cannot edit NC fields
- **WHEN** a developer calls `getNCPermissions` with role `ALTA_DIRECCION` for any NC state
- **THEN** `canEdit` is always `false`

### Requirement: JEFE_CONTROL_DOCUMENTARIO has read-only access to NCs
The system SHALL compute `NCPermissions` for role `JEFE_CONTROL_DOCUMENTARIO` as: `canRead=true` for all states, all other flags `false`. This role manages documents, not non-conformities.

#### Scenario: JEFE_CONTROL_DOCUMENTARIO cannot perform any action on NCs
- **WHEN** a developer calls `getNCPermissions` with role `JEFE_CONTROL_DOCUMENTARIO` for any NC state
- **THEN** all flags except `canRead` are `false`
