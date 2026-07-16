## MODIFIED Requirements

### Requirement: resolveRolSegundaFirma escalation helper
The system SHALL export a pure function `resolveRolSegundaFirma(primerFirmanteId: string, areaAfectada: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` from `src/features/quality-events/utils/qualityEventPermissions.ts`, implementing the RN-QE-004 escalation rule: if the user identified by `primerFirmanteId` has their own `rol === 'SUPERVISOR'` and `area === areaAfectada`, the function SHALL return `'ALTA_DIRECCION'`; otherwise (including when no matching user is found) it SHALL return `'SUPERVISOR'`. The lookup of `primerFirmanteId` SHALL be performed against the live `authFixtures` user store (`getUsersStore()` from `src/mocks/fixtures/auth.fixtures.ts`) — never against `src/mocks/fixtures/users.fixtures.ts`, which does not exist as of this capability. This SHALL hold for any real, non-legacy `authFixtures` account, not only the ids that happened to also exist in the removed `userFixtures` catalog.

#### Scenario: Escalates when the first signer is also the area's supervisor
- **WHEN** `resolveRolSegundaFirma('user-x', 'Operaciones')` is called and the user `user-x` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'ALTA_DIRECCION'`

#### Scenario: Escalates for a real, non-legacy SUPERVISOR account not present in the old userFixtures catalog
- **WHEN** `resolveRolSegundaFirma('user-supervisor-002', 'Almacén Norte')` is called and `authFixtures` has `{ id: 'user-supervisor-002', rol: 'SUPERVISOR', area: 'Almacén Norte' }`
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
