## ADDED Requirements

### Requirement: QualityEventDetail page composition
The system SHALL render a `QualityEventDetail` page component at `src/features/quality-events/pages/QualityEventDetail.tsx`, mounted at the route `:id` under the `quality-events` router segment. It SHALL read `id` via `useParams<{ id: string }>()` and load the Quality Event with `useQualityEvent(id)`. When loaded, it SHALL render four stacked sections in this order, with no tabs: `QEHeaderSection`, `QEInvestigationSection`, `QEACSection`, `QEAuditTrail`.

#### Scenario: Sections render in order for a loaded QE
- **WHEN** `useQualityEvent(id)` resolves with a valid `QualityEvent`
- **THEN** `QEHeaderSection`, `QEInvestigationSection`, `QEACSection`, and `QEAuditTrail` are rendered in that order, stacked vertically, with no tab navigation between them

#### Scenario: All authenticated roles can view the page
- **WHEN** a user with any authenticated role (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) opens `/quality-events/:id`
- **THEN** the page renders without a role redirect; per-section edit affordances are individually gated by role inside each section

---

### Requirement: QualityEventDetail provides a back-to-list button
`QualityEventDetail` SHALL render a "← Volver a la lista" button at the top of the page, above `QEHeaderSection`, styled and positioned consistently with the equivalent back button in `NonconformityDetailPage` (M2) and `IncidentDetail` (M3). Clicking it SHALL call `useNavigate()` to navigate to `/quality-events`.

#### Scenario: Back button navigates to the QE list
- **WHEN** the user clicks "← Volver a la lista" on `QualityEventDetail`
- **THEN** `useNavigate()` is called to navigate to `/quality-events`

#### Scenario: Back button renders above QEHeaderSection
- **WHEN** `QualityEventDetail` renders for a loaded QE
- **THEN** the "← Volver a la lista" button appears before `QEHeaderSection` in the page layout

---

### Requirement: QualityEventDetail loading and 404 states
While `useQualityEvent(id)` is loading, the system SHALL render a per-section skeleton placeholder instead of the four sections. When the query resolves with a 404 (Quality Event not found), the system SHALL render an illustrated "not found" message with a button that navigates back to `/quality-events`.

#### Scenario: Skeleton shown while loading
- **WHEN** `useQualityEvent(id)` is in its loading state
- **THEN** a skeleton placeholder is rendered in place of the four sections

#### Scenario: 404 shows message and back button
- **WHEN** `useQualityEvent(id)` resolves with a 404 error (Quality Event not found for the given id)
- **THEN** an illustrated message is shown along with a "Volver al listado" button that navigates to `/quality-events`

#### Scenario: Navigating to an unknown QE id shows 404 state
- **WHEN** a user navigates to `/quality-events/id-inexistente`
- **THEN** the 404 state described above is rendered instead of the four sections

---

### Requirement: QEHeaderSection displays all header fields
The system SHALL render a `QEHeaderSection` component at `src/features/quality-events/components/QEHeaderSection.tsx` that receives the loaded `QualityEvent` as a prop and displays, in read-only form:
- A top row with `numero` (bold, large text), `QEStatusBadge`, `QETypeBadge`, `QEOriginBadge`, and `SeverityBadge`.
- A metadata grid with `areaAfectada`, `mineralInvolucrado` (only when present), `turno`, `fechaHoraEvento`, `fechaHoraReporte` (both formatted via `Intl.DateTimeFormat`), the reporting user's display name, and a "Reincidencia ×N" badge when `ciclo > 1` (N = `ciclo`).

#### Scenario: Header shows all badges and metadata
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `numero: 'QE-2026-005'`
- **THEN** the number, status badge, type badge, origin badge, and severity badge are all visible, followed by the metadata grid

#### Scenario: mineralInvolucrado hidden when absent
- **WHEN** the `QualityEvent` has `mineralInvolucrado` undefined
- **THEN** no mineral field is rendered in the metadata grid

#### Scenario: Reincidencia badge shown when ciclo > 1
- **WHEN** the `QualityEvent` has `ciclo === 3`
- **THEN** a badge reading "Reincidencia ×3" is visible in the header

#### Scenario: Reincidencia badge hidden on first cycle
- **WHEN** the `QualityEvent` has `ciclo === 1`
- **THEN** no reincidencia badge is rendered

---

### Requirement: QEHeaderSection origin-conditional block
`QEHeaderSection` SHALL render an origin-specific block based on `origen`:
- `O1_INCIDENTE_CAMPO`: a "Ver Incidente" link navigating to `/incidents/{incidenteId}`.
- `O2_NC_DETECTADA`: a "Ver No Conformidad" link navigating to `/nonconformities/{ncId}`.
- `O3_HALLAZGO_AUDITORIA`: a label and value pair showing `hallazgoAuditoriaRef`.
- `O4_REPORTE_EXTERNO`: `nombreCliente` and `fechaRecepcion` (from `reporteExternoRef`) rendered as labeled fields.

#### Scenario: O1 origin shows Ver Incidente link
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `origen: 'O1_INCIDENTE_CAMPO'` and `incidenteId: 'inc-002'`
- **THEN** a "Ver Incidente" link is visible pointing to `/incidents/inc-002`

#### Scenario: O2 origin shows Ver No Conformidad link
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `origen: 'O2_NC_DETECTADA'` and `ncId: 'nc-002'`
- **THEN** a "Ver No Conformidad" link is visible pointing to `/nonconformities/nc-002`

#### Scenario: O3 origin shows hallazgo reference
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `origen: 'O3_HALLAZGO_AUDITORIA'` and `hallazgoAuditoriaRef: 'AUD-2026-004'`
- **THEN** a labeled field showing `AUD-2026-004` is visible, and no navigation link is rendered

