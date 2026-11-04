## MODIFIED Requirements

### Requirement: QEHeaderSection displays all header fields
The system SHALL render a `QEHeaderSection` component at `src/features/quality-events/components/QEHeaderSection.tsx` that receives the loaded `QualityEvent` as a prop and displays, in read-only form:
- A top row with `numero` (bold, large text), `QEStatusBadge`, `QETypeBadge`, `QEOriginBadge`, and `SeverityBadge`.
- A metadata grid with `areaAfectada`, `mineralInvolucrado` (only when present), `turno`, `fechaHoraEvento`, `fechaHoraReporte` (both formatted via `Intl.DateTimeFormat`), the reporting user's display name, and a "Reincidencia ×N" badge when `ciclo > 1` (N = `ciclo`).
- When `qe.fechaCierre` is set: `fechaCierre`, `resultadoCierre`, `plazoVerificacionDias`, and a countdown to `fechaVerificacionProgramada` (days remaining, formatted via a `DeadlineBadge`-style indicator, or "Vencido" when the deadline has passed and `fechaVerificacionRealizada` is absent).

The reporting user's display name SHALL be resolved from `qe.reportadoPorId` via the `useUserNames` hook (`user-names-lookup`, calling the real `GET /api/users/nombres` endpoint) — not via `resolveUserDisplayName` from `src/mocks/fixtures/userIdentity.fixtures.ts`. It SHALL resolve correctly for any real user known to the backend, including a deactivated one, and SHALL show the generic "Usuario no disponible" text (never the raw id) if the backend does not resolve it.

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

#### Scenario: Closure fields hidden before CERRADO
- **WHEN** the `QualityEvent` has `fechaCierre` undefined
- **THEN** no closure fields or verification countdown are rendered

#### Scenario: Header shows verification countdown
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `fechaCierre` set and `fechaVerificacionProgramada` 10 days in the future
- **THEN** a countdown reading approximately "10 días" is visible in the header

#### Scenario: Header shows Vencido when the deadline has passed
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `fechaVerificacionProgramada` in the past and `fechaVerificacionRealizada` absent
- **THEN** the countdown displays "Vencido" instead of a day count

#### Scenario: Reportado por resolves a real user name from the backend
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `reportadoPorId` set to a real user id and `GET /api/users/nombres` resolves it
- **THEN** the metadata grid shows the resolved display name, not a blank value and not the raw id

#### Scenario: Reportado por shows the generic fallback when unresolved
- **WHEN** `qe.reportadoPorId` does not resolve via `GET /api/users/nombres`
- **THEN** the metadata grid shows the generic "Usuario no disponible" text, not the raw id

### Requirement: QEHeaderSection gates the export action by puedeExportarPDF
`QEHeaderSection`'s top row (the `flex flex-wrap items-center gap-2.5` row holding `numero` and the status/type/origin/severity badges) SHALL additionally render the "Exportar PDF" button described in `quality-event-pdf-export`, positioned after the badges, but only when `puedeExportarPDF(rol)` evaluates to `true` for the current authenticated user. This requirement defines placement and visibility gating; the click behavior and PDF generation are defined in `quality-event-pdf-export`.

On click, `QEHeaderSection` SHALL resolve `reportadoPorNombre` (and, when `qe.causaRaizAprobadaPorId` is set, `causaRaizAprobadaPorNombre`) via its own `useUserNames` call and pass them as part of the `QEExportMeta` argument to `buildQualityEventPdf` (`quality-event-pdf-export`), which no longer resolves user names internally.

#### Scenario: Export button appears after the badge row for an authorized role
- **WHEN** a `SUPERVISOR` user renders `QEHeaderSection` for a loaded QE
- **THEN** the "Exportar PDF" button renders within the same header row as `numero` and the badges, after them

#### Scenario: Export button is absent for a role without puedeExportarPDF
- **WHEN** a user with role `JEFE_CONTROL_DOCUMENTARIO` renders `QEHeaderSection`
- **THEN** no "Exportar PDF" button is rendered anywhere in the header

#### Scenario: Export passes resolved names to buildQualityEventPdf
- **WHEN** a user with `puedeExportarPDF` clicks "Exportar PDF" for a QE with both `reportadoPorId` and `causaRaizAprobadaPorId` set
- **THEN** `buildQualityEventPdf` is called with a `meta` object whose `reportadoPorNombre` and `causaRaizAprobadaPorNombre` are the names already resolved by `QEHeaderSection`'s `useUserNames` call, not re-resolved inside `buildQualityEventPdf`
