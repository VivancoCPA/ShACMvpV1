## MODIFIED Requirements

### Requirement: QEList Acciones column shows Ver for all roles and Editar only with permissions
The system SHALL render a `Ver` icon button (Eye icon) in the Acciones column for every row regardless of role. An `Editar` icon button SHALL appear only when `puedeEditarQE(qe, usuario)` returns `true` (RN-QE-010/RN-QE-011/RN-QE-012, `quality-event-permissions`) — replacing the previous `puedeEditarCabecera`-based gate. When `puedeEditarQE` returns `false`, the `Editar` icon SHALL be omitted entirely from the row — it SHALL NOT render in a disabled state and SHALL NOT carry an explanatory tooltip. Exactly one `Editar` icon SHALL ever render per row, even when the current user simultaneously satisfies more than one of RN-QE-010/011/012 for that QE. Both buttons SHALL have `aria-label` and `title` attributes from i18n keys.

Clicking `Editar` SHALL route based on `resolveQEEditAccess(qe, usuario)`:
- `reporteInicial: true` (regardless of `severidad`/`mineral`): navigate to `/quality-events/:id/editar` (full `QualityEventForm` edit mode).
- `reporteInicial: false` and (`severidad` or `mineral`) `true`: open `QEEditSeveridadMineralModal` inline, without navigation.

#### Scenario: All roles see Ver button
- **WHEN** any authenticated user renders `QEList` with results
- **THEN** each row contains an Eye icon button with `aria-label` from `t('qualityEvents:list.actions.ver')`

#### Scenario: OPERARIO never sees the Editar icon
- **WHEN** a user with role `OPERARIO` who is not the QE's creator renders `QEList`
- **THEN** no edit button appears in any row's Acciones column, consistent with OPERARIO having no RBAC path to any of RN-QE-010/011/012

#### Scenario: User with no matching edit rule does not see Editar button
- **WHEN** `puedeEditarQE(qe, usuario)` returns `false` for the current user and a given row
- **THEN** no edit button appears in that row's Acciones column, and no disabled placeholder or tooltip is rendered in its place

#### Scenario: Creator within RN-QE-010 window sees Editar and it navigates to the full form
- **WHEN** `puedeEditarQE` returns `true` because `resolveQEEditAccess` yields `{ reporteInicial: true, severidad: false, mineral: false }`
- **THEN** an `Editar` icon appears in that row, and clicking it navigates to `/quality-events/:id/editar`

#### Scenario: JEFE_CALIDAD_SYST outside the RN-QE-010 window sees Editar and it opens the reduced modal
- **WHEN** `puedeEditarQE` returns `true` because `resolveQEEditAccess` yields `{ reporteInicial: false, severidad: true, mineral: true }`
- **THEN** an `Editar` icon appears in that row, and clicking it opens `QEEditSeveridadMineralModal` without navigating away from the list

#### Scenario: Double-role user sees a single Editar icon routing to the full form
- **WHEN** `resolveQEEditAccess` yields `{ reporteInicial: true, severidad: true, mineral: true }` for the current user and row
- **THEN** exactly one `Editar` icon renders in that row, and clicking it navigates to `/quality-events/:id/editar` (not to the reduced modal, and not rendering two icons)
