# Spec: incident-status-badge

## Purpose

Define the IncidentStatusBadge component that renders a colored pill badge for each incident status value, with dark mode support and labels sourced from INCIDENT_STATUS_LABELS.

---

## Requirements

### Requirement: IncidentStatusBadge renders a colored pill for each incident status
The system SHALL export an `IncidentStatusBadge` component from `src/features/incidents/components/IncidentStatusBadge.tsx` that accepts an `status: IncidentStatus` prop and renders a pill badge with the label from `INCIDENT_STATUS_LABELS` and a Tailwind color pair based on the status value. The component SHALL apply `dark:` variants for all color classes. The pill SHALL use `rounded-pill` and `text-xs font-medium px-2.5 py-0.5` as base classes.

Color mapping:
- `ABIERTO` → `bg-teal/15 text-teal`
- `EN_INVESTIGACION` → `bg-amber/15 text-amber`
- `ANALISIS_COMPLETADO` → `bg-amber/20 text-amber-700 dark:text-amber`
- `EN_EJECUCION` → `bg-coral/15 text-coral`
- `PENDIENTE_CIERRE` → `bg-warning/15 text-warning`
- `CERRADO` → `bg-success/15 text-success`
- `ANULADO` → `bg-muted/15 text-muted`

#### Scenario: ABIERTO renders with teal color pair
- **WHEN** `IncidentStatusBadge` receives `status='ABIERTO'`
- **THEN** the rendered element has `bg-teal/15` and `text-teal` classes and displays the label from `INCIDENT_STATUS_LABELS['ABIERTO']`

#### Scenario: CERRADO renders with success color pair
- **WHEN** `IncidentStatusBadge` receives `status='CERRADO'`
- **THEN** the rendered element has `bg-success/15` and `text-success` classes

#### Scenario: ANULADO renders with muted color pair
- **WHEN** `IncidentStatusBadge` receives `status='ANULADO'`
- **THEN** the rendered element has `bg-muted/15` and `text-muted` classes

#### Scenario: Badge label matches INCIDENT_STATUS_LABELS
- **WHEN** `IncidentStatusBadge` receives any valid `status`
- **THEN** the displayed text equals `INCIDENT_STATUS_LABELS[status]`

#### Scenario: Badge renders in dark mode without color artifacts
- **WHEN** the `dark` class is present on `<html>` and `IncidentStatusBadge` renders any status
- **THEN** the badge remains readable with appropriate contrast on dark backgrounds
