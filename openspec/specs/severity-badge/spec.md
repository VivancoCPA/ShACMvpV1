# Spec: severity-badge

## Purpose

Defines the `SeverityBadge` shared component for the 4-level SHAC severity scale (BAJA / MEDIA / ALTA / CRITICA). Designed to be domain-agnostic and reusable across M2 (Non-Conformities), M3 (Incidentes SyST), and M4 (Quality Events) without adaptation.

---

## Requirements

### Requirement: SeverityBadge renders 4 SHAC severity levels as styled pills
The system SHALL export a `SeverityBadge` component from `src/components/shared/SeverityBadge.tsx` that accepts a `severity: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'` prop and renders a pill (`rounded-[9999px]`) with semantic background and text colors matching the SHAC semáforo palette. The label SHALL come from `t('common:severity.<severity>')`. Dark-mode variants SHALL be present on every color class. The component SHALL accept an optional `className` prop for additional Tailwind classes.

#### Scenario: SeverityBadge renders BAJA with muted gray color
- **WHEN** `<SeverityBadge severity="BAJA" />` is rendered
- **THEN** the badge uses `bg-muted-soft/20 text-muted` classes and displays the localized label for BAJA

#### Scenario: SeverityBadge renders MEDIA with amber/yellow color
- **WHEN** `<SeverityBadge severity="MEDIA" />` is rendered
- **THEN** the badge uses `bg-amber/20 text-amber` classes and displays the localized label for MEDIA

#### Scenario: SeverityBadge renders ALTA with orange/error-light color
- **WHEN** `<SeverityBadge severity="ALTA" />` is rendered
- **THEN** the badge uses `bg-error/10 text-error` classes with reduced intensity compared to CRITICA, and displays the localized label

#### Scenario: SeverityBadge renders CRITICA with full error color
- **WHEN** `<SeverityBadge severity="CRITICA" />` is rendered
- **THEN** the badge uses `bg-error/20 text-error font-semibold` classes and displays the localized label with bold weight to emphasize criticality

#### Scenario: SeverityBadge renders in dark mode without visual regression
- **WHEN** the `dark` class is present on `<html>` and `<SeverityBadge>` is rendered
- **THEN** each severity variant resolves to its dark-mode color token without hardcoded hex colors

---

### Requirement: SeverityBadge i18n labels live in the common namespace
The system SHALL use translation keys from the `common` namespace so that M3 and M4 can use the same component and translation without duplication. Keys SHALL follow the pattern `common:severity.BAJA`, `common:severity.MEDIA`, `common:severity.ALTA`, `common:severity.CRITICA`.

#### Scenario: SeverityBadge uses common namespace keys
- **WHEN** a developer renders `<SeverityBadge severity="ALTA" />` in an M3 (Incidentes) page
- **THEN** the label resolves from `t('common:severity.ALTA')` without the M3 page needing to load the `nonconformities` namespace

#### Scenario: Common severity keys exist in es-PE.json
- **WHEN** the i18n configuration loads `es-PE.json`
- **THEN** the `common.severity` object contains keys: `BAJA`, `MEDIA`, `ALTA`, `CRITICA` with Spanish labels

#### Scenario: Common severity keys exist in en-US.json
- **WHEN** the i18n configuration loads `en-US.json`
- **THEN** the `common.severity` object contains keys: `BAJA`, `MEDIA`, `ALTA`, `CRITICA` with English labels

---

### Requirement: SeverityBadge color map is exhaustive for all 4 severity values
The system SHALL implement the color mapping as an exhaustive record so TypeScript emits a compile error if a new severity value is introduced without a corresponding color entry.

#### Scenario: Color map covers all 4 severity levels
- **WHEN** a developer adds a new value to the severity union prop
- **THEN** TypeScript reports a type error on the `SeverityBadge` color map until the new value is handled

#### Scenario: SeverityBadge does not throw on any valid severity value
- **WHEN** `SeverityBadge` is rendered with each of the 4 valid severity values
- **THEN** a pill is rendered without runtime errors for every value
