## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Asistir con IA placeholder button
**Reason**: El asistente de IA se implementa en este change (PRD §1.7, decisión D3 de Toño), así que el botón deja de ser un placeholder deshabilitado con el tooltip "Próximamente disponible".
**Migration**: El comportamiento nuevo del botón (visible según `GET /api/config/funcionalidades` y los permisos de edición) está en `quality-event-asistente-ia`, requirement "Botón Asistir con IA según disponibilidad y permiso".
