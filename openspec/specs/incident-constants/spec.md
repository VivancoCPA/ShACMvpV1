# Spec: incident-constants

## Purpose

UI label constants for incident domain types, statuses, and environment conditions. Exported from `src/constants/shared.constants.ts` alongside existing shared constants to avoid cross-feature dependencies.

---

## Requirements

### Requirement: INCIDENT_TYPE_LABELS constant
The system SHALL export `INCIDENT_TYPE_LABELS` as a `Record<IncidentType, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `IncidentType` value to its Spanish UI label: `ACCIDENTE` → `'Accidente'`, `INCIDENTE` → `'Incidente'`, `CUASI_ACCIDENTE` → `'Cuasi-accidente'`, `CONDICION_INSEGURA` → `'Condición insegura'`. The constant SHALL be exhaustive — TypeScript SHALL enforce that all `IncidentType` keys are present.

#### Scenario: INCIDENT_TYPE_LABELS is importable from shared constants
- **WHEN** a developer imports `INCIDENT_TYPE_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all four IncidentType keys

#### Scenario: INCIDENT_TYPE_LABELS provides the correct label for CUASI_ACCIDENTE
- **WHEN** a developer reads `INCIDENT_TYPE_LABELS['CUASI_ACCIDENTE']`
- **THEN** the value is `'Cuasi-accidente'`

---

### Requirement: INCIDENT_STATUS_LABELS constant
The system SHALL export `INCIDENT_STATUS_LABELS` as a `Record<IncidentStatus, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `IncidentStatus` value to its Spanish UI label: `ABIERTO` → `'Abierto'`, `EN_INVESTIGACION` → `'En investigación'`, `ANALISIS_COMPLETADO` → `'Análisis completado'`, `EN_EJECUCION` → `'En ejecución'`, `PENDIENTE_CIERRE` → `'Pendiente de cierre'`, `CERRADO` → `'Cerrado'`, `ANULADO` → `'Anulado'`.

#### Scenario: INCIDENT_STATUS_LABELS is importable from shared constants
- **WHEN** a developer imports `INCIDENT_STATUS_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all seven IncidentStatus keys

#### Scenario: INCIDENT_STATUS_LABELS provides correct label for EN_INVESTIGACION
- **WHEN** a developer reads `INCIDENT_STATUS_LABELS['EN_INVESTIGACION']`
- **THEN** the value is `'En investigación'`

---

### Requirement: CONDICION_ENTORNO_LABELS constant
The system SHALL export `CONDICION_ENTORNO_LABELS` as a `Record<CondicionEntorno, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `CondicionEntorno` value to its Spanish UI label: `ILUMINACION` → `'Iluminación'`, `PISO` → `'Piso'`, `SENALIZACION` → `'Señalización'`, `EPP` → `'EPP'`, `CLIMA` → `'Clima'`, `OTRO` → `'Otro'`.

#### Scenario: CONDICION_ENTORNO_LABELS is importable from shared constants
- **WHEN** a developer imports `CONDICION_ENTORNO_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all six CondicionEntorno keys

#### Scenario: CONDICION_ENTORNO_LABELS provides correct label for SENALIZACION
- **WHEN** a developer reads `CONDICION_ENTORNO_LABELS['SENALIZACION']`
- **THEN** the value is `'Señalización'`

---

### Requirement: Existing shared constants remain unmodified
The system SHALL NOT remove, rename, or change the value of any constant that existed in `src/constants/shared.constants.ts` prior to this change (including `AREAS_SHAC` and all NC/document-related constants). The new incident constants SHALL be added as purely additive entries.

#### Scenario: AREAS_SHAC is still importable after the change
- **WHEN** a developer imports `AREAS_SHAC` from `src/constants/shared.constants.ts` after adding incident constants
- **THEN** the import resolves without error and the array still contains the nine organizational areas
