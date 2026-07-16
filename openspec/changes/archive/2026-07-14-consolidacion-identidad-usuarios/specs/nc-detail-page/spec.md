## MODIFIED Requirements

### Requirement: NonconformityDetailPage renders NC header in readonly mode
The system SHALL render a `NonconformityDetailPage` component at `/nonconformities/:id` that displays a readonly header with: `numero`, `dominio` (human-readable label), `severidad` badge via `SeverityBadge`, `estado` badge via `NCStatusBadge`, `titulo`, `descripcion`, `areaAfectada`, `procesoInvolucrado`, `fechaDeteccion` (formatted dd/mm/yyyy), `detectadoPor`, and — when `estado === 'ANULADA'` — the `justificacionAnulacion` in a visually distinct alert block. The header SHALL be wrapped in a `PageWrapper` with breadcrumb `"No Conformidades > <numero>"`. The `detectadoPor` row SHALL resolve `nc.detectadoPorId` to a display name via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) and SHALL always render — never be omitted from the DOM — for any `detectadoPorId`, including real, non-legacy `authFixtures` accounts that have no corresponding entry in the removed `src/mocks/fixtures/users.fixtures.ts` catalog.

#### Scenario: Detail page renders NC header with numero and estado badge
- **WHEN** a user navigates to `/nonconformities/nc-001` and the hook resolves successfully
- **THEN** the page shows the NC `numero`, a `NCStatusBadge` for `estado`, and a `SeverityBadge` for `severidad`

#### Scenario: Detail page shows justificacion when NC is ANULADA
- **WHEN** the fetched NC has `estado === 'ANULADA'` and a non-empty `justificacionAnulacion`
- **THEN** an alert block with `justificacionAnulacion` text is visible below the estado badge

#### Scenario: Breadcrumb shows NC numero
- **WHEN** `NonconformityDetailPage` renders with a resolved NC
- **THEN** the breadcrumb displays `"No Conformidades > NC-2025-001"` (using the actual numero)

#### Scenario: Detectado por row renders for a real, non-legacy account
- **WHEN** `NonconformityDetailPage` renders an NC with `detectadoPorId: 'user-supervisor-002'`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the "Detectado por" row is present in the DOM and shows the resolved name, not blank and not omitted
