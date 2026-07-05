# Spec: quality-event-form

## Purpose

Define the QualityEventForm page component that allows OPERARIO, SUPERVISOR, and JEFE_CALIDAD_SYST roles to create new Quality Events via a validated form backed by React Hook Form and Zod.

---

## Requirements

### Requirement: QualityEventForm page accessible at /quality-events/nuevo for authorized roles
The system SHALL export a `QualityEventForm` component from `src/features/quality-events/pages/QualityEventForm.tsx` and render it at the route `/quality-events/nuevo`. Only users with roles `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST` SHALL access the route — `AUDITOR_INTERNO` and `ALTA_DIRECCION` SHALL be redirected by `RoleGuard`. The page SHALL be wrapped in a `PageWrapper` with the title from `t('qualityEvents:form.createTitle')` and a breadcrumb `"Quality Events > Nuevo QE"`.

#### Scenario: OPERARIO accesses /quality-events/nuevo without redirection
- **WHEN** an authenticated user with role `OPERARIO` navigates to `/quality-events/nuevo`
- **THEN** `QualityEventForm` renders without redirection

#### Scenario: SUPERVISOR accesses /quality-events/nuevo without redirection
- **WHEN** an authenticated user with role `SUPERVISOR` navigates to `/quality-events/nuevo`
- **THEN** `QualityEventForm` renders without redirection

#### Scenario: AUDITOR_INTERNO is redirected from /quality-events/nuevo
- **WHEN** an authenticated user with role `AUDITOR_INTERNO` navigates to `/quality-events/nuevo`
- **THEN** the user is redirected to `/no-autorizado` by `RoleGuard`

#### Scenario: ALTA_DIRECCION is redirected from /quality-events/nuevo
- **WHEN** an authenticated user with role `ALTA_DIRECCION` navigates to `/quality-events/nuevo`
- **THEN** the user is redirected to `/no-autorizado` by `RoleGuard`

---

### Requirement: QualityEventForm wraps its content in a surface card container
The system SHALL render all form content inside a container element with surface background (`bg-surface-card dark:bg-surface-dark-elevated`), border (`border border-hairline dark:border-hairline/20`), border radius (`rounded-xl`), and internal padding consistent with the visual pattern of NCForm (M2-S04) and IncidentForm (M3-S04). The form SHALL NOT render its content directly over the page background canvas.

#### Scenario: Form content is visually contained in a card box
- **WHEN** the QualityEventForm page renders
- **THEN** all form fields are wrapped in a card container with surface background, border, and rounded corners — not floating directly over the page canvas

---

### Requirement: QualityEventForm uses qualityEventCreateSchema and useCreateQualityEvent
The system SHALL initialize `QualityEventForm` with `useForm<QualityEventCreateInput>({ resolver: zodResolver(qualityEventCreateSchema) })`. On submit, the form SHALL call `useCreateQualityEvent().mutate(data)`. On success, the form SHALL navigate to `/quality-events/<newQE.id>` using `useNavigate`. The hook already fires `toast.success` internally — the form SHALL NOT fire an additional toast on success. On mutation error, the form SHALL show a `toast.error` using the server message if present, otherwise a fallback from `t('qualityEvents:form.errors.generic')`.

#### Scenario: Valid form submit calls mutate with validated payload
- **WHEN** a user completes all required fields and clicks "Guardar QE"
- **THEN** `useCreateQualityEvent().mutate` is called with the `QualityEventCreateInput` payload

#### Scenario: Submit navigates to detail page on success
- **WHEN** `useCreateQualityEvent` resolves with `data.id = 'qe-2026-009'`
- **THEN** the router navigates to `/quality-events/qe-2026-009`

#### Scenario: Submit shows generic error toast on failure
- **WHEN** `useCreateQualityEvent` resolves with an error and no server message
- **THEN** `toast.error(t('qualityEvents:form.errors.generic'))` is shown

#### Scenario: Cancel button navigates to /quality-events without submitting
- **WHEN** the user clicks the "Cancelar" button
- **THEN** the router navigates to `/quality-events` and `mutate` is never called

