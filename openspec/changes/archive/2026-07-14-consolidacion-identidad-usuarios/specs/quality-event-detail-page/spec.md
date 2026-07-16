## MODIFIED Requirements

### Requirement: QEHeaderSection displays all header fields
The system SHALL render a `QEHeaderSection` component at `src/features/quality-events/components/QEHeaderSection.tsx` that receives the loaded `QualityEvent` as a prop and displays, in read-only form:
- A top row with `numero` (bold, large text), `QEStatusBadge`, `QETypeBadge`, `QEOriginBadge`, and `SeverityBadge`.
- A metadata grid with `areaAfectada`, `mineralInvolucrado` (only when present), `turno`, `fechaHoraEvento`, `fechaHoraReporte` (both formatted via `Intl.DateTimeFormat`), the reporting user's display name, and a "Reincidencia ×N" badge when `ciclo > 1` (N = `ciclo`).
- When `qe.fechaCierre` is set: `fechaCierre`, `resultadoCierre`, `plazoVerificacionDias`, and a countdown to `fechaVerificacionProgramada` (days remaining, formatted via a `DeadlineBadge`-style indicator, or "Vencido" when the deadline has passed and `fechaVerificacionRealizada` is absent).

The reporting user's display name SHALL be resolved from `qe.reportadoPorId` via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`), and SHALL resolve correctly for any real, non-legacy `authFixtures` account, not only ids that happened to also exist in the removed `src/mocks/fixtures/users.fixtures.ts` catalog.

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

#### Scenario: Reportado por resolves for a real, non-legacy account
- **WHEN** `QEHeaderSection` renders a `QualityEvent` with `reportadoPorId: 'user-supervisor-002'`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the metadata grid shows the resolved display name, not a blank value and not the raw id