#### Scenario: O4 origin shows cliente and fecha de recepción
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `origen: 'O4_REPORTE_EXTERNO'` and `reporteExternoRef: { nombreCliente: 'Minera XYZ', fechaRecepcion: '2026-05-01' }`
- **THEN** labeled fields for "Minera XYZ" and the formatted `fechaRecepcion` are visible

---

### Requirement: QEHeaderSection CRITICA severity banner
`QEHeaderSection` SHALL render a visible alert banner in the header when `severidad === 'CRITICA'`.

#### Scenario: Banner shown for CRITICA severity
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `severidad: 'CRITICA'`
- **THEN** an alert banner is visible in the header area

#### Scenario: Banner hidden for non-CRITICA severity
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `severidad: 'ALTA'`
- **THEN** no alert banner is rendered

---

### Requirement: QEStatusTransitionPanel renders role-filtered valid transitions
The system SHALL render a `QEStatusTransitionPanel` component at `src/features/quality-events/components/QEStatusTransitionPanel.tsx` that computes valid target states via `getValidQETransitions(qe.estado)`, computes the current user's `QEPermissions` via `getQualityEventPermissions(qe.estado, rol, esResponsable)`, and renders one button per valid transition the current role is permitted to trigger (`puedeAvanzarEstado`, `puedeCerrar`, `puedeVerificar`, or `puedeReabrir`, matched to the target state).

#### Scenario: No buttons rendered for a role with no permission
- **WHEN** `QEStatusTransitionPanel` renders for a `QualityEvent` in `ABIERTO` with role `AUDITOR_INTERNO`
- **THEN** no transition buttons are rendered

#### Scenario: JEFE_CALIDAD_SYST sees the ANALISIS_COMPLETADO transition from EN_INVESTIGACION
- **WHEN** `QEStatusTransitionPanel` renders for a `QualityEvent` in `EN_INVESTIGACION` with role `JEFE_CALIDAD_SYST`
- **THEN** a button targeting `ANALISIS_COMPLETADO` is visible

---

### Requirement: QEStatusTransitionPanel enforces RN-QE-002 and RN-QE-003 guards
When the transition target is `EN_EJECUCION` and `qe.causaRaizFirmadaEn` is empty, the button SHALL be rendered disabled with a tooltip reading "Debe aprobar la causa raíz antes de iniciar ejecución" (RN-QE-002). When the transition target is `CERRADO` and any entry in `qe.accionesCorrectivas` has `estado !== 'CERRADA'`, the button SHALL be rendered disabled with a tooltip reading "Hay acciones correctivas pendientes de cierre" (RN-QE-003).

#### Scenario: EN_EJECUCION button disabled without firmed causa raíz
- **WHEN** the transition target is `EN_EJECUCION` and `qe.causaRaizFirmadaEn` is undefined
- **THEN** the button is disabled and shows the RN-QE-002 tooltip on hover/focus

#### Scenario: EN_EJECUCION button enabled with firmed causa raíz
- **WHEN** the transition target is `EN_EJECUCION` and `qe.causaRaizFirmadaEn` is a non-empty ISO string
- **THEN** the button is enabled

#### Scenario: CERRADO button disabled with open ACs
- **WHEN** the transition target is `CERRADO` and `qe.accionesCorrectivas` contains at least one AC with `estado !== 'CERRADA'`
- **THEN** the button is disabled and shows the RN-QE-003 tooltip on hover/focus

#### Scenario: CERRADO button visible but disabled pending M4-S06
- **WHEN** the transition target is `CERRADO` regardless of AC state
- **THEN** the button is rendered with `disabled` and the label "Disponible en cierre", since the cierre flow is implemented in M4-S06

---

### Requirement: QEStatusTransitionPanel calls the transition mutation and shows a toast
Clicking an enabled transition button SHALL call `useTransitionQEStatus().mutate({ id: qe.id, data: { nuevoEstado: targetState } })`. On success, a Sonner `toast.success` SHALL display the new state.

#### Scenario: Enabled button triggers the mutation
- **WHEN** the user clicks an enabled transition button targeting `ANALISIS_COMPLETADO`
- **THEN** `useTransitionQEStatus().mutate` is called with `{ id: qe.id, data: { nuevoEstado: 'ANALISIS_COMPLETADO' } }`

#### Scenario: Success shows a toast with the new state
- **WHEN** the transition mutation resolves successfully
- **THEN** a Sonner success toast naming the new state is shown

---

### Requirement: QEStatusTransitionPanel guards RN-QE-009 for pending AC requests
The transition from `EN_INVESTIGACION` to `ANALISIS_COMPLETADO` SHALL be rendered disabled while `qe.solicitudesAC > 0`, with a tooltip reading "Hay N solicitudes de AC pendientes de crear en este QE" (N = `qe.solicitudesAC`).

#### Scenario: ANALISIS_COMPLETADO button disabled with pending AC requests
- **WHEN** the transition target is `ANALISIS_COMPLETADO`, `qe.estado === 'EN_INVESTIGACION'`, and `qe.solicitudesAC === 2`
- **THEN** the button is disabled and shows the tooltip "Hay 2 solicitudes de AC pendientes de crear en este QE"

#### Scenario: ANALISIS_COMPLETADO button enabled once solicitudesAC reaches 0
- **WHEN** the transition target is `ANALISIS_COMPLETADO`, `qe.estado === 'EN_INVESTIGACION'`, and `qe.solicitudesAC === 0`
- **THEN** the button is not disabled by the RN-QE-009 guard
