# Spec: incident-permissions

## Purpose

RBAC permission derivation for the incident domain. Defines the `IncidentPermissions` interface and the pure `getIncidentPermissions` function that maps a user role and incident state to a set of boolean capability flags consumed by UI components.

---

## Requirements

### Requirement: IncidentPermissions interface
The system SHALL define an `IncidentPermissions` interface in `src/features/incidents/types/incidentPermissions.types.ts` with the following required boolean flags: `canView`, `canCreate`, `canEdit`, `canChangeStatus`, `canAddAC`, `canDelete`, `canRestore`, `canAnular`, `canCrearQE`. All flags SHALL be required booleans with no optional members.

#### Scenario: IncidentPermissions has all nine flags as required booleans
- **WHEN** a developer constructs an `IncidentPermissions` object
- **THEN** TypeScript requires all nine flags to be explicitly assigned and rejects any extra properties

---

### Requirement: getIncidentPermissions function
The system SHALL export a pure function `getIncidentPermissions(incidente: Incidente | null, userRole: UserRole): IncidentPermissions` from `src/features/incidents/utils/incidentPermissions.ts`. The function SHALL return an `IncidentPermissions` object with all flags set according to the RBAC matrix defined below. The function SHALL NOT throw; it SHALL handle `null` incidente by treating it as a context where state-dependent permissions are false.

#### Scenario: getIncidentPermissions returns all false for JEFE_CONTROL_DOCUMENTARIO
- **WHEN** a developer calls `getIncidentPermissions(null, 'JEFE_CONTROL_DOCUMENTARIO')`
- **THEN** all eight flags in the returned object are `false`

#### Scenario: getIncidentPermissions with null incidente returns canCreate true for OPERARIO
- **WHEN** a developer calls `getIncidentPermissions(null, 'OPERARIO')`
- **THEN** `canCreate` is `true` and all state-dependent flags (`canEdit`, `canDelete`, `canRestore`, `canAnular`, `canAddAC`, `canChangeStatus`) are `false`

#### Scenario: getIncidentPermissions with null incidente returns canCreate true for SUPERVISOR
- **WHEN** a developer calls `getIncidentPermissions(null, 'SUPERVISOR')`
- **THEN** `canCreate` is `true` and all state-dependent flags are `false`

#### Scenario: getIncidentPermissions with null incidente returns canCreate true for JEFE_CALIDAD_SYST
- **WHEN** a developer calls `getIncidentPermissions(null, 'JEFE_CALIDAD_SYST')`
- **THEN** `canCreate` is `true` and all state-dependent flags are `false`

---

### Requirement: canView permission rule
`canView` SHALL be `true` for: `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`. For `OPERARIO`, `canView` is also `true` (note: the component layer is responsible for filtering the list to own incidents only; the permission flag itself is `true`). For `JEFE_CONTROL_DOCUMENTARIO`, `canView` is `false`.

#### Scenario: canView is true for AUDITOR_INTERNO
- **WHEN** a developer calls `getIncidentPermissions(incidente, 'AUDITOR_INTERNO')`
- **THEN** `canView` is `true`

#### Scenario: canView is false for JEFE_CONTROL_DOCUMENTARIO
- **WHEN** a developer calls `getIncidentPermissions(incidente, 'JEFE_CONTROL_DOCUMENTARIO')`
- **THEN** `canView` is `false`

#### Scenario: canView is true for OPERARIO
- **WHEN** a developer calls `getIncidentPermissions(incidente, 'OPERARIO')`
- **THEN** `canView` is `true`

---

### Requirement: canEdit permission rule
`canEdit` SHALL be `true` only for `SUPERVISOR` when the incident's `estado` is `'ABIERTO'` or `'EN_INVESTIGACION'`, and always `true` for `JEFE_CALIDAD_SYST` regardless of state (as long as the incident is not soft-deleted). For all other roles, `canEdit` is `false`.

