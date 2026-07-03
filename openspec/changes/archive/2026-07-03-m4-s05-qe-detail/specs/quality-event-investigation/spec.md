## ADDED Requirements

### Requirement: QEInvestigationSection editability is gated by role and estado
The system SHALL render a `QEInvestigationSection` component at `src/features/quality-events/components/QEInvestigationSection.tsx`. Its fields (tool toggle, 5 Porqués/Ishikawa inputs, causa raíz definitiva textarea) SHALL be editable only when the current user's role is `JEFE_CALIDAD_SYST` AND `qe.estado` is `EN_INVESTIGACION` or `ANALISIS_COMPLETADO`. For any other role or state, all fields render read-only.

#### Scenario: JEFE_CALIDAD_SYST sees editable fields in EN_INVESTIGACION
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` in `EN_INVESTIGACION` with role `JEFE_CALIDAD_SYST`
- **THEN** the tool toggle, analysis inputs, and causa raíz textarea are editable

#### Scenario: SUPERVISOR sees read-only fields
- **WHEN** `QEInvestigationSection` renders for any `QualityEvent` with role `SUPERVISOR`
- **THEN** all investigation fields render as read-only text, with no toggle or textareas

#### Scenario: JEFE_CALIDAD_SYST sees read-only fields once EN_EJECUCION
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` in `EN_EJECUCION` with role `JEFE_CALIDAD_SYST`
- **THEN** all investigation fields render as read-only

---

### Requirement: Tool toggle between 5 Porqués and Ishikawa with confirm-before-clear
`QEInvestigationSection` SHALL render a radio toggle between "5 Porqués" and "Diagrama Ishikawa", bound to `qe.metodoAnalisis`. Only one tool's fields are shown at a time, matching the active `metodoAnalisis`. Switching the toggle SHALL NOT use `window.confirm`; instead it SHALL show a Sonner toast with a "Confirmar cambio" action button. The previous tool's field values SHALL be cleared only after the user clicks "Confirmar cambio"; dismissing or ignoring the toast SHALL leave the toggle and data unchanged.

#### Scenario: Switching tool shows a confirm toast instead of window.confirm
- **WHEN** the user selects "Diagrama Ishikawa" while `metodoAnalisis === '5_PORQUES'` and `cincoPorques` has at least one non-empty answer
- **THEN** a Sonner toast with a "Confirmar cambio" action is shown, and no native `confirm()` dialog appears

#### Scenario: Confirming the switch clears the previous tool's fields
- **WHEN** the user clicks "Confirmar cambio" on the switch-tool toast
- **THEN** `metodoAnalisis` updates to `'ISHIKAWA'` and the `cincoPorques` values are cleared

#### Scenario: Ignoring the toast leaves the tool unchanged
- **WHEN** the switch-tool toast is shown and the user takes no action
- **THEN** `metodoAnalisis` and all field values remain unchanged

---

### Requirement: 5 Porqués table with five editable rows
When `metodoAnalisis === '5_PORQUES'`, `QEInvestigationSection` SHALL render a table of 5 rows, each with a fixed label ("¿Por qué 1?" through "¿Por qué 5?") and an editable textarea bound to that row's `respuesta`. All 5 rows SHALL be optional (no minimum length enforced). On save, the values SHALL be submitted as `cincoPorques: CincoPorques[]`.

#### Scenario: Five rows rendered with fixed labels
- **WHEN** `QEInvestigationSection` renders with `metodoAnalisis === '5_PORQUES'`
- **THEN** exactly 5 rows are visible, labeled "¿Por qué 1?" through "¿Por qué 5?"

#### Scenario: Empty answers are accepted
- **WHEN** the user leaves all 5 `respuesta` textareas empty and clicks "Guardar investigación"
- **THEN** no validation error blocks the save

---

### Requirement: Ishikawa diagram with six editable categories
When `metodoAnalisis === 'ISHIKAWA'`, `QEInvestigationSection` SHALL render six category blocks — Método, Máquina, Material, Mano de obra, Medición, Medio ambiente (matching `IshikawaCategoria` from M4-S01) — each with an editable textarea for identified causes. On save, the values SHALL be submitted as `ishikawa: Ishikawa[]`.