#### Scenario: Submit button is disabled while mutation is loading
- **WHEN** `useCreateQualityEvent().isPending` is `true`
- **THEN** the "Guardar QE" button has the `disabled` attribute

---

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

---

### Requirement: Origen select is the first field and drives conditional sections
The system SHALL render an `<select>` for `origen` as the first form field, populated with the four options from `QE_ORIGIN_LABELS`: `O1_INCIDENTE_CAMPO`, `O2_NC_DETECTADA`, `O3_HALLAZGO_AUDITORIA`, `O4_REPORTE_EXTERNO`. The form SHALL use `watch('origen')` to determine which conditional section to render. When the user changes the origin selection, the fields specific to the previous origin SHALL be cleared via RHF's `resetField` or `setValue` before the new section mounts.

#### Scenario: Origen select shows all four options with human-readable labels
- **WHEN** a user opens the `origen` select
- **THEN** the four options display the labels from `QE_ORIGIN_LABELS` (not raw codes)

#### Scenario: Changing origin from O1 to O2 clears incidenteId
- **WHEN** a user selects O1, fills `incidenteId`, then switches to O2
- **THEN** `incidenteId` is cleared from the form state before the O2 section mounts

#### Scenario: Changing origin from O3 to O4 clears hallazgoAuditoriaRef
- **WHEN** a user selects O3, fills `hallazgoAuditoriaRef`, then switches to O4
- **THEN** `hallazgoAuditoriaRef` is cleared from the form state

---

### Requirement: O1 conditional section — incidenteId SearchableSelect loaded from /api/incidents
The system SHALL render a `SearchableSelect` component (from `src/components/shared/SearchableSelect.tsx`) for `incidenteId` when `origen === 'O1_INCIDENTE_CAMPO'`. The component SHALL be populated by a `useQuery` call to `GET /api/incidents` (enabled only when origin is O1). Each option SHALL display `incident.numero` in bold, a truncated `incident.descripcion` (60 chars), and `incident.area`. The `SearchableSelect` SHALL register the selected `incident.id` (not the visible label) into React Hook Form via `Controller`. When the API query returns an empty array, an inline message from `t('qualityEvents:form.noIncidents')` SHALL appear in place of the component. A validation error from Zod (`incidenteId` required) SHALL display below the field when origin is O1 and the field is empty on submit.

#### Scenario: O1 section renders only when origen is O1_INCIDENTE_CAMPO
- **WHEN** the user selects `O1_INCIDENTE_CAMPO` in the origen select
- **THEN** the `incidenteId` SearchableSelect becomes visible and no other origin-specific fields are visible

#### Scenario: O1 section is hidden when origen is not O1
- **WHEN** the user selects `O2_NC_DETECTADA` in the origen select
- **THEN** the `incidenteId` SearchableSelect is not rendered

#### Scenario: O1 SearchableSelect filters options by typing in search input
- **WHEN** the user types `"INC-2025"` into the SearchableSelect search input
- **THEN** the dropdown shows only incidents whose `numero` or `descripcion` contains `"INC-2025"`, with all other options hidden

#### Scenario: O1 SearchableSelect shows no-results message when search matches nothing
- **WHEN** the user types text that matches no incident in the list
- **THEN** the dropdown shows `t('qualityEvents:form.noSearchResults', { query: '<typed text>' })` and no option items

#### Scenario: O1 SearchableSelect closes and shows selected numero after selection
- **WHEN** the user clicks an option in the dropdown
- **THEN** the search input displays the selected incident's `numero`, the dropdown closes, and `incidenteId` in RHF state holds the selected `id`

#### Scenario: O1 SearchableSelect clears incidenteId when × button is clicked
- **WHEN** an incident is selected and the user clicks the × clear button
- **THEN** the search input is cleared, `incidenteId` is set to `undefined` in RHF state, and the dropdown remains closed

