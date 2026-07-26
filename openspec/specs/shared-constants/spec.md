# Spec: shared-constants

## Purpose

TBD — Project-wide shared constants that are not tied to a single feature module. Prevents cross-feature dependencies by placing reusable data (e.g., organizational area lists, UI class strings) in a neutral location under `src/constants/`.

---

## Requirements

### Requirement: TABLE_ROW_CLASS exported from src/constants/ui.constants.ts
The system SHALL export `TABLE_ROW_CLASS` as a `string` constant from `src/constants/ui.constants.ts`. The value SHALL be `'cursor-pointer transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft'` — the standard clickable table row style used in NCList and DocumentList. Modules applying this constant to `<tr>` elements SHALL concatenate additional conditional classes (e.g., `opacity-50` for annulled rows) via template literals or `clsx`.

#### Scenario: TABLE_ROW_CLASS provides the standard table row style string
- **WHEN** a developer imports `TABLE_ROW_CLASS` from `src/constants/ui.constants.ts`
- **THEN** the value equals `'cursor-pointer transition-colors hover:bg-surface-soft dark:hover:bg-surface-dark-soft'`

#### Scenario: TABLE_ROW_CLASS can be extended with conditional classes
- **WHEN** a developer uses `` `${TABLE_ROW_CLASS} opacity-50` `` for an annulled row
- **THEN** the resulting class string contains both the base classes and `opacity-50`
