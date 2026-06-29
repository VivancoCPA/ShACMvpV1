## ADDED Requirements

### Requirement: Formulario de creación de incidente
El sistema SHALL proveer un formulario en `/incidents/nuevo` para reportar un nuevo incidente SyST. Solo usuarios con `canCreate = true` según `getIncidentPermissions()` (OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST) pueden acceder. Usuarios sin permiso SHALL ser redirigidos a `/incidents`.

#### Scenario: Acceso autorizado a creación
- **WHEN** un usuario con rol OPERARIO navega a `/incidents/nuevo`
- **THEN** el sistema muestra el formulario con el bloque "Reporte inicial"

#### Scenario: Acceso denegado a creación
- **WHEN** un usuario con rol AUDITOR_INTERNO navega a `/incidents/nuevo`
- **THEN** el sistema redirige a `/incidents`

### Requirement: Bloque "Reporte inicial" con campos obligatorios
El formulario SHALL incluir un bloque "Reporte inicial" siempre visible con los campos: `tipo` (radio cards), `descripcion` (textarea, mín 20 / máx 2000 chars), `area` (select), `fechaEvento` (datetime-local), `turno` (DIA/TARDE/NOCHE), `huboLesionados` (toggle), `numLesionados` (condicional), y `severidad` (select). Todos los campos excepto `numLesionados` son obligatorios.

#### Scenario: Validación de descripción mínima
- **WHEN** el usuario intenta enviar el formulario con `descripcion` menor a 20 caracteres
- **THEN** el sistema muestra un error inline bajo el campo indicando el mínimo requerido

#### Scenario: Campo numLesionados condicional
- **WHEN** el usuario activa el toggle `huboLesionados = true`
- **THEN** aparece el campo `numLesionados` con valor mínimo de 1

#### Scenario: Ocultamiento de numLesionados
- **WHEN** el usuario desactiva el toggle `huboLesionados = false`
- **THEN** el campo `numLesionados` desaparece y su valor se limpia del formulario

#### Scenario: Validación de fecha futura
- **WHEN** el usuario selecciona una `fechaEvento` posterior al momento actual
- **THEN** el sistema muestra error inline "La fecha del evento no puede ser futura"

#### Scenario: Validación de fecha mayor a 72 horas
- **WHEN** el usuario selecciona una `fechaEvento` más de 72 horas en el pasado
- **THEN** el sistema muestra error inline indicando el límite de 72 horas

### Requirement: Cálculo automático de severidad
El sistema SHALL recalcular y pre-rellenar el campo `severidad` usando `getAutoSeveridad(tipo, numLesionados)` cada vez que el usuario cambie `tipo` o `numLesionados`. Para usuarios con rol JEFE_CALIDAD_SYST el campo permanece editable. Para otros roles el campo SHALL mostrarse deshabilitado con el valor calculado.

#### Scenario: Cálculo automático para ACCIDENTE con lesionados
- **WHEN** el usuario selecciona `tipo = ACCIDENTE` y establece `numLesionados = 2`
- **THEN** el campo `severidad` se pre-rellena automáticamente con `CRITICA`

#### Scenario: Cálculo automático para CONDICION_INSEGURA
- **WHEN** el usuario selecciona `tipo = CONDICION_INSEGURA`
- **THEN** el campo `severidad` se pre-rellena automáticamente con `BAJA`

#### Scenario: Edición manual de severidad por JEFE_CALIDAD_SYST
- **WHEN** un usuario con rol JEFE_CALIDAD_SYST cambia manualmente la `severidad`
- **THEN** el valor seleccionado manualmente persiste sin ser sobreescrito por el cálculo automático

### Requirement: Radio cards de tipo de incidente
El campo `tipo` SHALL renderizarse como cuatro radio cards de tamaño grande, cada una con ícono Lucide y etiqueta. Las opciones son: `ACCIDENTE`, `INCIDENTE`, `CUASI_ACCIDENTE`, `CONDICION_INSEGURA`. Solo una puede estar seleccionada a la vez.