#### Scenario: O1 SearchableSelect shows at most 6 options before scrolling
- **WHEN** the filtered list contains more than 6 incidents
- **THEN** the dropdown shows exactly 6 items visually and the rest are accessible via scroll

#### Scenario: O1 empty API state shows inline message when no incidents returned
- **WHEN** `GET /api/incidents` returns an empty array and origin is O1
- **THEN** `t('qualityEvents:form.noIncidents')` is rendered instead of the SearchableSelect component

#### Scenario: O1 submit without incidenteId shows validation error
- **WHEN** origin is O1, `incidenteId` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `incidenteId` field

---

### Requirement: O2 conditional section — ncId SearchableSelect loaded from /api/nonconformities
The system SHALL render a `SearchableSelect` component (from `src/components/shared/SearchableSelect.tsx`) for `ncId` when `origen === 'O2_NC_DETECTADA'`. The component SHALL be populated by a `useQuery` call to `GET /api/nonconformities` (enabled only when origin is O2). Each option SHALL display `nc.numero` in bold, a truncated `nc.titulo` (60 chars), and `nc.areaAfectada`. The `SearchableSelect` SHALL register the selected `nc.id` (not the visible label) into React Hook Form via `Controller`. When the API query returns an empty array, an inline message from `t('qualityEvents:form.noNonconformities')` SHALL appear in place of the component. A validation error SHALL appear below the field when ncId is empty on submit with origin O2.

#### Scenario: O2 section renders only when origen is O2_NC_DETECTADA
- **WHEN** the user selects `O2_NC_DETECTADA` in the origen select
- **THEN** the `ncId` SearchableSelect becomes visible and no other origin-specific fields are visible

#### Scenario: O2 section is hidden when origen is not O2
- **WHEN** the user selects `O3_HALLAZGO_AUDITORIA` in the origen select
- **THEN** the `ncId` SearchableSelect is not rendered

#### Scenario: O2 SearchableSelect filters options by typing in search input
- **WHEN** the user types `"NC-2025"` into the SearchableSelect search input
- **THEN** the dropdown shows only NCs whose `numero` or `titulo` contains `"NC-2025"`, with all other options hidden

#### Scenario: O2 SearchableSelect shows no-results message when search matches nothing
- **WHEN** the user types text that matches no NC in the list
- **THEN** the dropdown shows `t('qualityEvents:form.noSearchResults', { query: '<typed text>' })` and no option items

#### Scenario: O2 SearchableSelect closes and shows selected numero after selection
- **WHEN** the user clicks an option in the dropdown
- **THEN** the search input displays the selected NC's `numero`, the dropdown closes, and `ncId` in RHF state holds the selected `id`

#### Scenario: O2 SearchableSelect clears ncId when × button is clicked
- **WHEN** a NC is selected and the user clicks the × clear button
- **THEN** the search input is cleared, `ncId` is set to `undefined` in RHF state, and the dropdown remains closed

#### Scenario: O2 SearchableSelect shows at most 6 options before scrolling
- **WHEN** the filtered list contains more than 6 NCs
- **THEN** the dropdown shows exactly 6 items visually and the rest are accessible via scroll

#### Scenario: O2 empty API state shows inline message when no NCs returned
- **WHEN** `GET /api/nonconformities` returns an empty array and origin is O2
- **THEN** `t('qualityEvents:form.noNonconformities')` is rendered instead of the SearchableSelect component

#### Scenario: O2 submit without ncId shows validation error
- **WHEN** origin is O2, `ncId` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `ncId` field

---

### Requirement: O3 conditional section — hallazgoAuditoriaRef text input
The system SHALL render a text `<input>` for `hallazgoAuditoriaRef` when `origen === 'O3_HALLAZGO_AUDITORIA'`. The input SHALL have maxLength 200 and placeholder from `t('qualityEvents:form.hallazgoPlaceholder')` (Spanish: "Ej. NC-ISO-9001-2015-§8.4.1 — Evaluación de proveedores"). A validation error SHALL display below the field when empty on submit with origin O3.

