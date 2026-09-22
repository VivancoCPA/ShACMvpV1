## MODIFIED Requirements

### Requirement: Aprobar causa raíz requires PIN confirmation
`QEInvestigationSection` SHALL render an "Aprobar causa raíz" button visible only to `JEFE_CALIDAD_SYST` when `causaRaizDefinitiva` is non-empty and `causaRaizFirmadaEn` is empty. Clicking it SHALL open a modal prompting for a PIN that validates only the PIN's format client-side (exactly 4 numeric digits, `/^\d{4}$/`) — malformed input shows an inline error and does not submit. The system SHALL NOT compare the entered PIN against any hardcoded or mock value. On a well-formed PIN, the system SHALL call `useUpdateQualityEvent().mutate({ id: qe.id, data: { causaRaizDefinitiva, causaRaizFirmadaEn: <ISO timestamp>, causaRaizAprobadaPorId: <current user id> } })`.

This confirmation SHALL NOT be treated as a backend-verified signature unless a dedicated signing endpoint for causa raíz approval is confirmed to exist on the real backend (see `design.md` Decision D3) — as of this change, `causaRaizAprobadaPorId`/`causaRaizFirmadaEn` are set client-side and persisted through the same role- and JWT-protected `PATCH /api/quality-events/:id` used for other QE field edits, with the PIN serving as a UX confirmation step rather than a value verified by the backend.

#### Scenario: Button hidden when causaRaizDefinitiva is empty
- **WHEN** `causaRaizDefinitiva` is an empty string
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: Button hidden when already firmed
- **WHEN** `causaRaizFirmadaEn` is already set
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: Malformed PIN blocks submission client-side
- **WHEN** the user enters a value that is not exactly 4 numeric digits (e.g. `12`, `12a4`, empty) and confirms
- **THEN** an inline format error is shown and `useUpdateQualityEvent().mutate` is not called

#### Scenario: Any well-formed PIN confirms and stamps approval
- **WHEN** the user enters a 4-digit PIN (e.g. `9081`) and confirms
- **THEN** `useUpdateQualityEvent().mutate` is called with `causaRaizFirmadaEn` set to a current ISO 8601 timestamp and `causaRaizAprobadaPorId` set to the current user's id, regardless of the specific digits entered
