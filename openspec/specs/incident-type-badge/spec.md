# Spec: incident-type-badge

## Purpose

Define the IncidentTypeBadge component that renders a colored pill badge with an inline icon for each incident type value, with dark mode support and labels sourced from INCIDENT_TYPE_LABELS.

---

## Requirements

### Requirement: IncidentTypeBadge renders a colored pill with icon for each incident type
The system SHALL export an `IncidentTypeBadge` component from `src/features/incidents/components/IncidentTypeBadge.tsx` that accepts a `type: IncidentType` prop and renders a pill badge with a lucide-react icon, the label from `INCIDENT_TYPE_LABELS`, and a Tailwind color pair based on the type value. The component SHALL apply `dark:` variants for all color classes. The pill SHALL use `rounded-pill` and `text-xs font-medium px-2.5 py-0.5 inline-flex items-center gap-1` as base classes. The icon SHALL be 12px (w-3 h-3).

Icon and color mapping:
- `ACCIDENTE` → icon `AlertTriangle`, color `bg-error/15 text-error`
- `INCIDENTE` → icon `AlertCircle`, color `bg-coral/15 text-coral`
- `CUASI_ACCIDENTE` → icon `AlertOctagon`, color `bg-amber/15 text-amber`
- `CONDICION_INSEGURA` → icon `ShieldAlert`, color `bg-warning/15 text-warning`

#### Scenario: ACCIDENTE renders with error color pair and AlertTriangle icon
- **WHEN** `IncidentTypeBadge` receives `type='ACCIDENTE'`
- **THEN** the rendered element has `bg-error/15` and `text-error` classes, renders an `AlertTriangle` icon, and displays the label from `INCIDENT_TYPE_LABELS['ACCIDENTE']`

#### Scenario: CUASI_ACCIDENTE renders with amber color pair and AlertOctagon icon
- **WHEN** `IncidentTypeBadge` receives `type='CUASI_ACCIDENTE'`
- **THEN** the rendered element has `bg-amber/15` and `text-amber` classes and renders an `AlertOctagon` icon

#### Scenario: CONDICION_INSEGURA renders with warning color pair and ShieldAlert icon
- **WHEN** `IncidentTypeBadge` receives `type='CONDICION_INSEGURA'`
- **THEN** the rendered element has `bg-warning/15` and `text-warning` classes and renders a `ShieldAlert` icon

#### Scenario: Badge label matches INCIDENT_TYPE_LABELS
- **WHEN** `IncidentTypeBadge` receives any valid `type`
- **THEN** the displayed text equals `INCIDENT_TYPE_LABELS[type]`

#### Scenario: Badge renders icon inline with label
- **WHEN** `IncidentTypeBadge` renders any type
- **THEN** the icon and text are on the same line with a gap, not stacked vertically
