## ADDED Requirements

### Requirement: QUERY_KEYS.documents factory
The system SHALL export a `QUERY_KEYS` object from `src/features/documents/constants.ts` with a `documents` sub-object providing: `all` (static tuple `['documents']`), `list(filters: DocFilters)` (returns `['documents', 'list', filters]`), `detail(id: string)` (returns `['documents', 'detail', id]`). All values SHALL be typed `as const`.

#### Scenario: QUERY_KEYS.documents.all returns the base tuple
- **WHEN** a developer reads `QUERY_KEYS.documents.all`
- **THEN** the value equals `['documents']` and TypeScript infers the readonly tuple type

#### Scenario: QUERY_KEYS.documents.list produces a scoped key
- **WHEN** `QUERY_KEYS.documents.list({ estado: 'PUBLICADO' })` is called
- **THEN** the result equals `['documents', 'list', { estado: 'PUBLICADO' }]`

#### Scenario: QUERY_KEYS.documents.detail produces an id-scoped key
- **WHEN** `QUERY_KEYS.documents.detail('abc-123')` is called
- **THEN** the result equals `['documents', 'detail', 'abc-123']`

### Requirement: DOC_STATUS_COLORS map
The system SHALL export a `DOC_STATUS_COLORS` constant from `constants.ts` mapping each `DocStatus` value to a color token string suitable for use in `StatusBadge`. Every `DocStatus` key SHALL be present (no implicit `undefined` lookup). `EN_REVISION_PERIODICA` SHALL use the amber token.

#### Scenario: All DocStatus values have a color mapping
- **WHEN** a developer iterates over all `DocStatus` values
- **THEN** each value has a defined, non-empty entry in `DOC_STATUS_COLORS`

#### Scenario: PUBLICADO maps to the success semantic color
- **WHEN** `DOC_STATUS_COLORS['PUBLICADO']` is read
- **THEN** the value references the success color token (e.g., `'success'` or `'#5db872'`)

#### Scenario: OBSOLETO maps to a muted/neutral color
- **WHEN** `DOC_STATUS_COLORS['OBSOLETO']` is read
- **THEN** the value references a muted or gray token, not a primary action color

#### Scenario: EN_REVISION_PERIODICA maps to the amber token
- **WHEN** `DOC_STATUS_COLORS['EN_REVISION_PERIODICA']` is read
- **THEN** the value references the amber design-system token (e.g., `'amber'` or `'#e8a55a'`)

### Requirement: DOC_STATUS_TRANSITIONS adjacency map
The system SHALL export a `DOC_STATUS_TRANSITIONS` constant typed as `Record<DocStatus, DocStatus[]>` mapping each state to its valid next states, reflecting the M1 lifecycle exactly:
- `BORRADOR` → `['EN_REVISION']`
- `EN_REVISION` → `['EN_APROBACION', 'BORRADOR']` (approve or reject back)
- `EN_APROBACION` → `['PUBLICADO', 'BORRADOR']` (sign or reject back)
- `PUBLICADO` → `['OBSOLETO', 'EN_REVISION_PERIODICA']`
- `OBSOLETO` → `[]` (terminal)
- `EN_REVISION_PERIODICA` → `['BORRADOR', 'PUBLICADO']` (cancel review back to published, or finalize new draft)

#### Scenario: BORRADOR can only transition to EN_REVISION
- **WHEN** `DOC_STATUS_TRANSITIONS['BORRADOR']` is read
- **THEN** the array contains exactly `['EN_REVISION']`

#### Scenario: OBSOLETO has no valid next states
- **WHEN** `DOC_STATUS_TRANSITIONS['OBSOLETO']` is read
- **THEN** the array is empty, confirming RN-DOC-003 (terminal state)

#### Scenario: EN_REVISION_PERIODICA can transition to BORRADOR or PUBLICADO
- **WHEN** `DOC_STATUS_TRANSITIONS['EN_REVISION_PERIODICA']` is read
- **THEN** the array contains `'BORRADOR'` and `'PUBLICADO'`

#### Scenario: Transition map covers all DocStatus keys
- **WHEN** all `DocStatus` values are used as keys into `DOC_STATUS_TRANSITIONS`
- **THEN** no key returns `undefined`
