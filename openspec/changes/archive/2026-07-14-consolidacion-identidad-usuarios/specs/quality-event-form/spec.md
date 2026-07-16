## MODIFIED Requirements

### Requirement: QualityEventForm edit mode locks protected fields as read-only text
In edit mode, `numero`, `origen`, `tipo`, `fechaHoraReporte` (labeled "Fecha de reporte"), and the reporter's display name (`reportadoPorId` resolved to a name) SHALL render as read-only text, never as an editable input, `<select>`, or a `disabled` form control that still appears in the submitted payload's shape. The reporter's display name SHALL be resolved via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`), and SHALL resolve correctly for any real, non-legacy `authFixtures` account, not only ids that happened to also exist in the removed `src/mocks/fixtures/users.fixtures.ts` catalog.

#### Scenario: numero renders as read-only text in edit mode
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `numero: 'QE-2026-010'`
- **THEN** `'QE-2026-010'` is displayed as plain text, with no corresponding input element in the DOM

#### Scenario: origen, tipo, fechaHoraReporte, reportadoPorId are all read-only in edit mode
- **WHEN** `QualityEventForm` renders in edit mode
- **THEN** `origen`, `tipo`, `fechaHoraReporte`, and the reporter's name are all displayed as plain text with no editable controls

#### Scenario: Reportado por resolves for a real, non-legacy account in edit mode
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `reportadoPorId: 'user-supervisor-002'`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the read-only "Reportado por" text shows the resolved display name, not the raw id
