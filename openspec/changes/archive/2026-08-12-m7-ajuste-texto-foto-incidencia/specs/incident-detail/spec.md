## MODIFIED Requirements

### Requirement: Bloque "Descripción del evento" con datos del reporte
La sección de detalle SHALL incluir un bloque "Descripción del evento" (expandido por defecto) con: `descripcion`, indicador de lesionados y número si aplica, `condicionesEntorno` como badges, `equiposInvolucrados` / `personalInvolucrado` / `testigos` cuando tienen valor, y `atencionMedicaRequerida` + `descripcionAtencionMedica` si aplica. Si `informeMedicoAdjunto` existe, se muestra como enlace de descarga con ícono FileText. Después de `condicionesEntorno`, SHALL renderizar un sub-bloque "Evidencias adjuntas" (solo si `incidente.evidencias?.length > 0`) con ícono Paperclip, grid de thumbnails 80×80 px para imágenes, y lista de PDFs con ícono FileText + nombre + peso en KB. Cuando una evidencia de imagen tiene `descripcion` (caption), SHALL mostrarse como texto pequeño bajo su thumbnail, truncado a 2 líneas si excede el ancho disponible; el `alt` del thumbnail SHALL seguir siendo `nombre` del archivo, no el caption. Si `tipo = ACCIDENTE` y no hay evidencias, SHALL mostrar alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)".

#### Scenario: Descripción completa visible
- **WHEN** se carga el detalle de un incidente con todos los campos de descripción
- **THEN** todos los campos con valor se muestran en el bloque

#### Scenario: condicionesEntorno como badges
- **WHEN** el incidente tiene `condicionesEntorno = ['ILUMINACION', 'EPP']`
- **THEN** cada condición se muestra como un badge individual

#### Scenario: Enlace de informe médico
- **WHEN** el incidente tiene `informeMedicoAdjunto` con URL
- **THEN** se muestra un enlace de descarga con ícono FileText y texto "Informe médico"

#### Scenario: Sub-bloque de evidencias para incidente con fotos
- **WHEN** el incidente tiene `evidencias` con al menos 1 elemento
- **THEN** se muestra el sub-bloque "Evidencias adjuntas" con ícono Paperclip, thumbnails 80×80 px para imágenes y lista de PDFs con nombre y peso en KB

#### Scenario: Lightbox al hacer clic en thumbnail de evidencia
- **WHEN** el usuario hace clic en un thumbnail de imagen en el sub-bloque de evidencias
- **THEN** se abre un lightbox con overlay oscuro mostrando la imagen a tamaño completo con botón cerrar

#### Scenario: Alerta amarilla para ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = ACCIDENTE` y `evidencias` está vacío o ausente
- **THEN** se muestra una alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)"

#### Scenario: Sin alerta para CUASI_ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = CUASI_ACCIDENTE` y no tiene evidencias
- **THEN** no se muestra ninguna alerta amarilla

#### Scenario: Evidencia con caption muestra el texto bajo el thumbnail
- **WHEN** una evidencia de imagen tiene `descripcion` definida
- **THEN** el texto de `descripcion` se muestra bajo su thumbnail de 80×80 px, sin reemplazar el `alt` del thumbnail (que sigue siendo el nombre del archivo)

#### Scenario: Evidencia sin caption no muestra texto adicional
- **WHEN** una evidencia de imagen no tiene `descripcion`
- **THEN** su thumbnail se muestra igual que hoy, sin ningún texto adicional debajo
