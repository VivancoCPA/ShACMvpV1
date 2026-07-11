# Spec: shared-semaforo-pendientes

## Purpose

TBD — Shared semaforo (traffic-light) threshold logic and UI components for representing pending-item urgency by signed remaining business days, plus a distinct banner for critical unclosed items. Used by dashboard pending-items widgets and reusable across modules that need the same VERDE/AMARILLO/ROJO convention.

---

## Requirements

### Requirement: calcularEstadoSemaforoFila maps signed remaining business days to a row state
The system SHALL export a pure function `calcularEstadoSemaforoFila(diasHabilesRestantes: number): 'VERDE' | 'AMARILLO' | 'ROJO'` from `src/features/dashboard/utils/semaforoPendientes.ts`. The function SHALL return `'VERDE'` when `diasHabilesRestantes` is greater than `5`, `'AMARILLO'` when `diasHabilesRestantes` is between `1` and `5` inclusive, and `'ROJO'` when `diasHabilesRestantes` is `0` or negative.

#### Scenario: More than 5 business days remaining is VERDE
- **WHEN** `calcularEstadoSemaforoFila(6)` is called
- **THEN** the function returns `'VERDE'`

#### Scenario: Exactly 5 business days remaining is AMARILLO
- **WHEN** `calcularEstadoSemaforoFila(5)` is called
- **THEN** the function returns `'AMARILLO'`

#### Scenario: Exactly 1 business day remaining is AMARILLO
- **WHEN** `calcularEstadoSemaforoFila(1)` is called
- **THEN** the function returns `'AMARILLO'`

#### Scenario: Zero business days remaining (due today) is ROJO
- **WHEN** `calcularEstadoSemaforoFila(0)` is called
- **THEN** the function returns `'ROJO'`

#### Scenario: Negative business days remaining (past due) is ROJO
- **WHEN** `calcularEstadoSemaforoFila(-3)` is called
- **THEN** the function returns `'ROJO'`

### Requirement: calcularEstadoSemaforoDesdeFecha derives state and remaining days from a due date
The system SHALL export a function `calcularEstadoSemaforoDesdeFecha(fechaVencimiento: string | Date, hoy?: Date, feriados?: string[]): { estado: 'VERDE' | 'AMARILLO' | 'ROJO'; diasHabilesRestantes: number }` from `src/features/dashboard/utils/semaforoPendientes.ts`. The function SHALL compute `diasHabilesRestantes` using `calcularDiasHabilesRestantes` (from `shared-business-days`) with `hoy` defaulting to the current date and `feriados` defaulting to an empty array, and SHALL derive `estado` from that value using `calcularEstadoSemaforoFila`.

#### Scenario: Combines day calculation and state mapping for a future date
- **WHEN** `calcularEstadoSemaforoDesdeFecha` is called with a `fechaVencimiento` 10 business days in the future
- **THEN** the function returns `diasHabilesRestantes: 10` and `estado: 'VERDE'`

#### Scenario: Accepts an explicit hoy for deterministic testing
- **WHEN** `calcularEstadoSemaforoDesdeFecha` is called with an explicit `hoy` and a `fechaVencimiento` 3 business days after it
- **THEN** the function returns `diasHabilesRestantes: 3` and `estado: 'AMARILLO'`, independent of the actual current date

### Requirement: SemaforoRow renders a left-border row treatment without a colored row background
The system SHALL export a `SemaforoRow` component from `src/components/shared/SemaforoRow.tsx` that accepts `estado: 'VERDE' | 'AMARILLO' | 'ROJO'`, `codigo: string`, `descripcion: string`, `diasHabilesRestantes: number`, and an optional `onClick: () => void`. The component SHALL render a neutral row background (`bg-surface-card dark:bg-surface-dark-elevated`) with a full 0.5px border (`border border-hairline dark:border-hairline/20`) and a 3px left border colored by semantic role (`border-l-success` for `VERDE`, `border-l-warning` for `AMARILLO`, `border-l-error` for `ROJO`). The row SHALL NOT apply any colored background fill tied to `estado`. The left edge of the row SHALL NOT be rounded (`rounded-l-none`) while other corners retain the standard row radius.

#### Scenario: VERDE state renders success-colored left border and neutral background
- **WHEN** `SemaforoRow` is rendered with `estado="VERDE"`
- **THEN** the row element has a `border-l-success` class and a `bg-surface-card` class, with no `bg-success`-family class applied

#### Scenario: AMARILLO state renders warning-colored left border and neutral background
- **WHEN** `SemaforoRow` is rendered with `estado="AMARILLO"`
- **THEN** the row element has a `border-l-warning` class and a `bg-surface-card` class, with no `bg-warning`-family class applied

