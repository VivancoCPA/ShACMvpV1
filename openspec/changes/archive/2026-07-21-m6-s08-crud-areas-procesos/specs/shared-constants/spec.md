## MODIFIED Requirements

### Requirement: TABLE_ROW_CLASS exported from src/constants/ui.constants.ts

The system SHALL export `TABLE_ROW_CLASS` as a `string` constant from `src/constants/ui.constants.ts`. The value SHALL be `'cursor-pointer transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft'` — the standard clickable table row style used in NCList and DocumentList. Modules applying this constant to `<tr>` elements SHALL concatenate additional conditional classes (e.g., `opacity-50` for annulled rows) via template literals or `clsx`.

#### Scenario: TABLE_ROW_CLASS provides the standard table row style string

- **WHEN** a developer imports `TABLE_ROW_CLASS` from `src/constants/ui.constants.ts`
- **THEN** the value equals `'cursor-pointer transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft'`

#### Scenario: TABLE_ROW_CLASS can be extended with conditional classes

- **WHEN** a developer uses `` `${TABLE_ROW_CLASS} opacity-50` `` for an annulled row
- **THEN** the resulting class string contains both the base classes and `opacity-50`

## REMOVED Requirements

### Requirement: AREAS_SHAC exported from src/constants/shared.constants.ts

**Reason**: Área/Proceso afectado is now an administered catalog (M6-S08, capability `area-admin-mocks`), managed via CRUD at `/admin/areas`, backed by `Area` fixtures and a mutable MSW store, instead of a hardcoded static array. `INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS`, and `CONDICION_ENTORNO_LABELS` (previously co-located in the same file as purely additive exports) are unaffected by this removal and remain exported from `src/constants/shared.constants.ts` as before — see `incident-constants` for their own requirement coverage.

**Migration**: Any module that imported `AREAS_SHAC` (directly from `src/constants/shared.constants.ts` or via the re-export at `src/features/documents/constants.ts`) SHALL instead consume the `useAreas()` hook (`area-admin-hooks`) and read `.data` (an `Area[]`, filterable/mappable to the display names or IDs needed). Consumers requiring only active areas for a form combobox SHALL filter client-side on `activo === true`; consumers needing all areas for a read-only filter/badge context (matching prior `AREAS_SHAC` behavior, which included no active/inactive distinction) MAY use the unfiltered result. `src/features/documents/constants.ts`'s re-export of `AREAS_SHAC` SHALL be removed in the same change, not kept as a deprecated alias.
