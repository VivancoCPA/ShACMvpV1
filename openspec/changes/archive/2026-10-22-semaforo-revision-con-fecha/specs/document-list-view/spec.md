## MODIFIED Requirements

### Requirement: RevisionSemaforo displays a 4-tier color indicator with the date always visible
The system SHALL export a `RevisionSemaforo` component from `src/features/documents/components/RevisionSemaforo.tsx` that accepts `fechaRevisionProxima: string | null | undefined`. The component SHALL compute `diasRestantes` using `calendarDaysUntil` from `utils/date.utils.ts` (a calendar-day difference that never shifts a day in negative-offset timezones, unlike `differenceInCalendarDays(parseISO(...), new Date())`). The color tiers SHALL be: green (> `DOC_REVISION_ALERT_DAYS` days), amber (8 days up to the threshold), red with badge `t('documents:semaforo.proximo')` (1–7 days), red `animate-pulse` with badge `t('documents:semaforo.vencido')` (≤ 0 days). When `fechaRevisionProxima` is `null` or `undefined`, the component SHALL render a dash `—`.

The formatted date (`formatCalendarDate` from `utils/date.utils.ts` — never `new Date(...)` formatted in the browser's local timezone, and never `formatShortDate`) SHALL always be visible next to the indicator, in all four tiers, without requiring hover. In the amber and red (próximo/vencido) tiers, a relative-days text SHALL also be visible without hover: `t('documents:semaforo.enDias', { count })` for a future date (amber/próximo), `t('documents:semaforo.haceDias', { count })` for an overdue date (vencido), or `t('documents:semaforo.hoy')` when `diasRestantes === 0`. Both relative-days keys SHALL use i18next `_one`/`_other` pluralization. The green tier only needs the date. Color SHALL NOT be the only carrier of information — the visible text conveys the same information a sighted user would get from color alone. A tooltip MAY still be present but, if so, SHALL be redundant with the visible text, never the only way to see the days-remaining count.

#### Scenario: Date more than DOC_REVISION_ALERT_DAYS days away shows green indicator with the date
- **WHEN** `fechaRevisionProxima` is 45 days from today (calendar days) and `DOC_REVISION_ALERT_DAYS` is 30
- **THEN** a green dot is rendered together with the formatted date, no badge

#### Scenario: Date 8 days up to the threshold shows amber indicator with date and relative text
- **WHEN** `fechaRevisionProxima` is 15 days from today
- **THEN** an amber dot is rendered together with the formatted date and the visible text for "en 15 días" (or its pluralized/localized equivalent), without needing to hover

#### Scenario: Date 1–7 days away shows red indicator with proximo badge, date and relative text
- **WHEN** `fechaRevisionProxima` is 3 days from today
- **THEN** a red dot, the `t('documents:semaforo.proximo')` badge, the formatted date, and "en 3 días" are all visible without hover

#### Scenario: Date exactly today shows "hoy" instead of a day count
- **WHEN** `diasRestantes` is `0`
- **THEN** the visible relative text reads `t('documents:semaforo.hoy')`, not "en 0 días" nor "hace 0 días"

#### Scenario: Overdue date shows pulsing red indicator with vencido badge, date and relative text in the past
- **WHEN** `fechaRevisionProxima` is 10 days before today
- **THEN** a red `animate-pulse` dot, the `t('documents:semaforo.vencido')` badge, the formatted date, and "hace 10 días" are all visible without hover

#### Scenario: Relative-days text pluralizes correctly for exactly one day
- **WHEN** `fechaRevisionProxima` is exactly 1 day from today
- **THEN** the visible text uses the singular form ("en 1 día"), not "en 1 días"

#### Scenario: Null or undefined date renders a dash
- **WHEN** `fechaRevisionProxima` is `null` or `undefined`
- **THEN** the component renders a dash (`—`) and no date or relative text

#### Scenario: No day-off-by-one in a negative UTC offset timezone
- **WHEN** the browser timezone is `UTC-5`, "today" there is `2026-09-29`, and `fechaRevisionProxima` is `"2026-10-01T00:00:00Z"`
- **THEN** the visible date reads October 1 (not September 30) and the relative text reads "en 2 días" (not "en 1 día" or "en 3 días")