#### Scenario: ROJO state renders error-colored left border and neutral background
- **WHEN** `SemaforoRow` is rendered with `estado="ROJO"`
- **THEN** the row element has a `border-l-error` class and a `bg-surface-card` class, with no `bg-error`-family class applied

#### Scenario: Left edge is not rounded
- **WHEN** `SemaforoRow` is rendered with any `estado`
- **THEN** the row element has a `rounded-l-none` class alongside its base rounded classes

#### Scenario: SemaforoRow supports dark mode
- **WHEN** `SemaforoRow` is rendered
- **THEN** the row's background, border, and text classes include corresponding `dark:` variants

### Requirement: SemaforoRow shows deadline text colored by semantic role
The system SHALL render deadline text inside `SemaforoRow` using the i18n keys `dashboard:semaforo.venceEn` (interpolating `dias`) when `diasHabilesRestantes` is greater than `0`, `dashboard:semaforo.venceHoy` when `diasHabilesRestantes` equals `0`, and `dashboard:semaforo.vencidoHace` (interpolating `dias` with the absolute value) when `diasHabilesRestantes` is negative. The deadline text SHALL use a text color matching `estado`'s semantic role (`text-success`, `text-warning`, or `text-error`), each with an explicit `dark:` variant of the same token.

#### Scenario: Positive remaining days renders "vence en" text
- **WHEN** `SemaforoRow` is rendered with `diasHabilesRestantes={7}`
- **THEN** the rendered text uses the `dashboard:semaforo.venceEn` key interpolated with `dias: 7`

#### Scenario: Zero remaining days renders "vence hoy" text
- **WHEN** `SemaforoRow` is rendered with `diasHabilesRestantes={0}`
- **THEN** the rendered text uses the `dashboard:semaforo.venceHoy` key

#### Scenario: Negative remaining days renders "vencido hace" text with absolute value
- **WHEN** `SemaforoRow` is rendered with `diasHabilesRestantes={-5}`
- **THEN** the rendered text uses the `dashboard:semaforo.vencidoHace` key interpolated with `dias: 5`

### Requirement: SemaforoRow supports optional click navigation
The system SHALL render `SemaforoRow` as an interactive `<button type="button">` element when an `onClick` prop is provided, and as a non-interactive container when `onClick` is omitted. When rendered as a button, activating it (click or keyboard activation) SHALL invoke the provided `onClick` callback.

#### Scenario: Row is a button when onClick is provided
- **WHEN** `SemaforoRow` is rendered with an `onClick` handler
- **THEN** the root element is a `<button type="button">` and clicking it invokes the handler

#### Scenario: Row is not interactive when onClick is omitted
- **WHEN** `SemaforoRow` is rendered without an `onClick` prop
- **THEN** the root element is not a `<button>` and has no click handler attached

### Requirement: SemaforoCriticoBanner renders an independent banner for critical unclosed items
The system SHALL export a `SemaforoCriticoBanner` component from `src/components/shared/SemaforoCriticoBanner.tsx` that accepts `items: { id: string; codigo: string; descripcion: string }[]` and an optional `onItemClick: (id: string) => void`. When `items` is empty, the component SHALL render nothing (`null`). When `items` is non-empty, the component SHALL render a banner distinct from any `SemaforoRow` list — using a danger-role background and border (`bg-error/10 dark:bg-error/15`, `border border-error dark:border-error`), an alert icon, and text in `text-error dark:text-error` — positioned independently of the regular VERDE/AMARILLO/ROJO row list, never as an additional row within it.

#### Scenario: Renders nothing when there are no critical items
- **WHEN** `SemaforoCriticoBanner` is rendered with `items={[]}`
- **THEN** the component renders no DOM output

#### Scenario: Renders the banner with danger styling when critical items exist
- **WHEN** `SemaforoCriticoBanner` is rendered with one or more `items`
- **THEN** the banner element has `bg-error/10` and `border-error` classes and displays an alert icon

#### Scenario: Banner lists each critical item's codigo and descripcion
- **WHEN** `SemaforoCriticoBanner` is rendered with two items
- **THEN** both items' `codigo` and `descripcion` values appear in the rendered output

#### Scenario: SemaforoCriticoBanner supports dark mode
- **WHEN** `SemaforoCriticoBanner` is rendered
- **THEN** its background, border, and text classes include corresponding `dark:` variants

#### Scenario: Item click invokes the callback with the item id
- **WHEN** `SemaforoCriticoBanner` is rendered with `onItemClick` and a user activates one of the listed items
- **THEN** `onItemClick` is called with that item's `id`
