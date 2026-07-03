## MODIFIED Requirements

### Requirement: getQualityEventPermissions function
The system SHALL export a pure function `getQualityEventPermissions(estado: QEStatus, rol: UserRole, esResponsable: boolean): QEPermissions` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return a `QEPermissions` object with all flags set according to the RBAC matrix below. The function SHALL NOT throw.

**RBAC matrix:**

| Flag | OPERARIO | SUPERVISOR | JEFE_CALIDAD_SYST | AUDITOR_INTERNO | ALTA_DIRECCION | JEFE_CONTROL_DOCUMENTARIO |
|------|----------|------------|-------------------|-----------------|----------------|---------------------------|
| `puedeEditarCabecera` | false | ABIERTO && esResponsable | ABIERTO | false | false | false |
| `puedeEditarCausaRaiz` | false | false | EN_INVESTIGACION \| ANALISIS_COMPLETADO | false | false | false |
| `puedeAvanzarEstado` | false | ABIERTO→EN_INVESTIGACION only | all except VERIFICADO | false | false | false |
| `puedeCerrar` | false | false | PENDIENTE_CIERRE | false | false | false |
| `puedeFirmarCierre` | false | PENDIENTE_CIERRE | false | false | PENDIENTE_CIERRE && esResponsable | false |
| `puedeVerificar` | false | false | EN_VERIFICACION | EN_VERIFICACION && esResponsable | false | false |
| `puedeReabrir` | false | false | EN_VERIFICACION | false | false | false |
| `soloLectura` | true | false | false | true (unless puedeVerificar) | true (unless puedeFirmarCierre) | true |

For `ALTA_DIRECCION`, `esResponsable` SHALL be interpreted by the caller as "this user is the resolved second-signer role for this QE" (i.e. `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada) === 'ALTA_DIRECCION'`), mirroring how `esResponsable` is already overloaded for `SUPERVISOR`'s `puedeEditarCabecera` and `AUDITOR_INTERNO`'s `puedeVerificar`.

#### Scenario: getQualityEventPermissions returns all false and soloLectura true for JEFE_CONTROL_DOCUMENTARIO
- **WHEN** a developer calls `getQualityEventPermissions('ABIERTO', 'JEFE_CONTROL_DOCUMENTARIO', false)`
- **THEN** all action flags are `false` and `soloLectura` is `true`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to edit causa raiz in EN_INVESTIGACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_INVESTIGACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeEditarCausaRaiz` is `true`

#### Scenario: getQualityEventPermissions allows SUPERVISOR to edit cabecera only in ABIERTO when esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('ABIERTO', 'SUPERVISOR', true)`
- **THEN** `puedeEditarCabecera` is `true`

#### Scenario: getQualityEventPermissions does not allow SUPERVISOR to edit cabecera in EN_INVESTIGACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_INVESTIGACION', 'SUPERVISOR', true)`
- **THEN** `puedeEditarCabecera` is `false`

#### Scenario: getQualityEventPermissions allows SUPERVISOR to firmarCierre in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'SUPERVISOR', false)`
- **THEN** `puedeFirmarCierre` is `true` and `puedeCerrar` is `false`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to cerrar in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeCerrar` is `true` and `puedeFirmarCierre` is `false`

#### Scenario: getQualityEventPermissions allows ALTA_DIRECCION to firmarCierre only when esResponsable in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', true)`
- **THEN** `puedeFirmarCierre` is `true` and `soloLectura` is `false`

#### Scenario: getQualityEventPermissions denies ALTA_DIRECCION firmarCierre when not esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', false)`
- **THEN** `puedeFirmarCierre` is `false` and `soloLectura` is `true`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to verificar in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeVerificar` is `true`

#### Scenario: getQualityEventPermissions allows AUDITOR_INTERNO to verificar only when esResponsable in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'AUDITOR_INTERNO', true)`
- **THEN** `puedeVerificar` is `true` and `soloLectura` is `false`

#### Scenario: getQualityEventPermissions returns soloLectura for AUDITOR_INTERNO when not esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('EN_EJECUCION', 'AUDITOR_INTERNO', false)`
- **THEN** `soloLectura` is `true` and `puedeVerificar` is `false`

#### Scenario: getQualityEventPermissions JEFE_CALIDAD_SYST can reabrir in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeReabrir` is `true`

#### Scenario: getQualityEventPermissions JEFE_CALIDAD_SYST cannot reabrir in VERIFICADO
- **WHEN** a developer calls `getQualityEventPermissions('VERIFICADO', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeReabrir` is `false`

---

## ADDED Requirements

### Requirement: resolveRolSegundaFirma escalation helper
The system SHALL export a pure function `resolveRolSegundaFirma(primerFirmanteId: string, areaAfectada: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` from `src/features/quality-events/utils/qualityEventPermissions.ts`, implementing the RN-QE-004 escalation rule: if the user identified by `primerFirmanteId` has their own `rol === 'SUPERVISOR'` and `area === areaAfectada`, the function SHALL return `'ALTA_DIRECCION'`; otherwise (including when no matching user is found) it SHALL return `'SUPERVISOR'`.

#### Scenario: Escalates when the first signer is also the area's supervisor
- **WHEN** `resolveRolSegundaFirma('user-x', 'Operaciones')` is called and the user `user-x` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'ALTA_DIRECCION'`

#### Scenario: Does not escalate for the normal JEFE_CALIDAD_SYST first signer
- **WHEN** `resolveRolSegundaFirma('user-005', 'Calidad')` is called and `user-005` has `rol: 'JEFE_CALIDAD_SYST'`
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Does not escalate when the SUPERVISOR match is for a different area
- **WHEN** `resolveRolSegundaFirma('user-003', 'Almacén Norte')` is called and `user-003` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Falls back to SUPERVISOR when the user cannot be found
- **WHEN** `resolveRolSegundaFirma('user-desconocido', 'Calidad')` is called
- **THEN** the return value is `'SUPERVISOR'`
