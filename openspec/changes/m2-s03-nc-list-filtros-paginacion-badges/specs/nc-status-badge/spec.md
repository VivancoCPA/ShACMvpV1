# nc-status-badge

Componente pill para los estados del ciclo de vida de No Conformidades. Cubre los 7 estados del nuevo NCStatus con colores semánticos diferenciados y variantes dark mode.

## ADDED Requirements

### Requirement: NCStatusBadge renders NC lifecycle states as styled pills
The system SHALL export a `NCStatusBadge` component from `src/components/shared/NCStatusBadge.tsx` that accepts a `status: NCStatus` prop and renders a pill (`rounded-[9999px]`) with semantic background and text colors. The label SHALL come from `t('nonconformities:status.<status>')`. Dark-mode variants SHALL be present on every color class. The component SHALL accept an optional `className` prop for additional Tailwind classes.

#### Scenario: NCStatusBadge renders ABIERTA with blue-teal color
- **WHEN** `<NCStatusBadge status="ABIERTA" />` is rendered
- **THEN** the badge uses `bg-teal/20 text-teal` classes and displays the localized label for ABIERTA

#### Scenario: NCStatusBadge renders EN_INVESTIGACION with amber color
- **WHEN** `<NCStatusBadge status="EN_INVESTIGACION" />` is rendered
- **THEN** the badge uses `bg-amber/20 text-amber` classes and displays the localized label

#### Scenario: NCStatusBadge renders ANALISIS_COMPLETADO with amber-dark color
- **WHEN** `<NCStatusBadge status="ANALISIS_COMPLETADO" />` is rendered
- **THEN** the badge uses `bg-amber/30 text-amber` classes (slightly stronger than EN_INVESTIGACION) and displays the localized label

#### Scenario: NCStatusBadge renders EN_EJECUCION with coral color
- **WHEN** `<NCStatusBadge status="EN_EJECUCION" />` is rendered
- **THEN** the badge uses `bg-coral/20 text-coral` classes and displays the localized label

#### Scenario: NCStatusBadge renders PENDIENTE_CIERRE with warning color
- **WHEN** `<NCStatusBadge status="PENDIENTE_CIERRE" />` is rendered
- **THEN** the badge uses `bg-warning/20 text-warning` classes and displays the localized label

#### Scenario: NCStatusBadge renders CERRADA with success color
- **WHEN** `<NCStatusBadge status="CERRADA" />` is rendered
- **THEN** the badge uses `bg-success/20 text-success` classes and displays the localized label

#### Scenario: NCStatusBadge renders ANULADA with muted color and line-through
- **WHEN** `<NCStatusBadge status="ANULADA" />` is rendered
- **THEN** the badge uses `bg-muted-soft/20 text-muted` classes and applies `line-through` to the label text

#### Scenario: NCStatusBadge renders in dark mode without visual regression
- **WHEN** the `dark` class is present on `<html>` and `<NCStatusBadge>` is rendered
- **THEN** each badge variant resolves to its dark-mode color token without hardcoded hex colors

---

### Requirement: NCStatusBadge color map is exhaustive for all NCStatus values
The system SHALL implement the color mapping as an exhaustive record covering all 7 NCStatus values. TypeScript SHALL emit a compile error if a new NCStatus value is added to the union without a corresponding entry in the color map.

#### Scenario: Color map covers all 7 states
- **WHEN** a developer adds a new value to the `NCStatus` union type
- **THEN** TypeScript reports a type error on the `NCStatusBadge` color map until the new value is handled

#### Scenario: NCStatusBadge does not throw on any valid NCStatus value
- **WHEN** `NCStatusBadge` is rendered with each of the 7 valid NCStatus values
- **THEN** a pill is rendered without runtime errors for every value
