# nonconformity-constants

Constants and lookup tables for the M2 non-conformity domain: state machine transitions, UI labels, and color mappings. Consumed by permission helpers, list views, and form selects.

## ADDED Requirements

### Requirement: NC_STATE_TRANSITIONS defines valid transitions per state
The system SHALL export a `NC_STATE_TRANSITIONS` constant from `src/features/nonconformities/constants/nonconformity.constants.ts` as a `Record<NCStatus, NCStatus[]>` that maps each state to its allowed successor states:
- `DETECTADA` → `['EN_INVESTIGACION']`
- `EN_INVESTIGACION` → `['EN_CORRECCION']`
- `EN_CORRECCION` → `['PENDIENTE_CIERRE', 'EN_INVESTIGACION']`
- `PENDIENTE_CIERRE` → `['CERRADA', 'EN_INVESTIGACION']`
- `CERRADA` → `['REABIERTA']`
- `REABIERTA` → `['EN_INVESTIGACION']`

#### Scenario: NC_STATE_TRANSITIONS covers all NCStatus keys
- **WHEN** a developer iterates over `Object.keys(NC_STATE_TRANSITIONS)`
- **THEN** all six `NCStatus` values appear as keys with no extras

#### Scenario: CERRADA has exactly one allowed transition
- **WHEN** a developer reads `NC_STATE_TRANSITIONS['CERRADA']`
- **THEN** the array contains exactly `['REABIERTA']`

#### Scenario: DETECTADA cannot transition to CERRADA directly
- **WHEN** a developer reads `NC_STATE_TRANSITIONS['DETECTADA']`
- **THEN** the array does not include `'CERRADA'`

### Requirement: NC_STATUS_LABELS maps NCStatus to localization keys
The system SHALL export `NC_STATUS_LABELS` as a `Record<NCStatus, string>` where each value is a react-i18next translation key (e.g., `'nonconformities:status.DETECTADA'`). Labels SHALL be defined for all six states.

#### Scenario: NC_STATUS_LABELS has an entry for every NCStatus value
- **WHEN** a developer maps over all `NCStatus` values
- **THEN** each value has a corresponding key in `NC_STATUS_LABELS` that is a non-empty string

### Requirement: NC_TIPO_LABELS maps NCTipo to localization keys
The system SHALL export `NC_TIPO_LABELS` as a `Record<NCTipo, string>` where each value is a react-i18next translation key (e.g., `'nonconformities:tipo.PROCESO'`).

#### Scenario: NC_TIPO_LABELS has an entry for every NCTipo value
- **WHEN** a developer maps over all `NCTipo` values
- **THEN** each value has a corresponding key in `NC_TIPO_LABELS` that is a non-empty string

### Requirement: NC_SEVERIDAD_LABELS maps NCSeveridad to localization keys
The system SHALL export `NC_SEVERIDAD_LABELS` as a `Record<NCSeveridad, string>` where each value is a react-i18next translation key (e.g., `'nonconformities:severidad.MENOR'`).

#### Scenario: NC_SEVERIDAD_LABELS has an entry for every NCSeveridad value
- **WHEN** a developer maps over all `NCSeveridad` values
- **THEN** each value has a corresponding key in `NC_SEVERIDAD_LABELS` that is a non-empty string

### Requirement: NC_ORIGEN_LABELS maps NCOrigen to localization keys
The system SHALL export `NC_ORIGEN_LABELS` as a `Record<NCOrigen, string>` where each value is a react-i18next translation key (e.g., `'nonconformities:origen.INSPECCION_INTERNA'`).

#### Scenario: NC_ORIGEN_LABELS has an entry for every NCOrigen value
- **WHEN** a developer maps over all `NCOrigen` values
- **THEN** each value has a corresponding key in `NC_ORIGEN_LABELS` that is a non-empty string

### Requirement: NC_SEVERIDAD_COLORS maps NCSeveridad to Tailwind color tokens
The system SHALL export `NC_SEVERIDAD_COLORS` as a `Record<NCSeveridad, string>` mapping severity values to Tailwind CSS class strings used in `SeverityTag` and list row highlighting:
- `MENOR` → teal color classes
- `MAYOR` → amber color classes
- `CRITICA` → error color classes

#### Scenario: NC_SEVERIDAD_COLORS.CRITICA uses error color tokens
- **WHEN** a developer reads `NC_SEVERIDAD_COLORS['CRITICA']`
- **THEN** the value contains the `error` color token class (e.g., `'bg-error'` or `'text-error'`)

#### Scenario: NC_SEVERIDAD_COLORS.MENOR uses teal color tokens
- **WHEN** a developer reads `NC_SEVERIDAD_COLORS['MENOR']`
- **THEN** the value contains the `teal` color token class

### Requirement: NC_STATUS_COLORS maps NCStatus to Tailwind color tokens for StatusBadge
The system SHALL export `NC_STATUS_COLORS` as a `Record<NCStatus, string>` mapping each status to Tailwind CSS class strings for use in `StatusBadge` pill components.

#### Scenario: NC_STATUS_COLORS has an entry for every NCStatus value
- **WHEN** a developer maps over all `NCStatus` values
- **THEN** each value has a corresponding non-empty class string in `NC_STATUS_COLORS`

#### Scenario: CERRADA status uses success color token
- **WHEN** a developer reads `NC_STATUS_COLORS['CERRADA']`
- **THEN** the value contains the `success` color token class

#### Scenario: REABIERTA status uses warning or amber color token
- **WHEN** a developer reads `NC_STATUS_COLORS['REABIERTA']`
- **THEN** the value contains the `warning` or `amber` color token class
