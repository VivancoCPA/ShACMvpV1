## MODIFIED Requirements

### Requirement: IncidentPermissions interface
The system SHALL define an `IncidentPermissions` interface in `src/features/incidents/types/incidentPermissions.types.ts` with the following required boolean flags: `canView`, `canCreate`, `canEdit`, `canChangeStatus`, `canAddAC`, `canDelete`, `canRestore`, `canAnular`, `canCrearQE`. All flags SHALL be required booleans with no optional members.

#### Scenario: IncidentPermissions has all nine flags as required booleans
- **WHEN** a developer constructs an `IncidentPermissions` object
- **THEN** TypeScript requires all nine flags to be explicitly assigned and rejects any extra properties

---

## ADDED Requirements

### Requirement: canCrearQE permission rule
`canCrearQE` SHALL be `true` for `SUPERVISOR` and `JEFE_CALIDAD_SYST` when the incident's `estado` is NOT `'CERRADO'` or `'ANULADO'`, `deletedAt` is absent, AND `incidente.qeId` is absent. For all other roles, or when `incidente.qeId` is populated, or when `estado` is `'CERRADO'`/`'ANULADO'`, or when `deletedAt` is set, `canCrearQE` SHALL be `false`.

#### Scenario: canCrearQE is true for SUPERVISOR on an active incident without a linked QE
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'EN_INVESTIGACION', deletedAt: undefined, qeId: undefined }, 'SUPERVISOR')`
- **THEN** `canCrearQE` is `true`

#### Scenario: canCrearQE is true for JEFE_CALIDAD_SYST on an active incident without a linked QE
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO', deletedAt: undefined, qeId: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canCrearQE` is `true`

#### Scenario: canCrearQE is false when the incident already has a linked QE
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, qeId: 'qe-2026-005' }, 'SUPERVISOR')`
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false for a CERRADO incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'CERRADO', qeId: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false when the incident is soft-deleted
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO', deletedAt: '2025-01-01T00:00:00Z', qeId: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false for OPERARIO regardless of state or link
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO', qeId: undefined }, 'OPERARIO')`
- **THEN** `canCrearQE` is `false`
