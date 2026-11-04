## ADDED Requirements

### Requirement: QualityEventForm precarga los datos del incidente de origen
En modo creación, cuando `origen === 'O1_INCIDENTE_CAMPO'` y hay un `incidenteId` (del query param o elegido en el `SearchableSelect`), el formulario SHALL obtener el incidente con `useIncident(incidenteId)` y SHALL completar con `setValue`: `descripcion` ← `incidente.descripcion`; `fechaHoraEvento` ← `incidente.fechaEvento` convertido a hora local `yyyy-MM-ddTHH:mm` con `toDatetimeLocalValue` (nunca `.slice(0, 16)` sobre el ISO UTC); `turno` ← `incidente.turno`; `areaId` ← `incidente.areaId`; `severidad` ← `incidente.severidad`; `tipo` ← `'SST'`. Todos los campos SHALL seguir editables. Mientras haya datos precargados, SHALL mostrarse bajo la descripción `t('qualityEvents:form.precargaIncidente', { numero })`.

#### Scenario: Precarga desde la URL
- **WHEN** se navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=…`
- **THEN** descripción, fecha/hora (en hora local, sin corrimiento), turno, área, severidad y tipo SST quedan precargados y editables, y se muestra la nota de precarga

#### Scenario: Precarga al elegir el incidente en el combo
- **WHEN** el usuario elige un incidente en el combo sin haber modificado los campos precargables
- **THEN** los campos se completan directamente con los datos del incidente elegido

### Requirement: QualityEventForm pide confirmación antes de reemplazar datos modificados
Al cambiar el incidente seleccionado, si alguno de los campos precargables (`descripcion`, `fechaHoraEvento`, `turno`, `areaId`, `severidad`, `tipo`) está en `formState.dirtyFields`, el formulario SHALL pedir confirmación con `t('qualityEvents:form.confirmReemplazoIncidente', { numero })` mediante un diálogo propio (nunca `window.confirm`). Si el usuario confirma, SHALL sobrescribir los campos; si cancela, SHALL conservar sus valores y mantener el nuevo incidente seleccionado.

#### Scenario: Cambio con datos modificados
- **WHEN** el usuario editó la descripción y luego elige otro incidente
- **THEN** se muestra el diálogo de confirmación y los campos solo se reemplazan si confirma

### Requirement: QualityEventForm permite elegir el responsable de investigación al crear (solo JCA)
En modo creación, el formulario SHALL mostrar un `SearchableSelect` opcional "Responsable de investigación" (`t('qualityEvents:form.fields.responsableInvestigacion')`) con los candidatos de `useCandidatosResponsableQE`, mostrando nombre y rol, solo cuando el usuario autenticado es `JEFE_CALIDAD_SYST`. El payload SHALL incluir `responsableInvestigacionId` solo si se eligió.

#### Scenario: JCA ve el campo
- **WHEN** un JCA abre el formulario de alta
- **THEN** ve el campo "Responsable de investigación" opcional

#### Scenario: Otro rol no ve el campo
- **WHEN** un SUPERVISOR abre el formulario de alta
- **THEN** el campo no se renderiza

### Requirement: QualityEventForm muestra la fecha del evento en hora local en edición
En modo edición, `fechaHoraEvento` SHALL inicializarse con `toDatetimeLocalValue(qe.fechaHoraEvento)` y la detección de cambios al enviar SHALL comparar contra ese mismo valor convertido, de modo que abrir y guardar sin tocar la fecha no genere un cambio.

#### Scenario: Edición sin corrimiento
- **WHEN** se edita un QE cuyo `fechaHoraEvento` es `2026-10-20T15:30:00Z` en un navegador UTC-5
- **THEN** el input muestra `2026-10-20T10:30`, igual que el detalle
