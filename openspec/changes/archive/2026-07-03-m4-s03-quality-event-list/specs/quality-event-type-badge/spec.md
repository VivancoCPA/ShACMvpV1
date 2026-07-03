## ADDED Requirements

### Requirement: QETypeBadge renders the 4 QE types as soft-color chips
The system SHALL export a `QETypeBadge` component from `src/features/quality-events/components/QETypeBadge.tsx` that accepts a `type: QEType` prop and renders a chip `<span>` with the label from `QE_TYPE_LABELS` and a muted background color. The color mapping SHALL be: `CALIDAD` → blue soft (`bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`), `SST` → amber soft (`bg-amber/15 text-amber dark:bg-amber/15 dark:text-amber`), `ADUANERO` → purple soft (`bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300`), `OPERACIONAL` → gray/muted soft (`bg-muted-soft/20 text-muted dark:bg-muted-soft/10 dark:text-on-dark-soft`). The component SHALL accept an optional `className` prop.

#### Scenario: CALIDAD renders blue chip with correct label
- **WHEN** `<QETypeBadge type="CALIDAD" />` is rendered
- **THEN** the output contains `QE_TYPE_LABELS['CALIDAD']` (i.e., `'Calidad'`) and applies a blue background/text color

#### Scenario: SST renders amber chip
- **WHEN** `<QETypeBadge type="SST" />` is rendered
- **THEN** the output contains `QE_TYPE_LABELS['SST']` (i.e., `'SST'`) and applies an amber color class

#### Scenario: ADUANERO renders purple chip
- **WHEN** `<QETypeBadge type="ADUANERO" />` is rendered
- **THEN** the output contains `QE_TYPE_LABELS['ADUANERO']` (i.e., `'Aduanero'`) and applies a purple color class

#### Scenario: OPERACIONAL renders muted gray chip
- **WHEN** `<QETypeBadge type="OPERACIONAL" />` is rendered
- **THEN** the output contains `QE_TYPE_LABELS['OPERACIONAL']` (i.e., `'Operacional'`) and applies a muted/gray color class

#### Scenario: All four type chips maintain readable contrast in dark mode
- **WHEN** `QETypeBadge` renders each of the four types inside a `.dark`-classed container
- **THEN** each chip's text remains readable against its background (each color class has a `dark:` counterpart)