#### Scenario: canEdit is true for SUPERVISOR when estado is EN_INVESTIGACION
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'EN_INVESTIGACION', deletedAt: undefined }, 'SUPERVISOR')`
- **THEN** `canEdit` is `true`

#### Scenario: canEdit is false for SUPERVISOR when estado is CERRADO
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'CERRADO' }, 'SUPERVISOR')`
- **THEN** `canEdit` is `false`

#### Scenario: canEdit is true for JEFE_CALIDAD_SYST regardless of estado
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'PENDIENTE_CIERRE', deletedAt: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canEdit` is `true`

#### Scenario: canEdit is false for OPERARIO
- **WHEN** a developer calls `getIncidentPermissions(incidente, 'OPERARIO')`
- **THEN** `canEdit` is `false`

---

### Requirement: canAddAC permission rule
`canAddAC` SHALL be `true` for `SUPERVISOR` when the incident's `estado` is NOT `'CERRADO'` or `'ANULADO'` and `deletedAt` is absent. It SHALL always be `true` for `JEFE_CALIDAD_SYST` under the same conditions. For all other roles, `canAddAC` is `false`.

#### Scenario: canAddAC is false for SUPERVISOR when estado is CERRADO
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'CERRADO' }, 'SUPERVISOR')`
- **THEN** `canAddAC` is `false`

#### Scenario: canAddAC is false when incidente has deletedAt set
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO', deletedAt: '2025-01-01T00:00:00Z' }, 'SUPERVISOR')`
- **THEN** `canAddAC` is `false`

#### Scenario: canAddAC is true for JEFE_CALIDAD_SYST on active incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'EN_EJECUCION', deletedAt: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canAddAC` is `true`

---

### Requirement: canDelete permission rule
`canDelete` SHALL be `true` only for `JEFE_CALIDAD_SYST` when the incident's `estado` is `'ABIERTO'` AND `deletedAt` is absent (not already soft-deleted). For all other roles or states, `canDelete` is `false`.

#### Scenario: canDelete is true for JEFE_CALIDAD_SYST on ABIERTO incident without deletedAt
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO', deletedAt: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canDelete` is `true`

#### Scenario: canDelete is false for JEFE_CALIDAD_SYST when estado is EN_INVESTIGACION
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'EN_INVESTIGACION' }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canDelete` is `false`

#### Scenario: canDelete is false for SUPERVISOR regardless of estado
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO' }, 'SUPERVISOR')`
- **THEN** `canDelete` is `false`

---

### Requirement: canRestore permission rule
`canRestore` SHALL be `true` only for `JEFE_CALIDAD_SYST` when the incident's `deletedAt` field is defined (soft-deleted). For all other roles or when `deletedAt` is absent, `canRestore` is `false`.

#### Scenario: canRestore is true for JEFE_CALIDAD_SYST on soft-deleted incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, deletedAt: '2025-06-01T00:00:00Z' }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canRestore` is `true`

#### Scenario: canRestore is false when deletedAt is absent
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, deletedAt: undefined }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canRestore` is `false`

---

### Requirement: canAnular permission rule
`canAnular` SHALL be `true` only for `JEFE_CALIDAD_SYST` when the incident's `estado` is `'ABIERTO'` or `'EN_INVESTIGACION'`. For all other roles or states, `canAnular` is `false`.

#### Scenario: canAnular is true for JEFE_CALIDAD_SYST on ABIERTO incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO' }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canAnular` is `true`

#### Scenario: canAnular is true for JEFE_CALIDAD_SYST on EN_INVESTIGACION incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'EN_INVESTIGACION' }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canAnular` is `true`

#### Scenario: canAnular is false for JEFE_CALIDAD_SYST on PENDIENTE_CIERRE incident
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'PENDIENTE_CIERRE' }, 'JEFE_CALIDAD_SYST')`
- **THEN** `canAnular` is `false`

#### Scenario: canAnular is false for SUPERVISOR regardless of estado
- **WHEN** a developer calls `getIncidentPermissions({ ...incidente, estado: 'ABIERTO' }, 'SUPERVISOR')`
- **THEN** `canAnular` is `false`

---

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
