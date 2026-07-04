## ADDED Requirements

### Requirement: canCrearQE permission rule
`canCrearQE` SHALL be `true` for `SUPERVISOR` and `JEFE_CALIDAD_SYST` when the NC's `estado` is NOT `'CERRADA'` or `'ANULADA'` AND `nc.qeGeneradoId` is absent. For all other roles, or when `nc.qeGeneradoId` is populated, or when `estado` is `'CERRADA'`/`'ANULADA'`, `canCrearQE` SHALL be `false`.

#### Scenario: canCrearQE is true for SUPERVISOR on an active NC without a linked QE
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.estado = 'EN_CORRECCION'` and `nc.qeGeneradoId` undefined
- **THEN** `canCrearQE` is `true`

#### Scenario: canCrearQE is true for JEFE_CALIDAD_SYST on an active NC without a linked QE
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` with `nc.estado = 'DETECTADA'` and `nc.qeGeneradoId` undefined
- **THEN** `canCrearQE` is `true`

#### Scenario: canCrearQE is false when the NC already has a linked QE
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.qeGeneradoId = 'qe-2026-005'`
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false for a CERRADA NC
- **WHEN** a developer calls `getNCPermissions(nc, 'JEFE_CALIDAD_SYST')` with `nc.estado = 'CERRADA'` and `nc.qeGeneradoId` undefined
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false for an ANULADA NC
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.estado = 'ANULADA'` and `nc.qeGeneradoId` undefined
- **THEN** `canCrearQE` is `false`

#### Scenario: canCrearQE is false for OPERARIO regardless of state or link
- **WHEN** a developer calls `getNCPermissions(nc, 'OPERARIO')` with `nc.estado = 'DETECTADA'` and `nc.qeGeneradoId` undefined
- **THEN** `canCrearQE` is `false`
