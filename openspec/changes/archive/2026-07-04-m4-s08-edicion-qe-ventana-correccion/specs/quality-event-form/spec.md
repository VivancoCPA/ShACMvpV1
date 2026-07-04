## ADDED Requirements

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
