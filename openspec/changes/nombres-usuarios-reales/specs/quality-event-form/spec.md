## MODIFIED Requirements

### Requirement: QualityEventForm edit mode locks protected fields as read-only text
In edit mode, `numero`, `origen`, `tipo`, `fechaHoraReporte` (labeled "Fecha de reporte"), and the reporter's display name (`reportadoPorId` resolved to a name) SHALL render as read-only text, never as an editable input, `<select>`, or a `disabled` form control that still appears in the submitted payload's shape. The reporter's display name SHALL be resolved via the `useUserNames` hook (`user-names-lookup`, calling the real `GET /api/users/nombres` endpoint), not via `resolveUserDisplayName` from `src/mocks/fixtures/userIdentity.fixtures.ts`. It SHALL resolve correctly for any real user known to the backend, including a deactivated one, and SHALL show the generic "Usuario no disponible" text (never the raw id) if the backend does not resolve it.

#### Scenario: numero renders as read-only text in edit mode
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `numero: 'QE-2026-010'`
- **THEN** `'QE-2026-010'` is displayed as plain text, with no corresponding input element in the DOM

#### Scenario: origen, tipo, fechaHoraReporte, reportadoPorId are all read-only in edit mode
- **WHEN** `QualityEventForm` renders in edit mode
- **THEN** `origen`, `tipo`, `fechaHoraReporte`, and the reporter's name are all displayed as plain text with no editable controls

#### Scenario: Reportado por resolves a real user name from the backend in edit mode
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `reportadoPorId` set to a real user id resolved by `GET /api/users/nombres`
- **THEN** the read-only "Reportado por" text shows the resolved display name, not the raw id

#### Scenario: Reportado por shows the generic fallback when unresolved in edit mode
- **WHEN** `reportadoPorId` does not resolve via `GET /api/users/nombres`
- **THEN** the read-only "Reportado por" text shows the generic "Usuario no disponible" string, not the raw id
