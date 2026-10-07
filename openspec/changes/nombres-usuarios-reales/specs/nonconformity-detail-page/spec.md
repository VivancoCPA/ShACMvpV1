## ADDED Requirements

### Requirement: NonconformityDetailPage resolves detectadoPor's real name
When `nc.detectadoPorId` is present, `NonconformityDetailPage`'s info card SHALL render a "Detectado por" field showing that user's resolved display name, obtained via the `useUserNames` hook (`user-names-lookup`, calling the real `GET /api/users/nombres` endpoint). The page SHALL NOT read `getUsersStore()` (a mock-only store) directly, and SHALL NOT import `resolveUserDisplayName` from `src/mocks/`. The field SHALL show only the resolved name — no role suffix — since the shared names endpoint intentionally does not expose `rol`. When the id does not resolve, the field SHALL show the generic "Usuario no disponible" text, never the raw id.

#### Scenario: Detectado por field is absent when detectadoPorId is not set
- **WHEN** `nc.detectadoPorId` is `undefined`
- **THEN** no "Detectado por" field is rendered in the info card

#### Scenario: Detectado por shows the resolved real name
- **WHEN** `nc.detectadoPorId` is a real user id resolved by `GET /api/users/nombres` to `nombreCompleto: 'María Castro'`
- **THEN** the "Detectado por" field shows `'María Castro'`, with no role suffix

#### Scenario: Detectado por shows the generic fallback when unresolved
- **WHEN** `nc.detectadoPorId` does not resolve via `GET /api/users/nombres`
- **THEN** the "Detectado por" field shows the generic "Usuario no disponible" text, not the raw id

#### Scenario: No direct read of the mock user store
- **WHEN** `src/features/nonconformities/pages/NonconformityDetailPage.tsx` is inspected for imports
- **THEN** it has no import of `getUsersStore` or `resolveUserDisplayName` from `src/mocks/`
