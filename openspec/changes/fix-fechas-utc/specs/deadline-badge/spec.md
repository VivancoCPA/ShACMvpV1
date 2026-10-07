## MODIFIED Requirements

### Requirement: DeadlineBadge renders a colored deadline indicator based on days remaining
The system SHALL export a `DeadlineBadge` component from `src/components/shared/DeadlineBadge.tsx` that accepts `fechaCierre: string | null` and `estado: string`. When `fechaCierre` is `null` or `estado` is `'CERRADA'` or `'ANULADA'`, the component SHALL render the date text (or a dash if null) without any colored badge. When `fechaCierre` is a valid ISO date string and the entity is not in a closed/annulled state, the component SHALL calculate the number of calendar days remaining until `fechaCierre` relative to today and render a pill badge with a color determined by the semaphore rules: green (`bg-success/15 text-success`) for more than 14 days remaining, amber (`bg-amber/15 text-amber`) for 0–14 days remaining, and red (`bg-error/15 text-error`) for past-due dates (days remaining < 0). `fechaCierre` is a calendar date (no meaningful time-of-day, persisted as midnight UTC of the chosen day — see `shared-calendar-date-format`): both the formatted date text and the days-remaining calculation SHALL use the calendar-date helpers, reading the day/month/year directly from the ISO string rather than constructing a `Date` in the viewer's browser timezone, so the badge never shows a day-off-by-one in negative-offset timezones (e.g. UTC-5). The date SHALL be formatted using `Intl.DateTimeFormat` with `{ day: '2-digit', month: 'short', year: 'numeric' }` applied to that calendar-date reading.

#### Scenario: Renders green badge when more than 14 days remain
- **WHEN** `fechaCierre` is a date 20 days from today and `estado` is `'ABIERTA'`
- **THEN** the component renders a pill with `bg-success/15 text-success` classes and the formatted date

#### Scenario: Renders amber badge when 0–14 days remain
- **WHEN** `fechaCierre` is a date 7 days from today and `estado` is `'EN_INVESTIGACION'`
- **THEN** the component renders a pill with `bg-amber/15 text-amber` classes and the formatted date

#### Scenario: Renders red badge when date is past due
- **WHEN** `fechaCierre` is a date 3 days in the past and `estado` is `'EN_EJECUCION'`
- **THEN** the component renders a pill with `bg-error/15 text-error` classes and the formatted date

#### Scenario: Renders plain date without badge when estado is CERRADA
- **WHEN** `estado` is `'CERRADA'` and `fechaCierre` is a valid date
- **THEN** the component renders the formatted date as plain text without any colored badge classes

#### Scenario: Renders plain date without badge when estado is ANULADA
- **WHEN** `estado` is `'ANULADA'` and `fechaCierre` is a valid date
- **THEN** the component renders the formatted date as plain text without any colored badge classes

#### Scenario: Renders dash when fechaCierre is null
- **WHEN** `fechaCierre` is `null`
- **THEN** the component renders a dash character (`—`) without a badge, regardless of estado

#### Scenario: DeadlineBadge supports dark mode
- **WHEN** the page is rendered in dark mode
- **THEN** the badge uses Tailwind `dark:` variant classes so colors remain accessible against dark backgrounds

#### Scenario: No day-off-by-one in a negative UTC offset timezone
- **WHEN** the browser timezone is `UTC-5`, "today" there is `2026-09-29`, and `fechaCierre` is `"2026-10-01T00:00:00Z"`
- **THEN** the component computes 2 days remaining (not 1) and renders the date as October 1, not September 30
