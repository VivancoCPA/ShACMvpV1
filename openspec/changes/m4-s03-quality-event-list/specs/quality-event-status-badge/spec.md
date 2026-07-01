## ADDED Requirements

### Requirement: QEStatusBadge renders the 9 QE lifecycle states with semantic colors
The system SHALL export a `QEStatusBadge` component from `src/features/quality-events/components/QEStatusBadge.tsx` that accepts a `status: QEStatus` prop and renders a pill `<span>` with the label from `QE_STATUS_LABELS` and a semantic color class. The color mapping SHALL be: `ABIERTO` → amber, `EN_INVESTIGACION` → blue, `ANALISIS_COMPLETADO` → indigo, `EN_EJECUCION` → teal, `PENDIENTE_CIERRE` → orange (amber-700 equivalent), `CERRADO` → gray (muted), `EN_VERIFICACION` → yellow, `VERIFICADO` → success (green), `REABIERTO` → error (red). The component SHALL support an optional `className` prop for layout overrides.

#### Scenario: ABIERTO renders amber pill with correct label
- **WHEN** `<QEStatusBadge status="ABIERTO" />` is rendered
- **THEN** the output contains `QE_STATUS_LABELS['ABIERTO']` (i.e., `'Abierto'`) and applies an amber color class

#### Scenario: VERIFICADO renders success green pill
- **WHEN** `<QEStatusBadge status="VERIFICADO" />` is rendered
- **THEN** the output contains `QE_STATUS_LABELS['VERIFICADO']` (i.e., `'Verificado'`) and applies a success/green color class

#### Scenario: REABIERTO renders error red pill
- **WHEN** `<QEStatusBadge status="REABIERTO" />` is rendered
- **THEN** the output contains `QE_STATUS_LABELS['REABIERTO']` (i.e., `'Reabierto'`) and applies an error/red color class

#### Scenario: EN_VERIFICACION renders yellow pill
- **WHEN** `<QEStatusBadge status="EN_VERIFICACION" />` is rendered
- **THEN** the output applies a yellow/warning color class distinct from the teal used for EN_EJECUCION

#### Scenario: Badge is visually correct in dark mode
- **WHEN** `QEStatusBadge` renders inside a `.dark`-classed container
- **THEN** each state's color class includes a `dark:` variant that maintains readable contrast on dark surfaces