#### Scenario: Selección de tipo ACCIDENTE
- **WHEN** el usuario hace clic en la radio card "ACCIDENTE"
- **THEN** la card queda visualmente seleccionada y `tipo` toma el valor `ACCIDENTE`

#### Scenario: Una sola selección
- **WHEN** el usuario selecciona una segunda radio card
- **THEN** la selección anterior se deselecciona automáticamente

### Requirement: Submit de creación exitosa
Al enviar el formulario exitosamente, el sistema SHALL llamar a `useCreateIncident()`, mostrar un toast de éxito con el número asignado (ej. "Incidente INC-2026-005 creado"), y redirigir a `/incidents/:id` del incidente creado.

#### Scenario: Creación exitosa con redireccion
- **WHEN** el usuario completa todos los campos requeridos y hace clic en "Guardar"
- **THEN** se crea el incidente, aparece toast de éxito con el número INC y el usuario es redirigido al detalle

#### Scenario: Cancelar formulario
- **WHEN** el usuario hace clic en "Cancelar"
- **THEN** el sistema navega a `/incidents` sin crear el incidente

### Requirement: Formulario de edición de incidente
El sistema SHALL proveer un formulario en `/incidents/:id/editar` para modificar un incidente existente. SUPERVISOR puede editar solo incidentes en estado ABIERTO o EN_INVESTIGACION. JEFE_CALIDAD_SYST puede editar en cualquier estado editable. Usuarios sin `canEdit = true` según `getIncidentPermissions()` SHALL ser redirigidos a `/incidents`.

#### Scenario: Edición por SUPERVISOR en estado válido
- **WHEN** un SUPERVISOR navega a `/incidents/:id/editar` y el incidente está en estado EN_INVESTIGACION
- **THEN** el sistema muestra el formulario de edición con datos pre-cargados y el bloque "Investigación" visible

#### Scenario: Edición bloqueada para OPERARIO
- **WHEN** un OPERARIO navega a `/incidents/:id/editar`
- **THEN** el sistema redirige a `/incidents`

### Requirement: Bloque "Investigación" en modo edición
El formulario de edición SHALL incluir un bloque "Investigación" colapsable (expandido por defecto) con los campos: `personalInvolucrado` (textarea), `testigos` (textarea), `equiposInvolucrados` (textarea), `condicionesEntorno` (checkboxes multi-select), `atencionMedicaRequerida` (toggle), `descripcionAtencionMedica` (textarea condicional), `informeMedicoAdjunto` (file input PDF, máx 10 MB). Ninguno es obligatorio para guardar.

#### Scenario: Colapso del bloque investigación
- **WHEN** el usuario hace clic en el chevron del bloque "Investigación"
- **THEN** el bloque se colapsa ocultando todos sus campos

#### Scenario: Selección múltiple de condicionesEntorno
- **WHEN** el usuario marca ILUMINACION y EPP en las checkboxes
- **THEN** `condicionesEntorno` contiene `['ILUMINACION', 'EPP']`

#### Scenario: Campo atencionMedica condicional
- **WHEN** el usuario activa `atencionMedicaRequerida = true`
- **THEN** aparece el textarea `descripcionAtencionMedica`

#### Scenario: Nota informativa informe médico para ACCIDENTE
- **WHEN** el `tipo` del incidente es `ACCIDENTE`
- **THEN** aparece una nota informativa bajo el campo `informeMedicoAdjunto` indicando que es obligatorio para cerrar el incidente (RN-INC-002)

### Requirement: Nota de plazo de investigación
El formulario de edición SHALL mostrar una nota informativa con el plazo de investigación calculado mediante `getPlazoInvestigacion(severidad)` (ej. "Plazo de investigación: 7 días hábiles"). Esta nota es solo informativa y no bloquea el guardado.

#### Scenario: Plazo mostrado en bloque investigación
- **WHEN** la `severidad` es ALTA
- **THEN** la nota muestra el plazo correspondiente a severidad ALTA

