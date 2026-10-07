## ADDED Requirements

### Requirement: fechaDeteccion column shows the calendar date without timezone shift
The `fechaDeteccion` column in `NCList` SHALL render using the calendar-date helper (`shared-calendar-date-format`), reading the day/month/year directly from the ISO string rather than constructing a `Date` in the viewer's browser timezone. `fechaDeteccion` is a calendar date (captured via `<input type="date">`, no meaningful time-of-day), so it SHALL never show a day-off-by-one in negative-offset timezones (e.g. UTC-5).

#### Scenario: fechaDeteccion does not shift in UTC-5
- **WHEN** the browser timezone is `UTC-5` and a non-conformity's `fechaDeteccion` is `"2026-09-29T00:00:00Z"`
- **THEN** the column shows September 29, not September 28
