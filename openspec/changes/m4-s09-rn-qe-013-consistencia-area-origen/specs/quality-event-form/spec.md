## ADDED Requirements

### Requirement: QualityEventForm prefills origen and origin-specific field from vinculación query params
When `QualityEventForm` mounts in create mode (`/quality-events/nuevo`) with a `origen` query param equal to `O2_NC_DETECTADA` or `O1_INCIDENTE_CAMPO`, the system SHALL prefill the `origen` field with that value and SHALL prefill the corresponding origin-specific field — `ncId` from the `ncId` query param when origen is O2, or `incidenteId` from the `incidenteId` query param when origen is O1 — via `setValue`. This prefill SHALL happen once on mount and SHALL NOT reapply if the user subsequently changes `origen` manually. When no recognized `origen` query param is present (including direct navigation to `/quality-events/nuevo` with no params, and edit mode), the form SHALL behave exactly as before this change — fully empty defaults.

#### Scenario: Navigating with O2 query params prefills origen and ncId
- **WHEN** a user navigates to `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte`
- **THEN** the `origen` select shows `O2_NC_DETECTADA` selected and the `ncId` SearchableSelect shows `NC-2026-014` as the selected value

#### Scenario: Navigating with O1 query params prefills origen and incidenteId
- **WHEN** a user navigates to `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST`
- **THEN** the `origen` select shows `O1_INCIDENTE_CAMPO` selected and the `incidenteId` SearchableSelect shows `INC-2026-003` as the selected value

#### Scenario: No query params leaves the form with empty defaults
- **WHEN** a user navigates to `/quality-events/nuevo` with no query params
- **THEN** `origen` and all origin-specific fields render with their normal empty defaults, unchanged from prior behavior

#### Scenario: Unrecognized origen query param value is ignored
- **WHEN** a user navigates to `/quality-events/nuevo?origen=O3_HALLAZGO_AUDITORIA&ncId=nc-014`
- **THEN** no prefill is applied from `ncId`, `ncNumero`, or `ncArea` — the form behaves as if no vinculación query params were present

---

### Requirement: QualityEventForm prefills areaAfectada from origin entity and warns on divergence (RN-QE-013)
When `QualityEventForm` mounts in create mode with `origen` equal to `O2_NC_DETECTADA` or `O1_INCIDENTE_CAMPO` and a non-empty area query param (`ncArea` or `incidenteArea` respectively), the system SHALL prefill `areaAfectada` with that value and SHALL retain the origin entity's type label (`'la NC'` or `'el Incidente'`), `numero`, and `area` for comparison. While the form is open, the system SHALL compare the live value of `areaAfectada` (via `watch`) against the retained origin area on every change. When the live value is non-empty and differs from the origin area, the system SHALL render a non-blocking warning below the `areaAfectada` field with the exact text `t('qualityEvents:form.areaDivergeWarning', { tipoEtiqueta, numero, areaOrigen })` rendering to `"Esta área difiere de la registrada en {tipoEtiqueta} {numero}: {areaOrigen}."`. The warning SHALL NOT prevent form submission under any circumstance and SHALL NOT create any `AuditTrailEntry`. When the area query param is absent or empty (legacy data), the system SHALL leave `areaAfectada` empty and SHALL never render the warning for this QE creation session, regardless of what the user selects.

#### Scenario: areaAfectada prefilled with NC area and no warning when unchanged
- **WHEN** a user navigates to `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte` and submits without changing `areaAfectada`
- **THEN** `areaAfectada` shows "Almacén Norte" pre-selected, no warning is rendered, and the QE saves with `areaAfectada: 'Almacén Norte'`

#### Scenario: Changing areaAfectada away from NC origin shows the exact warning message
- **WHEN** a user with the same NC query params changes `areaAfectada` to `"Mantenimiento"`
- **THEN** the text "Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte." appears below the `areaAfectada` field before the user submits

#### Scenario: Changing areaAfectada away from Incidente origin shows the adjusted warning message
- **WHEN** a user navigates with `origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST` and changes `areaAfectada` to a different area
- **THEN** the text "Esta área difiere de la registrada en el Incidente INC-2026-003: SyST." appears below the `areaAfectada` field

#### Scenario: Warning does not block submission
- **WHEN** the divergence warning is visible and the user clicks "Guardar QE"
- **THEN** `useCreateQualityEvent().mutate` is called with the user's chosen `areaAfectada` value and the QE is created successfully

#### Scenario: Warning disappears when the user restores the original area
- **WHEN** a user changes `areaAfectada` away from the origin value (triggering the warning) and then reselects the original origin area before submitting
- **THEN** the warning is no longer rendered

#### Scenario: Origen O1 direct report without vinculación query params has no prefill or warning
- **WHEN** a user navigates to `/quality-events/nuevo` and manually selects `origen = O1_INCIDENTE_CAMPO` and picks an `incidenteId` via the SearchableSelect (no query params were present on load)
- **THEN** `areaAfectada` starts empty and no divergence warning ever appears regardless of what the user selects for `areaAfectada`

#### Scenario: Missing origin area query param disables prefill and warning
- **WHEN** a user navigates to `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=nc-099&ncNumero=NC-2025-099` with no `ncArea` param
- **THEN** `areaAfectada` renders empty for manual completion and no divergence warning is ever shown for that session, regardless of the value the user selects