### Requirement: Submit de edición exitosa
Al enviar exitosamente el formulario de edición, el sistema SHALL llamar a `useUpdateIncident()`, mostrar un toast de éxito y redirigir a `/incidents/:id`.

#### Scenario: Edición exitosa con redireccion
- **WHEN** el usuario modifica campos y hace clic en "Guardar"
- **THEN** se actualiza el incidente, aparece toast de éxito y el usuario es redirigido al detalle

### Requirement: Tipo IncidentEvidencia y campo `evidencias` en schema Zod
El sistema SHALL definir la interfaz `IncidentEvidencia` en `src/features/incidents/types/` con los campos: `id: string`, `url: string`, `nombre: string`, `tipo: 'imagen' | 'pdf'`, `tamanioKb: number`, `creadoEn: string` (ISO 8601), `creadoPor: string`. La interfaz `Incidente` SHALL incluir `evidencias?: IncidentEvidencia[]`. El schema Zod SHALL validar `evidencias` como array opcional de `File`: máx 5 archivos, cada archivo máx 10 MB, tipos aceptados `image/jpeg`, `image/png`, `application/pdf`.

#### Scenario: IncidentEvidencia contiene los campos requeridos
- **WHEN** se define la interfaz IncidentEvidencia
- **THEN** contiene: id, url, nombre, tipo ('imagen'|'pdf'), tamanioKb, creadoEn (ISO 8601), creadoPor

#### Scenario: Error inline al exceder límite de archivos
- **WHEN** el usuario intenta subir un 6° archivo
- **THEN** el sistema muestra error inline "Máximo 5 archivos permitidos"

#### Scenario: Error inline para archivo mayor a 10 MB
- **WHEN** el usuario selecciona un archivo mayor a 10 MB
- **THEN** el sistema muestra error "El archivo '[nombre]' supera el límite de 10 MB" bajo el campo

### Requirement: Zona de carga de evidencias en el bloque Reporte inicial
El formulario SHALL incluir una zona de carga de evidencias inmediatamente después del campo `huboLesionados`, con: input `type="file" multiple accept="image/jpeg,image/png,application/pdf"`, label "Evidencias (fotos / documentos)", vista previa inline (imágenes → thumbnail 80×80 px con ícono X; PDFs → ícono FileText + nombre + ícono X), y límites de 5 archivos máx / 10 MB por archivo. Para `tipo = ACCIDENTE`, SHALL mostrar nota informativa: "Para incidentes de tipo Accidente, la evidencia fotográfica es requerida para el cierre (RN-INC-002)". En modo edición, las evidencias existentes se muestran como thumbnails/iconos no eliminables con zona para agregar nuevas. Los handlers MSW `POST /api/incidents` y `PUT /api/incidents/:id` deben aceptar `evidencias` como array de `IncidentEvidencia` ya procesados (no implementar upload real). Los fixtures de incidentes #1 y #2 (ACCIDENTEs) deben incluir 2–3 evidencias mock.

#### Scenario: Thumbnail inline de imagen seleccionada
- **WHEN** el usuario selecciona una imagen JPG o PNG
- **THEN** aparece un thumbnail 80×80 px con botón X para eliminar

#### Scenario: Preview de PDF seleccionado
- **WHEN** el usuario selecciona un archivo PDF
- **THEN** aparece ícono FileText con nombre del archivo y botón X para eliminar

#### Scenario: Nota informativa para tipo ACCIDENTE
- **WHEN** el tipo del incidente es ACCIDENTE
- **THEN** aparece nota informativa bajo el campo de evidencias indicando que la foto es requerida para el cierre (RN-INC-002)

#### Scenario: Sin nota informativa para tipo CUASI_ACCIDENTE
- **WHEN** el tipo del incidente es CUASI_ACCIDENTE
- **THEN** no se muestra nota informativa bajo el campo de evidencias

#### Scenario: Evidencias previas no eliminables en edición
- **WHEN** se abre el formulario de edición de un incidente con evidencias guardadas
- **THEN** las evidencias existentes aparecen como thumbnails/iconos sin botón X y se muestra zona para agregar nuevas
