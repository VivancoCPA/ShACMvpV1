## ADDED Requirements

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

### Requirement: O1 conditional section — incidenteId select loaded from /api/incidents
The system SHALL render an `incidenteId` `<select>` when `origen === 'O1_INCIDENTE_CAMPO'`. The select SHALL be populated by a `useQuery` call to `GET /api/incidents` (enabled only when origin is O1). Each option SHALL show `incident.numero + ' — ' + incident.descripcion.slice(0, 60) + '... (' + incident.area + ')'`. When the query returns an empty array, an inline message from `t('qualityEvents:form.noIncidents')` SHALL appear instead of the select. A validation error from Zod (`incidenteId` required) SHALL display below the field when origin is O1 and the field is empty on submit.

#### Scenario: O1 section renders only when origen is O1_INCIDENTE_CAMPO
- **WHEN** the user selects `O1_INCIDENTE_CAMPO` in the origen select
- **THEN** the `incidenteId` select becomes visible and no other origin-specific fields are visible

#### Scenario: O1 section is hidden when origen is not O1
- **WHEN** the user selects `O2_NC_DETECTADA` in the origen select
- **THEN** the `incidenteId` select is not rendered

#### Scenario: O1 select options include numero, truncated descripcion, and area
- **WHEN** the `GET /api/incidents` query resolves with fixture data
- **THEN** each `<option>` text contains the incident `numero`, a truncated `descripcion`, and `area`

#### Scenario: O1 empty state shows inline message when no incidents returned
- **WHEN** `GET /api/incidents` returns an empty array and origin is O1
- **THEN** `t('qualityEvents:form.noIncidents')` is rendered instead of the select element

#### Scenario: O1 submit without incidenteId shows validation error
- **WHEN** origin is O1, `incidenteId` is empty, and the user submits the form
- **THEN** a Zod validation error appears below the `incidenteId` field

---

### Requirement: O2 conditional section — ncId select loaded from /api/nonconformities
The system SHALL render an `ncId` `<select>` when `origen === 'O2_NC_DETECTADA'`. The select SHALL be populated by a `useQuery` call to `GET /api/nonconformities` (enabled only when origin is O2). Each option SHALL show `nc.numero + ' — ' + nc.titulo.slice(0, 60) + '... (' + nc.areaAfectada + ')'`. When the query returns an empty array, an inline message from `t('qualityEvents:form.noNonconformities')` SHALL appear. A validation error SHALL appear below the field when ncId is empty on submit with origin O2.

#### Scenario: O2 section renders only when origen is O2_NC_DETECTADA
- **WHEN** the user selects `O2_NC_DETECTADA` in the origen select
- **THEN** the `ncId` select becomes visible and no other origin-specific fields are visible

#### Scenario: O2 section is hidden when origen is not O2
- **WHEN** the user selects `O3_HALLAZGO_AUDITORIA` in the origen select
- **THEN** the `ncId` select is not rendered

#### Scenario: O2 empty state shows inline message when no NCs returned
- **WHEN** `GET /api/nonconformities` returns an empty array and origin is O2
- **THEN** `t('qualityEvents:form.noNonconformities')` is rendered instead of the select element

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
