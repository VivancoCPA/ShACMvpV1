## MODIFIED Requirements

### Requirement: Bloque "Descripción del evento" con datos del reporte
La sección de detalle SHALL incluir un bloque "Descripción del evento" (expandido por defecto) con: `descripcion`, indicador de lesionados y número si aplica, `condicionesEntorno` como badges, `equiposInvolucrados` / `personalInvolucrado` / `testigos` cuando tienen valor, y `atencionMedicaRequerida` + `descripcionAtencionMedica` si aplica. (`informeMedicoAdjunto`/el enlace de informe médico no se modifican en este change — confirmado que el campo no existe en el backend real, nunca se puebla, y el enlace nunca se renderiza en producción; fuera de alcance retirarlo, ver `private-file-storage`.) Después de `condicionesEntorno`, SHALL renderizar un sub-bloque "Evidencias adjuntas" (solo si `incidente.evidencias?.length > 0`) con ícono Paperclip, grid de thumbnails 80×80 px para imágenes, y lista de PDFs con ícono FileText + nombre + peso en KB. Cada evidencia (imagen o PDF) SHALL cargarse vía `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo` (autenticado, `private-file-storage`) en vez de usar `ev.url` directamente como `src`/`href` — el `<img>` del thumbnail y el `<a>` de descarga de PDF SHALL resolver un object URL (`URL.createObjectURL`) a partir del blob obtenido, revocado al desmontar. Cuando una evidencia de imagen tiene `descripcion` (caption), SHALL mostrarse como texto pequeño bajo su thumbnail, truncado a 2 líneas si excede el ancho disponible; el `alt` del thumbnail SHALL seguir siendo `nombre` del archivo, no el caption. Si `tipo = ACCIDENTE` y no hay evidencias, SHALL mostrar alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)".

#### Scenario: Sub-bloque de evidencias para incidente con fotos
- **WHEN** el incidente tiene `evidencias` con al menos 1 elemento
- **THEN** cada thumbnail se carga vía una petición autenticada a `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo`, no desde `ev.url` directamente

#### Scenario: Lightbox al hacer clic en thumbnail de evidencia
- **WHEN** el usuario hace clic en un thumbnail de imagen en el sub-bloque de evidencias
- **THEN** el lightbox se abre mostrando el mismo object URL ya resuelto para el thumbnail, sin hacer una segunda solicitud

#### Scenario: Alerta amarilla para ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = ACCIDENTE` y `evidencias` está vacío o ausente
- **THEN** se muestra una alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)"

#### Scenario: Sin alerta para CUASI_ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = CUASI_ACCIDENTE` y no tiene evidencias
- **THEN** no se muestra ninguna alerta de evidencia faltante

#### Scenario: Caption visible bajo el thumbnail cuando existe descripción
- **WHEN** una evidencia de imagen tiene `descripcion` definida
- **THEN** el texto de `descripcion` se muestra bajo el thumbnail, truncado a 2 líneas, sin afectar el `alt` (que sigue siendo `nombre`)

#### Scenario: Sin caption cuando no hay descripción
- **WHEN** una evidencia de imagen no tiene `descripcion`
- **THEN** no se muestra ningún texto bajo el thumbnail
