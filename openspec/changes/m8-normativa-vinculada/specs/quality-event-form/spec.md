## MODIFIED Requirements

### Requirement: Origen select is the first field and drives conditional sections
The system SHALL render an `<select>` for `origen` as the first form field, populated with the four options from `QE_ORIGIN_LABELS`: `O1_INCIDENTE_CAMPO`, `O2_NC_DETECTADA`, `O3_HALLAZGO_AUDITORIA`, `O4_REPORTE_EXTERNO`. The form SHALL use `watch('origen')` to determine which conditional section to render. When the user changes the origin selection, the fields specific to the previous origin SHALL be cleared via RHF's `resetField` or `setValue` before the new section mounts.

#### Scenario: Origen select shows all four options with human-readable labels
- **WHEN** a user opens the `origen` select
- **THEN** the four options display the labels from `QE_ORIGIN_LABELS` (not raw codes)

#### Scenario: Changing origin from O1 to O2 clears incidenteId
- **WHEN** a user selects O1, fills `incidenteId`, then switches to O2
- **THEN** `incidenteId` is cleared from the form state before the O2 section mounts

#### Scenario: Changing origin from O3 to O4 clears hallazgoCodigo and normativaVinculada
- **WHEN** a user selects O3, fills `hallazgoCodigo` and `normativaVinculada`, then switches to O4
- **THEN** both `hallazgoCodigo` and `normativaVinculada` are cleared from the form state

---

### Requirement: O3 conditional section — hallazgoCodigo and normativaVinculada
The system SHALL render two fields when `origen === 'O3_HALLAZGO_AUDITORIA'`: a text `<input>` registered as `hallazgoCodigo` (maxLength 200, placeholder from `t('qualityEvents:form.hallazgoCodigoPlaceholder')`, Spanish: "Ej. HAL-2026-010"), and a `NormativaVinculadaCombobox` (from `quality-event-normativa-catalog`) registered as `normativaVinculada` via `Controller`. Both fields SHALL be required (RN-QE-010) — a validation error SHALL display below each field when empty on submit with origin O3.

#### Scenario: O3 section renders only when origen is O3_HALLAZGO_AUDITORIA
- **WHEN** the user selects `O3_HALLAZGO_AUDITORIA` in the origen select
- **THEN** the `hallazgoCodigo` input and the `NormativaVinculadaCombobox` become visible and no other origin-specific fields are visible

#### Scenario: O3 submit without hallazgoCodigo shows validation error
- **WHEN** origin is O3, `hallazgoCodigo` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `hallazgoCodigo` field

#### Scenario: O3 submit without normativaVinculada shows validation error
- **WHEN** origin is O3, `normativaVinculada` is unset, and the user submits the form
- **THEN** a Zod validation error appears below the `NormativaVinculadaCombobox`

## REMOVED Requirements

### Requirement: O3 conditional section — hallazgoAuditoriaRef text input
**Reason**: `hallazgoAuditoriaRef` was a single free-text input that could not enforce RN-QE-010 (obligatoriedad de la cláusula de norma incumplida) nor support grouping/reporting by norma real. Replaced by the structured `hallazgoCodigo` text input plus the `NormativaVinculadaCombobox` (catalog-driven norma/cláusula selection with free-text fallback).
**Migration**: Any form or fixture referencing `hallazgoAuditoriaRef` must be updated to populate `hallazgoCodigo` and `normativaVinculada` instead. See `quality-event-msw-fixtures` for the concrete migration of existing O3 QE fixtures.