#### Scenario: O3 section renders only when origen is O3_HALLAZGO_AUDITORIA
- **WHEN** the user selects `O3_HALLAZGO_AUDITORIA` in the origen select
- **THEN** the `hallazgoAuditoriaRef` input becomes visible and no other origin-specific fields are visible

#### Scenario: O3 submit without hallazgoAuditoriaRef shows validation error
- **WHEN** origin is O3, `hallazgoAuditoriaRef` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `hallazgoAuditoriaRef` field

---

### Requirement: O4 conditional section — reporteExternoRef.nombreCliente and reporteExternoRef.fechaRecepcion
The system SHALL render two fields when `origen === 'O4_REPORTE_EXTERNO'`: a text `<input>` registered as `reporteExternoRef.nombreCliente` (maxLength 200, required) and a date `<input type="date">` registered as `reporteExternoRef.fechaRecepcion` (required, must not be a future date). Validation errors from Zod SHALL display below each respective field when empty or invalid on submit with origin O4.

#### Scenario: O4 section renders only when origen is O4_REPORTE_EXTERNO
- **WHEN** the user selects `O4_REPORTE_EXTERNO` in the origen select
- **THEN** both `reporteExternoRef.nombreCliente` and `reporteExternoRef.fechaRecepcion` inputs become visible and no other origin-specific fields are visible

#### Scenario: O4 submit without nombreCliente shows validation error
- **WHEN** origin is O4, `reporteExternoRef.nombreCliente` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `nombreCliente` field

#### Scenario: O4 submit without fechaRecepcion shows validation error
- **WHEN** origin is O4, `reporteExternoRef.fechaRecepcion` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `fechaRecepcion` field

---

### Requirement: Common header fields rendered independently of origen
The system SHALL render the following fields regardless of the selected origin: `tipo` (`<select>` from `QE_TYPE_LABELS`), `severidad` (`<select>` from `QE_SEVERITY_LABELS`), `descripcion` (`<textarea>`, min 10 / max 2000 per `qualityEventCreateSchema`), `areaAfectada` (`<select>` from `AREAS_SHAC`), `mineralInvolucrado` (`<select>` with mineral options and a free-text "Otro" option, optional), `turno` (`<select>` with `DIA`, `TARDE`, `NOCHE` options), and `fechaHoraEvento` (`<input type="datetime-local">`, must not be in the future). All required fields SHALL show inline Zod validation errors below their respective controls on submit.

#### Scenario: tipo select shows all four QEType options
- **WHEN** a user opens the tipo select
- **THEN** the four options display labels from `QE_TYPE_LABELS`

#### Scenario: severidad select shows all four QESeverity options
- **WHEN** a user opens the severidad select
- **THEN** the four options display labels from `QE_SEVERITY_LABELS`

#### Scenario: areaAfectada select is populated from AREAS_SHAC
- **WHEN** a user opens the areaAfectada select
- **THEN** the options correspond to the areas defined in `AREAS_SHAC` from `src/constants/shared.constants.ts`

#### Scenario: turno select shows DIA, TARDE, NOCHE options
- **WHEN** a user opens the turno select
- **THEN** the three options are DÍA, TARDE, and NOCHE with localized labels

#### Scenario: fechaHoraEvento future date shows validation error
- **WHEN** the user selects a `fechaHoraEvento` in the future and submits
- **THEN** a validation error from `t('qualityEvents:form.errors.fechaFutura')` appears below the field

#### Scenario: descripcion shows inline Zod error when empty on submit
- **WHEN** the user submits the form with an empty `descripcion`
- **THEN** a validation error appears below the textarea

#### Scenario: mineralInvolucrado is optional and does not block submit when absent
- **WHEN** the user submits the form without selecting a `mineralInvolucrado`
- **THEN** the form submits without a validation error on that field

---

