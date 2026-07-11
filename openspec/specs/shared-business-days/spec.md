# Spec: shared-business-days

## Purpose

TBD — Shared pure-function utilities for business-day (Monday–Friday) date arithmetic, with optional holiday exclusion. Extracted/generalized from prior logic in `qualityEventHelpers.ts` so it can be reused across modules (e.g., dashboard semaforos) without duplicating weekday-counting logic.

---

## Requirements

### Requirement: contarDiasHabiles counts business days with optional configurable holidays
The system SHALL export a pure function `contarDiasHabiles(desde: Date, hasta: Date, feriados?: string[]): number` from `src/utils/businessDays.ts`. The function SHALL count the number of business days (Monday through Friday) strictly after `desde` up to and including `hasta`, assuming `hasta >= desde`. When the optional `feriados` parameter is provided as an array of ISO date strings (`'yyyy-MM-dd'`), any date in that list that falls within the counted range SHALL be excluded from the count even if it falls on a weekday. When `feriados` is omitted, it SHALL default to an empty array and behave identically to counting only weekdays.

#### Scenario: Counts only weekdays between two dates with no holidays
- **WHEN** `contarDiasHabiles` is called with `desde` a Monday and `hasta` the Friday of the same week (no `feriados` argument)
- **THEN** the function returns `4` (Tue, Wed, Thu, Fri)

#### Scenario: Excludes weekend days from the count
- **WHEN** `contarDiasHabiles` is called with `desde` a Friday and `hasta` the following Monday
- **THEN** the function returns `1` (only the Monday counts; Saturday and Sunday are excluded)

#### Scenario: Excludes a configured holiday that falls on a weekday
- **WHEN** `contarDiasHabiles` is called with a `desde`/`hasta` range spanning 5 weekdays and `feriados` includes the ISO date string of one weekday inside that range
- **THEN** the function returns `4`, excluding the holiday date from the count

#### Scenario: Returns zero when desde equals hasta
- **WHEN** `contarDiasHabiles` is called with `desde` and `hasta` set to the same calendar day
- **THEN** the function returns `0`

#### Scenario: Existing quality-events callers are unaffected
- **WHEN** `qualityEventHelpers.ts` calls `contarDiasHabiles(desde, hasta)` without a `feriados` argument, as it does today for `estaVencidaVerificacion` and `QEHeaderSection`
- **THEN** the returned value is identical to the value produced by the pre-existing weekday-only implementation for the same inputs

### Requirement: calcularDiasHabilesRestantes returns a signed business-day distance
The system SHALL export a pure function `calcularDiasHabilesRestantes(hoy: Date, fechaVencimiento: Date, feriados?: string[]): number` from `src/utils/businessDays.ts`. When `fechaVencimiento` is on or after `hoy`, the function SHALL return a non-negative number equal to `contarDiasHabiles(hoy, fechaVencimiento, feriados)`. When `fechaVencimiento` is before `hoy`, the function SHALL return a negative number equal to `-contarDiasHabiles(fechaVencimiento, hoy, feriados)`. The `feriados` parameter SHALL default to an empty array when omitted.

#### Scenario: Returns positive count for a future due date
- **WHEN** `calcularDiasHabilesRestantes` is called with `hoy` a Monday and `fechaVencimiento` the Friday of the same week
- **THEN** the function returns `4`

#### Scenario: Returns negative count for a past due date
- **WHEN** `calcularDiasHabilesRestantes` is called with `hoy` a Friday and `fechaVencimiento` the Monday of the same week
- **THEN** the function returns `-4`

#### Scenario: Returns zero when the due date is today
- **WHEN** `calcularDiasHabilesRestantes` is called with `hoy` and `fechaVencimiento` set to the same calendar day
- **THEN** the function returns `0`

#### Scenario: Respects configured holidays when computing the signed distance
- **WHEN** `calcularDiasHabilesRestantes` is called with a future `fechaVencimiento` and `feriados` includes a weekday date inside the range
- **THEN** the returned positive count excludes that holiday date
