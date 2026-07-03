# Spec: quality-event-constants

## Purpose

UI label constants and color tokens for Quality Event domain types, statuses, origins, and severity levels. Exported from `src/constants/shared.constants.ts` alongside existing incident and document constants, following the pattern established by `incident-constants`.

---

## Requirements

### Requirement: QE_STATUS_LABELS constant
The system SHALL export `QE_STATUS_LABELS` as a `Record<QEStatus, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `QEStatus` value to its Spanish (es-PE) UI label: `ABIERTO` → `'Abierto'`, `EN_INVESTIGACION` → `'En investigación'`, `ANALISIS_COMPLETADO` → `'Análisis completado'`, `EN_EJECUCION` → `'En ejecución'`, `PENDIENTE_CIERRE` → `'Pendiente de cierre'`, `CERRADO` → `'Cerrado'`, `EN_VERIFICACION` → `'En verificación'`, `VERIFICADO` → `'Verificado'`, `REABIERTO` → `'Reabierto'`. The constant SHALL be exhaustive — TypeScript SHALL enforce that all nine `QEStatus` keys are present.

#### Scenario: QE_STATUS_LABELS is importable from shared constants
- **WHEN** a developer imports `QE_STATUS_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all nine QEStatus keys

#### Scenario: QE_STATUS_LABELS provides correct label for EN_INVESTIGACION
- **WHEN** a developer reads `QE_STATUS_LABELS['EN_INVESTIGACION']`
- **THEN** the value is `'En investigación'`

#### Scenario: QE_STATUS_LABELS provides correct label for REABIERTO
- **WHEN** a developer reads `QE_STATUS_LABELS['REABIERTO']`
- **THEN** the value is `'Reabierto'`

---

### Requirement: QE_TYPE_LABELS constant
The system SHALL export `QE_TYPE_LABELS` as a `Record<QEType, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `QEType` value to its Spanish UI label: `CALIDAD` → `'Calidad'`, `SST` → `'SST'`, `ADUANERO` → `'Aduanero'`, `OPERACIONAL` → `'Operacional'`.

#### Scenario: QE_TYPE_LABELS is importable from shared constants
- **WHEN** a developer imports `QE_TYPE_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all four QEType keys

#### Scenario: QE_TYPE_LABELS provides correct label for SST
- **WHEN** a developer reads `QE_TYPE_LABELS['SST']`
- **THEN** the value is `'SST'`

---

### Requirement: QE_SEVERITY_LABELS constant
The system SHALL export `QE_SEVERITY_LABELS` as a `Record<QESeverity, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `QESeverity` value to its Spanish UI label: `BAJA` → `'Baja'`, `MEDIA` → `'Media'`, `ALTA` → `'Alta'`, `CRITICA` → `'Crítica'`.

#### Scenario: QE_SEVERITY_LABELS is importable from shared constants
- **WHEN** a developer imports `QE_SEVERITY_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all four QESeverity keys

#### Scenario: QE_SEVERITY_LABELS provides correct label for CRITICA
- **WHEN** a developer reads `QE_SEVERITY_LABELS['CRITICA']`
- **THEN** the value is `'Crítica'`

---

### Requirement: QE_ORIGIN_LABELS constant
The system SHALL export `QE_ORIGIN_LABELS` as a `Record<QEOrigin, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `QEOrigin` value to its Spanish UI label: `O1_INCIDENTE_CAMPO` → `'Incidente en campo'`, `O2_NC_DETECTADA` → `'No conformidad detectada'`, `O3_HALLAZGO_AUDITORIA` → `'Hallazgo de auditoría'`, `O4_REPORTE_EXTERNO` → `'Reporte externo'`.

#### Scenario: QE_ORIGIN_LABELS is importable from shared constants
- **WHEN** a developer imports `QE_ORIGIN_LABELS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all four QEOrigin keys

#### Scenario: QE_ORIGIN_LABELS provides correct label for O3_HALLAZGO_AUDITORIA
- **WHEN** a developer reads `QE_ORIGIN_LABELS['O3_HALLAZGO_AUDITORIA']`
- **THEN** the value is `'Hallazgo de auditoría'`

---

### Requirement: QE_SEVERITY_COLORS constant
The system SHALL export `QE_SEVERITY_COLORS` as a `Record<QESeverity, string>` constant from `src/constants/shared.constants.ts`. The record SHALL map each `QESeverity` to a Tailwind CSS class string for use in badge components: `BAJA` → `'bg-teal/10 text-teal border-teal/20'`, `MEDIA` → `'bg-amber/10 text-amber border-amber/20'`, `ALTA` → `'bg-error/10 text-error border-error/20'`, `CRITICA` → `'bg-error text-white border-error'`. These values SHALL match the `SeverityTag` patterns established in the design system for M2 (`NCSeveridad`) and M3 (`IncidentSeveridad`).

#### Scenario: QE_SEVERITY_COLORS is importable from shared constants
- **WHEN** a developer imports `QE_SEVERITY_COLORS` from `src/constants/shared.constants.ts`
- **THEN** the import resolves without error and the object contains all four QESeverity keys

#### Scenario: QE_SEVERITY_COLORS provides the correct class string for CRITICA
- **WHEN** a developer reads `QE_SEVERITY_COLORS['CRITICA']`
- **THEN** the value is `'bg-error text-white border-error'`

#### Scenario: QE_SEVERITY_COLORS provides the correct class string for BAJA
- **WHEN** a developer reads `QE_SEVERITY_COLORS['BAJA']`
- **THEN** the value is `'bg-teal/10 text-teal border-teal/20'`

---

### Requirement: Existing shared constants remain unmodified
The system SHALL NOT remove, rename, or change the value of any constant that existed in `src/constants/shared.constants.ts` prior to this change (including `AREAS_SHAC`, `INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS`, `CONDICION_ENTORNO_LABELS`, and all NC/document-related constants). The new QE constants SHALL be added as purely additive entries.

#### Scenario: AREAS_SHAC is still importable after the change
- **WHEN** a developer imports `AREAS_SHAC` from `src/constants/shared.constants.ts` after adding QE constants
- **THEN** the import resolves without error and the array still contains the nine organizational areas

#### Scenario: INCIDENT_STATUS_LABELS is still importable after the change
- **WHEN** a developer imports `INCIDENT_STATUS_LABELS` from `src/constants/shared.constants.ts` after adding QE constants
- **THEN** the import resolves without error and the object still contains all seven IncidentStatus keys