### Requirement: CRITICA severity banner
The system SHALL display an inline warning banner immediately below the `severidad` select when `watch('severidad') === 'CRITICA'`. The banner text SHALL come from `t('qualityEvents:form.criticaBanner')` (Spanish: "Severidad CRÍTICA — se notificará a Gerencia al guardar (RN-QE-005)"). The banner SHALL use warning styling (`bg-warning/10 text-warning border border-warning/30 rounded-md`) and SHALL appear and disappear reactively as the user changes the severity value.

#### Scenario: CRITICA banner appears when severidad is CRITICA
- **WHEN** the user selects `CRITICA` in the severidad select
- **THEN** the warning banner with the RN-QE-005 message is rendered below the select

#### Scenario: CRITICA banner disappears when severidad changes away from CRITICA
- **WHEN** the user changes the severidad from `CRITICA` to `ALTA`
- **THEN** the warning banner is no longer rendered

---

### Requirement: descripcion character counter
The system SHALL render a live character counter adjacent to the `descripcion` textarea displaying `"<current>/<2000>"`. The counter SHALL update on every keystroke via `watch('descripcion')`. The counter SHALL turn the color `text-error` when the character count reaches or exceeds 1900 characters.

#### Scenario: Character counter updates on keypress
- **WHEN** the user types 150 characters into the descripcion textarea
- **THEN** the counter displays `"150/2000"`

#### Scenario: Counter turns error color near limit
- **WHEN** the textarea contains 1950 characters
- **THEN** the counter text has the `text-error` class applied

---

### Requirement: QualityEventForm is responsive — single column on mobile, two columns on desktop
The system SHALL lay out the form fields in a single column on viewports below 768 px and in two columns on viewports ≥ 768 px using CSS Grid (`grid grid-cols-1 md:grid-cols-2`). Short paired fields (`tipo` + `severidad`, `turno` + `fechaHoraEvento`) SHALL each occupy one column in the two-column layout. Full-width fields (`descripcion`, origin-specific sections, `mineralInvolucrado`) SHALL span both columns (`md:col-span-2`). The form SHALL not produce a horizontal scrollbar at any viewport.

#### Scenario: Two-column layout on desktop
- **WHEN** the viewport is ≥ 768 px wide
- **THEN** `tipo` and `severidad` appear side by side in a two-column grid row

#### Scenario: Single-column layout on mobile
- **WHEN** the viewport is < 768 px wide
- **THEN** all fields stack vertically in a single column with no horizontal overflow

---

### Requirement: QualityEventForm edit mode at /quality-events/:id/editar
The system SHALL render `QualityEventForm` at the route `/quality-events/:id/editar`, loading the target QE via `useQualityEvent(id)`. Access to this route SHALL be gated by `resolveQEEditAccess(qe, usuario).reporteInicial === true` — a user without RN-QE-010 access who navigates to this route directly (e.g. by typing the URL) SHALL be redirected to `/quality-events/:id`. In edit mode the form SHALL initialize via `useForm` with `defaultValues` populated from the loaded QE instead of empty defaults, and SHALL submit via `useEditarReporteInicial().mutate({ id, data })` instead of `useCreateQualityEvent`.

#### Scenario: Authorized user loads the edit form pre-filled
- **WHEN** a user with `resolveQEEditAccess(qe, usuario).reporteInicial === true` navigates to `/quality-events/qe-2026-010/editar`
- **THEN** `QualityEventForm` renders with `descripcion`, `areaAfectada`, `turno`, `fechaHoraEvento`, and `mineralInvolucrado` pre-filled from the loaded QE

#### Scenario: Unauthorized direct navigation redirects to the detail page
- **WHEN** a user without RN-QE-010 access for that QE navigates directly to `/quality-events/qe-2026-010/editar`
- **THEN** the user is redirected to `/quality-events/qe-2026-010`

#### Scenario: Edit submit calls useEditarReporteInicial instead of useCreateQualityEvent
- **WHEN** the user submits the edit form with valid changes
- **THEN** `useEditarReporteInicial().mutate` is called with `{ id: qe.id, data }` and `useCreateQualityEvent` is never called

