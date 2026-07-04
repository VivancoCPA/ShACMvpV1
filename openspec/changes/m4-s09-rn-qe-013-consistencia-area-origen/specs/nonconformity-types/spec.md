## MODIFIED Requirements

### Requirement: NCPermissions interface
The system SHALL define an `NCPermissions` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre`, `canCerrar`, `canReabrir`, `canAnular`, `canAsignarAC`, `canCerrarAC`, `canVerAuditTrail`, `canCrearQE`. All flags SHALL be required booleans with no optional members.

#### Scenario: NCPermissions has all fourteen flags as required booleans
- **WHEN** a developer constructs an `NCPermissions` object
- **THEN** TypeScript requires all fourteen flags to be explicitly assigned and rejects any extra properties

#### Scenario: canReabrir is only true for roles authorized to reopen
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` on a `CERRADA` NC
- **THEN** the returned `NCPermissions.canReabrir` is `false`

#### Scenario: canAnular is false for OPERARIO regardless of state
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC state
- **THEN** `canAnular` is always `false`

#### Scenario: canAsignarAC is true for SUPERVISOR on non-terminal NCs
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.estado = 'EN_CORRECCION'`
- **THEN** `canAsignarAC` is `true`

#### Scenario: canCerrarAC is true only for JEFE_CALIDAD_SYST
- **WHEN** a developer calls `getNCPermissions` with role `JEFE_CALIDAD_SYST` for any active NC
- **THEN** `canCerrarAC` is `true`

#### Scenario: canVerAuditTrail is false for OPERARIO
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC
- **THEN** `canVerAuditTrail` is `false`

#### Scenario: canCrearQE is false for OPERARIO regardless of state
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC state
- **THEN** `canCrearQE` is always `false`
