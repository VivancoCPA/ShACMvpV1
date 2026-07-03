## ADDED Requirements

### Requirement: GET /api/quality-events/:id/audit-trail endpoint
The system SHALL register a `GET /api/quality-events/:id/audit-trail` handler in `src/mocks/handlers/quality-events.handlers.ts` that returns the matching QE's `auditTrail` array (`QEAuditTrailEntry[]`) sorted by `timestamp` descending (most recent first). An unknown `:id` SHALL return 404 with `success: false`.

#### Scenario: Known id returns audit trail sorted descending
- **WHEN** `GET /api/quality-events/qe-2026-005/audit-trail` is requested for a QE with 4 audit entries
- **THEN** the response is 200 with `data` being an array of 4 entries ordered from most recent `timestamp` to oldest

#### Scenario: Unknown id returns 404
- **WHEN** `GET /api/quality-events/does-not-exist/audit-trail` is requested
- **THEN** the response status is 404 and `success: false`

---

### Requirement: QEAuditTrail renders the timeline in reverse chronological order
The system SHALL render a `QEAuditTrail` component at `src/features/quality-events/components/QEAuditTrail.tsx` that fetches `GET /api/quality-events/:id/audit-trail` and renders one entry per item, most recent first. Each entry SHALL show: an icon (from `lucide-react`) chosen by `accion` type, `realizadoPorNombre`, a human-readable description of the action, and the `timestamp` formatted as `dd/mm/yyyy HH:mm` via `Intl.DateTimeFormat`.

#### Scenario: Entries render most recent first
- **WHEN** `QEAuditTrail` receives entries with timestamps `2026-05-01`, `2026-05-03`, `2026-05-02`
- **THEN** they render in the order `2026-05-03`, `2026-05-02`, `2026-05-01`

#### Scenario: Entry shows formatted timestamp
- **WHEN** an entry has `timestamp: '2026-05-03T14:30:00Z'`
- **THEN** the rendered timestamp matches the `dd/mm/yyyy HH:mm` pattern

---

### Requirement: QEAuditTrail shows a Generado por IA badge
Each timeline entry with `generadoPorIA: true` SHALL display a "Generado por IA" badge; entries with `generadoPorIA: false` SHALL NOT display it.

#### Scenario: IA badge shown for AI-generated entries
- **WHEN** an audit entry has `generadoPorIA: true`
- **THEN** a "Generado por IA" badge is visible on that entry

#### Scenario: IA badge hidden for manual entries
- **WHEN** an audit entry has `generadoPorIA: false`
- **THEN** no "Generado por IA" badge is rendered on that entry

---

### Requirement: Fixture QEs carry at least 4 audit trail entries
The system SHALL ensure every fixture in `qualityEventFixtures` has at least 4 entries in `auditTrail`, covering at minimum: creation, a state change, a field edit, and causa raíz approval (for QEs that have progressed past `EN_INVESTIGACION`).

#### Scenario: Fixture QE has at least 4 audit entries
- **WHEN** any fixture QE's `auditTrail` is inspected
- **THEN** `auditTrail.length >= 4`