#### Scenario: Edit submit navigates back to the detail page, not to a new id
- **WHEN** `useEditarReporteInicial` resolves successfully for `qe.id === 'qe-2026-010'`
- **THEN** the router navigates to `/quality-events/qe-2026-010`

---

### Requirement: QualityEventForm edit mode locks protected fields as read-only text
In edit mode, `numero`, `origen`, `tipo`, `fechaHoraReporte` (labeled "Fecha de reporte"), and the reporter's display name (`reportadoPorId` resolved to a name) SHALL render as read-only text, never as an editable input, `<select>`, or a `disabled` form control that still appears in the submitted payload's shape.

#### Scenario: numero renders as read-only text in edit mode
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `numero: 'QE-2026-010'`
- **THEN** `'QE-2026-010'` is displayed as plain text, with no corresponding input element in the DOM

#### Scenario: origen, tipo, fechaHoraReporte, reportadoPorId are all read-only in edit mode
- **WHEN** `QualityEventForm` renders in edit mode
- **THEN** `origen`, `tipo`, `fechaHoraReporte`, and the reporter's name are all displayed as plain text with no editable controls

---

### Requirement: QualityEventForm edit mode unlocks the RN-QE-010 field subset plus origin-specific fields
In edit mode, the system SHALL render editable controls for `descripcion`, `areaAfectada`, `turno`, `fechaHoraEvento`, and `mineralInvolucrado`, plus the origin-specific field(s) matching the QE's existing `origen` (`incidenteId` for O1, `ncId` for O2, `hallazgoAuditoriaRef` for O3, `reporteExternoRef` for O4) — the same conditional-section components used in create mode, but never allowing `origen` itself to change. The `severidad` field SHALL remain absent from edit mode unless `resolveQEEditAccess(qe, usuario).severidad` is also `true` (the double-role case), in which case a `severidad` select SHALL additionally render.

#### Scenario: descripcion, areaAfectada, turno, fechaHoraEvento, mineralInvolucrado are editable
- **WHEN** `QualityEventForm` renders in edit mode for a user with only `reporteInicial: true`
- **THEN** `descripcion`, `areaAfectada`, `turno`, `fechaHoraEvento`, and `mineralInvolucrado` all render as editable controls

#### Scenario: Origin-specific field for the QE's existing origen renders and is editable
- **WHEN** `QualityEventForm` renders in edit mode for a QE with `origen: 'O1_INCIDENTE_CAMPO'`
- **THEN** the `incidenteId` `SearchableSelect` renders and is editable, and no other origin's fields render

#### Scenario: severidad is absent for a reporteInicial-only editor
- **WHEN** `QualityEventForm` renders in edit mode for a user with `{ reporteInicial: true, severidad: false, mineral: true }`
- **THEN** no `severidad` field renders in the form

#### Scenario: severidad additionally renders for a double-role editor
- **WHEN** `QualityEventForm` renders in edit mode for a user with `{ reporteInicial: true, severidad: true, mineral: true }`
- **THEN** an editable `severidad` select renders alongside the RN-QE-010 field set

---

### Requirement: QualityEventForm edit mode appends diffed audit trail entries
On a successful edit submission, the system SHALL append one `QEAuditTrailEntry` with `accion: 'QE_REPORTE_INICIAL_EDITADO'` per changed field, each carrying `campoModificado`, `valorAnterior`, and `valorNuevo`. Fields the user did not change SHALL NOT produce an audit entry.

#### Scenario: Only changed fields produce audit entries
- **WHEN** a user edits only `areaAfectada` (leaving `descripcion`, `turno`, `fechaHoraEvento`, and `mineralInvolucrado` unchanged) and submits
- **THEN** exactly one `QEAuditTrailEntry` with `accion: 'QE_REPORTE_INICIAL_EDITADO'` and `campoModificado: 'areaAfectada'` is appended

#### Scenario: Multiple changed fields produce one entry each
- **WHEN** a user edits both `descripcion` and `turno` and submits
- **THEN** two `QEAuditTrailEntry` records with `accion: 'QE_REPORTE_INICIAL_EDITADO'` are appended, one per field
