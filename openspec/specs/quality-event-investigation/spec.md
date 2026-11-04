# Spec: quality-event-investigation

## Purpose

`QEInvestigationSection` — root-cause analysis workspace within the Quality Event detail page. Supports 5 Porqués and Ishikawa tools with confirm-before-clear tool switching, causa raíz approval with PIN confirmation, and a disabled AI-assist placeholder.

---
## Requirements
### Requirement: QEInvestigationSection editability is gated by role and estado
The system SHALL render a `QEInvestigationSection` component at `src/features/quality-events/components/QEInvestigationSection.tsx`. Its analysis fields (tool toggle, 5 Porqués/Ishikawa inputs) SHALL be editable only when `qe.deletedAt` is empty, `qe.estado` is `EN_INVESTIGACION` or `ANALISIS_COMPLETADO`, AND the current user is either `JEFE_CALIDAD_SYST` or the QE's assigned investigator (`qe.responsableInvestigacionId === user.id`). The causa raíz definitiva textarea SHALL follow the same rule and additionally require `qe.causaRaizFirmadaEn` to be empty. For any other user, role or state, all fields render read-only.

#### Scenario: JEFE_CALIDAD_SYST sees editable fields in EN_INVESTIGACION
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` in `EN_INVESTIGACION` with role `JEFE_CALIDAD_SYST`
- **THEN** the tool toggle, analysis inputs, and causa raíz textarea are editable

#### Scenario: Assigned SUPERVISOR sees editable fields
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` in `EN_INVESTIGACION` whose `responsableInvestigacionId` is the current `SUPERVISOR`
- **THEN** the tool toggle, analysis inputs, and causa raíz textarea are editable

#### Scenario: Non-assigned SUPERVISOR sees read-only fields
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` with role `SUPERVISOR` and a `responsableInvestigacionId` other than the current user
- **THEN** all investigation fields render as read-only text, with no toggle or textareas

#### Scenario: JEFE_CALIDAD_SYST sees read-only fields once EN_EJECUCION
- **WHEN** `QEInvestigationSection` renders for a `QualityEvent` in `EN_EJECUCION` with role `JEFE_CALIDAD_SYST`
- **THEN** all investigation fields render as read-only

#### Scenario: Causa raíz read-only once firmed
- **WHEN** `qe.causaRaizFirmadaEn` is set and the QE is still in `ANALISIS_COMPLETADO`
- **THEN** the causa raíz renders read-only while the analysis inputs remain editable for the JCA or the assigned investigator

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
`QEInvestigationSection` SHALL render a "Guardar investigación" button whenever the analysis fields are editable (per the editability requirement). Clicking it SHALL call `useUpdateQualityEvent().mutate({ id: qe.id, data })` via `PATCH /api/quality-events/:id`. `data` SHALL contain:
- `metodoAnalisis`;
- only the active tool's list (`cincoPorques` or `ishikawa`);
- `causaRaizDefinitiva`, but only while the causa raíz is not firmed;
- `origenIA` (see `quality-event-asistente-ia`), when a value sent in that call was filled from an AI suggestion.

On success it SHALL show `toast.success(t('qualityEvents:detail.investigation.guardado'))`. On error it SHALL show the server's translated `errorCode` (`qualityEvents:errors.<errorCode>`) when one exists, otherwise the server `message`.

#### Scenario: Guardar investigación calls the update mutation
- **WHEN** `JEFE_CALIDAD_SYST` edits the causa raíz textarea and clicks "Guardar investigación"
- **THEN** `useUpdateQualityEvent().mutate` is called with `{ id: qe.id, data: { ...} }` including the updated `causaRaizDefinitiva`

#### Scenario: Only the active tool is sent
- **WHEN** the active tool is `ISHIKAWA` and the user saves
- **THEN** `data` includes `ishikawa` and does not include `cincoPorques`

#### Scenario: AI origin is sent with the saved value
- **WHEN** the user applied the AI causa raíz suggestion without editing it and saves
- **THEN** `data.origenIA` equals `{ causaRaiz: 'IA' }`

#### Scenario: Success toast
- **WHEN** the save succeeds
- **THEN** the toast "Análisis guardado." is shown

#### Scenario: Saved analysis survives a reload
- **WHEN** the user saves 5 Porqués answers and the detail is refetched
- **THEN** the textareas show the saved answers

#### Scenario: Button hidden outside allowed states
- **WHEN** `qe.estado` is `EN_EJECUCION`
- **THEN** the "Guardar investigación" button is not rendered

### Requirement: Aprobar causa raíz requires PIN confirmation
`QEInvestigationSection` SHALL render an "Aprobar causa raíz" button only to `JEFE_CALIDAD_SYST`, while the analysis is editable, `causaRaizDefinitiva` is non-empty and `causaRaizFirmadaEn` is empty. A user who can edit but is not JCA SHALL instead see `t('qualityEvents:detail.investigation.pendienteAprobacion')` while the causa raíz is unfirmed.

Clicking the button SHALL first validate the 100–500 character length client-side. If the form has unsaved analysis or causa raíz changes, it SHALL save them through `useUpdateQualityEvent` and open the PIN modal only after that save succeeds, since the server approves what it has stored. The PIN modal SHALL validate only the format client-side (`/^\d{4}$/`). On a well-formed PIN, it SHALL call `useAprobarCausaRaiz().mutate({ id: qe.id, pin })`, which sends only `{ pin }` to `POST /api/quality-events/:id/aprobar-causa-raiz`, never a timestamp or approver id.

The modal SHALL handle errors in place:
- `errorCode = PIN_INCORRECTO` keeps the modal open with `t('qualityEvents:detail.investigation.errors.PIN_INCORRECTO')` inline;
- `PIN_NO_CONFIGURADO` shows the notice with a link to `/perfil#pin-firma`, the same pattern as the document signature modal and `QECierreSection`;
- other errors close the modal and show a toast with the translated `errorCode` or the message.

