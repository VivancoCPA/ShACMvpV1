## MODIFIED Requirements

### Requirement: Approved causa raíz renders read-only with an approval seal
Once `causaRaizFirmadaEn` is set, the causa raíz block SHALL render read-only with a seal reading "Aprobado por [nombre] el [fecha]", using `causaRaizAprobadaPorId` resolved to a display name via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) and `causaRaizFirmadaEn` formatted via `Intl.DateTimeFormat`. The name SHALL resolve correctly for any real, non-legacy `authFixtures` account, not only ids that happened to also exist in the removed `src/mocks/fixtures/users.fixtures.ts` catalog.

#### Scenario: Approval seal shown after firming
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` resolves to a known user
- **THEN** the causa raíz block is read-only and shows "Aprobado por [nombre] el [fecha]"

#### Scenario: Approval seal resolves for a real, non-legacy account
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId: 'user-jefecalidad-001'`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the seal shows the resolved display name, not a blank value and not the raw id