#### Scenario: Six category blocks rendered
- **WHEN** `QEInvestigationSection` renders with `metodoAnalisis === 'ISHIKAWA'`
- **THEN** exactly 6 category blocks are visible, one per `IshikawaCategoria` value

#### Scenario: Category causes are optional
- **WHEN** the user leaves all 6 category textareas empty and clicks "Guardar investigación"
- **THEN** no validation error blocks the save

---

### Requirement: Causa raíz definitiva field with length validation
`QEInvestigationSection` SHALL render a `causaRaizDefinitiva` textarea validated by Zod as a string between 100 and 500 characters (required before approval, per the "Aprobar causa raíz" requirement below).

#### Scenario: Value under 100 characters blocks approval
- **WHEN** `causaRaizDefinitiva` has 50 characters and the user clicks "Aprobar causa raíz"
- **THEN** a validation error is shown and the approval action is not triggered

#### Scenario: Value between 100 and 500 characters is valid
- **WHEN** `causaRaizDefinitiva` has 200 characters
- **THEN** no validation error is shown for that field

---

### Requirement: Guardar investigación persists investigation fields
`QEInvestigationSection` SHALL render a "Guardar investigación" button, visible to `JEFE_CALIDAD_SYST` while `qe.estado` is `EN_INVESTIGACION` or `ANALISIS_COMPLETADO`. Clicking it SHALL call `useUpdateQualityEvent().mutate({ id: qe.id, data })` with `data` containing `metodoAnalisis`, `cincoPorques` or `ishikawa` (whichever is active), and `causaRaizDefinitiva`, sent via `PATCH /api/quality-events/:id`.

#### Scenario: Guardar investigación calls the update mutation
- **WHEN** `JEFE_CALIDAD_SYST` edits the causa raíz textarea and clicks "Guardar investigación"
- **THEN** `useUpdateQualityEvent().mutate` is called with `{ id: qe.id, data: { ...} }` including the updated `causaRaizDefinitiva`

#### Scenario: Button hidden outside allowed states
- **WHEN** `qe.estado` is `EN_EJECUCION`
- **THEN** the "Guardar investigación" button is not rendered

---

### Requirement: Aprobar causa raíz requires PIN confirmation
`QEInvestigationSection` SHALL render an "Aprobar causa raíz" button visible only to `JEFE_CALIDAD_SYST` when `causaRaizDefinitiva` is non-empty and `causaRaizFirmadaEn` is empty. Clicking it SHALL open a modal prompting for a PIN. Only the mock value `1234` SHALL be accepted; any other value SHALL show an error and not submit. On correct PIN confirmation, the system SHALL call `useUpdateQualityEvent().mutate({ id: qe.id, data: { causaRaizFirmadaEn: <ISO timestamp> } })`.

#### Scenario: Button hidden when causaRaizDefinitiva is empty
- **WHEN** `causaRaizDefinitiva` is an empty string
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: Button hidden when already firmed
- **WHEN** `causaRaizFirmadaEn` is already set
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: PIN modal rejects wrong PIN
- **WHEN** the user enters `0000` in the PIN modal and confirms
- **THEN** an error is shown and `useUpdateQualityEvent().mutate` is not called

#### Scenario: PIN modal accepts 1234 and stamps approval
- **WHEN** the user enters `1234` in the PIN modal and confirms
- **THEN** `useUpdateQualityEvent().mutate` is called with `causaRaizFirmadaEn` set to a current ISO 8601 timestamp

---

### Requirement: Approved causa raíz renders read-only with an approval seal
Once `causaRaizFirmadaEn` is set, the causa raíz block SHALL render read-only with a seal reading "Aprobado por [nombre] el [fecha]", using `causaRaizAprobadaPorId` resolved to a display name and `causaRaizFirmadaEn` formatted via `Intl.DateTimeFormat`.

#### Scenario: Approval seal shown after firming
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` resolves to a known user
- **THEN** the causa raíz block is read-only and shows "Aprobado por [nombre] el [fecha]"

---

### Requirement: Asistir con IA placeholder button
`QEInvestigationSection` SHALL render an "Asistir con IA" button that is always disabled, with a tooltip reading "Próximamente disponible". No AI logic SHALL be implemented behind this button.

#### Scenario: IA button always disabled
- **WHEN** `QEInvestigationSection` renders for any role or state
- **THEN** the "Asistir con IA" button is present and disabled, with the "Próximamente disponible" tooltip
