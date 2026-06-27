# Spec: nc-detail-page

## Purpose

Full NC detail view at `/nonconformities/:id`. Composes a readonly header, contextual action buttons, the `ACSection`, and a collapsible audit trail. Handles loading skeleton, 404 error, and network error states.

---

## Requirements

### Requirement: NonconformityDetailPage renders NC header in readonly mode
The system SHALL render a `NonconformityDetailPage` component at `/nonconformities/:id` that displays a readonly header with: `numero`, `dominio` (human-readable label), `severidad` badge via `SeverityBadge`, `estado` badge via `NCStatusBadge`, `titulo`, `descripcion`, `areaAfectada`, `procesoInvolucrado`, `fechaDeteccion` (formatted dd/mm/yyyy), `detectadoPor`, and — when `estado === 'ANULADA'` — the `justificacionAnulacion` in a visually distinct alert block. The header SHALL be wrapped in a `PageWrapper` with breadcrumb `"No Conformidades > <numero>"`.

#### Scenario: Detail page renders NC header with numero and estado badge
- **WHEN** a user navigates to `/nonconformities/nc-001` and the hook resolves successfully
- **THEN** the page shows the NC `numero`, a `NCStatusBadge` for `estado`, and a `SeverityBadge` for `severidad`

#### Scenario: Detail page shows justificacion when NC is ANULADA
- **WHEN** the fetched NC has `estado === 'ANULADA'` and a non-empty `justificacionAnulacion`
- **THEN** an alert block with `justificacionAnulacion` text is visible below the estado badge

#### Scenario: Breadcrumb shows NC numero
- **WHEN** `NonconformityDetailPage` renders with a resolved NC
- **THEN** the breadcrumb displays `"No Conformidades > NC-2025-001"` (using the actual numero)

---

### Requirement: NonconformityDetailPage shows skeleton during loading
The system SHALL render a skeleton placeholder (at minimum three skeleton rows covering the header area) while `useNonconformity` is in `isLoading` state. The skeleton SHALL use the project's design system color tokens for shimmer effect.

#### Scenario: Skeleton appears before data resolves
- **WHEN** `useNonconformity` returns `isLoading: true`
- **THEN** at least three skeleton rows are visible and no NC data is rendered

---

### Requirement: NonconformityDetailPage shows error state with retry button
The system SHALL render an error state with a "Reintentar" button when `useNonconformity` returns `isError: true`. Clicking "Reintentar" SHALL call `refetch()` from the query result.

#### Scenario: Error state renders with retry button
- **WHEN** `useNonconformity` returns `isError: true`
- **THEN** an error message and a "Reintentar" button are visible

#### Scenario: Retry button calls refetch
- **WHEN** the user clicks "Reintentar"
- **THEN** `refetch()` is called on the nonconformity query

---

### Requirement: NonconformityDetailPage renders contextual action buttons via getNCPermissions
The system SHALL compute `NCPermissions` by calling `getNCPermissions(nc, userRole)` from `authStore` and render only the action buttons the current user is permitted to take. Visible action buttons: "Iniciar Investigación" (when `canIniciarInvestigacion`), "Registrar Corrección" (when `canRegistrarCorreccion`), "Solicitar Cierre" (when `canSolicitarCierre`), "Cerrar NC" (when `canCerrar`), "Reabrir" (when `canReabrir`), "Anular NC" (when `canAnular`). Each button SHALL be absent from the DOM when the corresponding flag is `false` — not just disabled.

#### Scenario: JEFE_CALIDAD_SYST sees Anular NC button on DETECTADA NC
- **WHEN** a user with role `JEFE_CALIDAD_SYST` renders the detail of a NC in `DETECTADA` state
- **THEN** the "Anular NC" button is visible

#### Scenario: OPERARIO sees no action buttons
- **WHEN** a user with role `OPERARIO` renders the detail of a NC in any state
- **THEN** no action buttons appear in the button group area

#### Scenario: Action buttons reflect permissions for current NC state
- **WHEN** a user with role `SUPERVISOR` renders the detail of a NC in `EN_CORRECCION` state
- **THEN** "Solicitar Cierre" is visible but "Iniciar Investigación" is not

---

### Requirement: NonconformityDetailPage renders AnularNCModal when Anular NC is clicked
The system SHALL render `AnularNCModal` as a portal overlay when the "Anular NC" button is clicked. The modal SHALL close (without submitting) when the user clicks "Cancelar" or outside the modal. On successful annulment, the page SHALL navigate to `/nonconformities`.

#### Scenario: Clicking Anular NC opens the modal
- **WHEN** a user clicks the "Anular NC" button
- **THEN** `AnularNCModal` is visible with a justificacion textarea

#### Scenario: Successful annulment navigates to list
- **WHEN** `useAnularNonconformity` resolves successfully
- **THEN** the browser navigates to `/nonconformities`

---

### Requirement: NonconformityDetailPage renders ACSection below the NC header
The system SHALL render `ACSection` below the NC header, passing the `nc.accionesCorrectivas` array and `ncId` as props. The section title SHALL use `t('nonconformities:acSection.title')`.

#### Scenario: ACSection is present in the rendered output
- **WHEN** `NonconformityDetailPage` renders a resolved NC
- **THEN** `ACSection` is rendered below the NC header with the NC's ACs

---

### Requirement: NonconformityDetailPage renders collapsible audit trail section
The system SHALL render a collapsible section titled `t('nonconformities:auditTrail.title')` below `ACSection`. The section SHALL be collapsed by default and only visible when `getNCPermissions(nc, userRole).canVerAuditTrail === true`. When expanded, it shows `nc.auditTrail` entries sorted in descending chronological order (newest first), each showing: `realizadoPorNombre`, `timestamp` formatted as `dd/mm/yyyy HH:mm`, and `accion`.

#### Scenario: Audit trail section hidden for OPERARIO
- **WHEN** a user with role `OPERARIO` renders `NonconformityDetailPage`
- **THEN** the audit trail section is not rendered

#### Scenario: Audit trail section visible and collapsed by default for SUPERVISOR
- **WHEN** a user with role `SUPERVISOR` renders `NonconformityDetailPage` with resolved NC data
- **THEN** the audit trail section is present but collapsed

#### Scenario: Audit trail entries ordered newest first when expanded
- **WHEN** a user with `canVerAuditTrail=true` expands the audit trail section
- **THEN** the most recent `auditTrail` entry appears first in the list
