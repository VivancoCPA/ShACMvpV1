## MODIFIED Requirements

### Requirement: Approved causa raíz renders read-only with an approval seal
Once `causaRaizFirmadaEn` is set, the causa raíz block SHALL render read-only with a seal reading "Aprobado por [nombre] el [fecha]", using `causaRaizAprobadaPorId` resolved to a display name via the `useUserNames` hook (`user-names-lookup`, calling the real `GET /api/users/nombres` endpoint) and `causaRaizFirmadaEn` formatted via `Intl.DateTimeFormat`. The name SHALL resolve correctly for any real user known to the backend, including a deactivated one, and SHALL show the generic "Usuario no disponible" text (never the raw id) if the backend does not resolve it.

#### Scenario: Approval seal shown after firming
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` resolves to a known user
- **THEN** the causa raíz block is read-only and shows "Aprobado por [nombre] el [fecha]"

#### Scenario: Approval seal resolves a real user name from the backend
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` is a real user id resolved by `GET /api/users/nombres`
- **THEN** the seal shows the resolved display name, not a blank value and not the raw id

#### Scenario: Approval seal shows the generic fallback when unresolved
- **WHEN** `causaRaizAprobadaPorId` does not resolve via `GET /api/users/nombres`
- **THEN** the seal shows the generic "Usuario no disponible" text, not the raw id
