## MODIFIED Requirements

### Requirement: Tipo IncidentEvidencia y campo `evidencias` en schema Zod
El sistema SHALL definir la interfaz `IncidentEvidencia` en `src/features/incidents/types/` con los campos: `id: string`, `url: string`, `nombre: string`, `tipo: 'imagen' | 'pdf'`, `tamanioKb: number`, `creadoEn: string` (ISO 8601), `creadoPor: string`, `descripcion?: string` (texto libre opcional, máx. 140 caracteres, caption de la evidencia). La interfaz `Incidente` SHALL incluir `evidencias?: IncidentEvidencia[]`. El schema Zod SHALL validar `evidencias` como array opcional de `File`: máx 5 archivos, cada archivo máx 10 MB, tipos aceptados `image/jpeg`, `image/png`, `application/pdf`. El schema Zod SHALL validar, para cada archivo nuevo adjuntado, un caption de texto asociado opcional con máximo 140 caracteres — un caption vacío (`''`) SHALL normalizarse a `undefined` antes de construir `IncidentEvidencia`, nunca persistirse como string vacío.

#### Scenario: IncidentEvidencia contiene los campos requeridos
- **WHEN** se define la interfaz IncidentEvidencia
- **THEN** contiene: id, url, nombre, tipo ('imagen'|'pdf'), tamanioKb, creadoEn (ISO 8601), creadoPor, descripcion (opcional)

#### Scenario: Error inline al exceder límite de archivos
- **WHEN** el usuario intenta subir un 6° archivo
- **THEN** el sistema muestra error inline "Máximo 5 archivos permitidos"

#### Scenario: Error inline para archivo mayor a 10 MB
- **WHEN** el usuario selecciona un archivo mayor a 10 MB
- **THEN** el sistema muestra error "El archivo '[nombre]' supera el límite de 10 MB" bajo el campo

#### Scenario: Caption dentro del límite de caracteres
- **WHEN** el usuario escribe un caption de 140 caracteres o menos en el input de texto de una foto adjunta
- **THEN** el sistema acepta el valor sin mostrar error de validación

#### Scenario: Caption excede el límite de caracteres
- **WHEN** el usuario intenta escribir más de 140 caracteres en el caption de una foto adjunta
- **THEN** el sistema muestra un error de validación localizado junto al campo, sin enviar la request

#### Scenario: Caption vacío se normaliza a ausente
- **WHEN** el usuario deja el campo de caption vacío para una foto adjunta y envía el formulario
- **THEN** la `IncidentEvidencia` resultante NO incluye `descripcion` (queda `undefined`), no un string vacío

### Requirement: Zona de carga de evidencias en el bloque Reporte inicial
El formulario SHALL incluir una zona de carga de evidencias inmediatamente después del campo `huboLesionados`, con: input `type="file" multiple accept="image/jpeg,image/png,application/pdf"`, label "Evidencias (fotos / documentos)", vista previa inline (imágenes → thumbnail 80×80 px con ícono X; PDFs → ícono FileText + nombre + ícono X), y límites de 5 archivos máx / 10 MB por archivo. Cada preview de una foto nueva adjuntada (no de una evidencia ya existente en modo edición) SHALL incluir un input de texto de una sola línea para un caption opcional (máx. 140 caracteres), asociado a esa foto específica por posición en el estado del formulario, no por índice recalculado en cada render. Para `tipo = ACCIDENTE`, SHALL mostrar nota informativa: "Para incidentes de tipo Accidente, la evidencia fotográfica es requerida para el cierre (RN-INC-002)". En modo edición, las evidencias existentes se muestran como thumbnails/iconos no eliminables con zona para agregar nuevas, sin input de caption editable sobre esas evidencias existentes. Los handlers MSW `POST /api/incidents` y `PUT /api/incidents/:id` deben aceptar `evidencias` como array de `IncidentEvidencia` ya procesados (no implementar upload real). Los fixtures de incidentes #1 y #2 (ACCIDENTEs) deben incluir 2–3 evidencias mock.

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
- **THEN** las evidencias existentes aparecen como thumbnails/iconos sin botón X y se muestra zona para agregar nuevas, sin input de caption sobre ellas

#### Scenario: Input de caption por foto nueva adjuntada
- **WHEN** el usuario adjunta una foto nueva en el formulario de creación (o agrega una nueva en modo edición)
- **THEN** el thumbnail de esa foto muestra un input de texto para escribir un caption opcional, independiente del campo `descripcion` general del incidente

#### Scenario: Remover foto conserva el caption de las restantes
- **WHEN** el usuario adjunta 3 fotos con captions distintos y elimina la segunda
- **THEN** las fotos restantes conservan su caption original correctamente asociado, sin desplazarse al caption de otra foto