The modal SHALL always render a "¿Olvidaste tu PIN?" link to `/perfil#pin-firma`. On success it SHALL close the modal and invalidate the QE detail, the list and the audit trail.

#### Scenario: Button hidden when causaRaizDefinitiva is empty
- **WHEN** `causaRaizDefinitiva` is an empty string
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: Button hidden when already firmed
- **WHEN** `causaRaizFirmadaEn` is already set
- **THEN** the "Aprobar causa raíz" button is not rendered

#### Scenario: Assigned SUPERVISOR does not see Aprobar
- **WHEN** the assigned `SUPERVISOR` views an editable QE with a non-empty causa raíz
- **THEN** the "Aprobar causa raíz" button is not rendered and "Pendiente de aprobación del Jefe de Calidad." is shown

#### Scenario: Malformed PIN blocks submission client-side
- **WHEN** the user enters a value that is not exactly 4 numeric digits (e.g. `12`, `12a4`, empty) and confirms
- **THEN** an inline format error is shown and no request is sent

#### Scenario: Well-formed PIN calls the approval endpoint
- **WHEN** the user enters a 4-digit PIN (e.g. `9081`) and confirms
- **THEN** `POST /api/quality-events/:id/aprobar-causa-raiz` is called with body `{ pin: '9081' }` and nothing else

#### Scenario: Incorrect PIN shown inside the modal
- **WHEN** the endpoint responds `errorCode = PIN_INCORRECTO`
- **THEN** the modal stays open and shows "PIN incorrecto."

#### Scenario: PIN not configured
- **WHEN** the endpoint responds `errorCode = PIN_NO_CONFIGURADO`
- **THEN** the modal shows the notice with a link to `/perfil#pin-firma`

#### Scenario: Unsaved changes are saved before the PIN modal
- **WHEN** the JCA edited the causa raíz without saving and clicks "Aprobar causa raíz"
- **THEN** the PATCH is sent first and the PIN modal opens only after it succeeds

---

### Requirement: Approved causa raíz renders read-only with an approval seal
Once `causaRaizFirmadaEn` is set, the causa raíz block SHALL render read-only with a seal reading "Aprobado por [nombre] el [fecha]", using `causaRaizAprobadaPorId` resolved to a display name via the `useUserNames` hook (`user-names-lookup`, calling the real `GET /api/users/nombres` endpoint) and `causaRaizFirmadaEn` formatted via `Intl.DateTimeFormat`. The name SHALL resolve correctly for any real user known to the backend, including a deactivated one, and SHALL show the generic "Usuario no disponible" text (never the raw id) if the backend does not resolve it.

#### Scenario: Approval seal shown after firming
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` resolves to a known user
- **THEN** the causa raíz block is read-only and shows "Aprobado por [nombre] el [fecha]"

#### Scenario: Approval seal resolves a real user name from the backend
- **WHEN** `causaRaizFirmadaEn` is set and `causaRaizAprobadaPorId` is a real user id resolved by `GET /api/users/nombres`
- **THEN** the seal shows the resolved display name, not a blank value and not the raw id

#### Scenario: Approval seal shows the generic fallback when unresolved
- **WHEN** `causaRaizAprobadaPorId` does not resolve via `GET /api/users/nombres`
- **THEN** the seal shows the generic "Usuario no disponible" text, not the raw id

