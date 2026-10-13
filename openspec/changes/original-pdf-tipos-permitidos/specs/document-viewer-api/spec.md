## MODIFIED Requirements

### Requirement: Generación de vista previa con caché y bloqueo por clave
Para `Estado ∈ {BORRADOR, EN_REVISION, EN_APROBACION}`, el sistema SHALL:
1. Responder `404` con un mensaje claro ("Este documento aún no tiene archivo para visualizar") si `ArchivoOriginalUrl` es `null`, sin intentar ninguna conversión.
2. Calcular la clave de caché a partir del nombre de archivo ya archivado de `ArchivoOriginalUrl` (asignado por `DocumentoStorageService.GuardarOriginalAsync`, único por cada reemplazo real del original).
3. Adquirir un lock específico de esa clave (no el `SemaphoreSlim` global de `MaxConcurrentConversions`) antes de verificar o generar el archivo de caché, para que dos solicitudes simultáneas sobre la misma versión del original nunca disparen dos conversiones en paralelo.
4. Si el archivo de caché ya existe en disco bajo esa clave, servirlo directamente sin reconvertir.
5. Si no existe, determinar si el archivo original es un PDF nativo (por su extensión real) o un archivo Office (`.docx`/`.xlsx`). Si es Office, convertir con `IDocumentoPdfConverter.ConvertirAsync` como hoy. Si es un PDF nativo, usar sus bytes directamente, sin invocar `IDocumentoPdfConverter`. En ambos casos, sellar el resultado con `DocumentoPdfGenerator.SellarVistaPrevia(pdfBase, documento)` (marca "VISTA PREVIA — NO CONTROLADO — {ESTADO}" en cada página), guardar el resultado en la caché bajo esa clave, y servirlo.
6. La caché SHALL residir fuera de `wwwroot` (bajo `IWebHostEnvironment.ContentRootPath`, no `WebRootPath`), de forma que `app.UseStaticFiles()` nunca pueda servirla directamente.
7. Si la conversión de un archivo Office falla (`PdfConversionException`), el sistema SHALL responder con un error de negocio claro (código `PDF_CONVERSION_FAILED`, nunca `500`) y SHALL registrar el detalle técnico en el log, sin generar ningún archivo de caché parcial — sin cambios respecto al comportamiento actual.
8. Si el original es un PDF nativo y `PdfSharpCore` no puede abrirlo para generar la vista previa (protegido con contraseña o corrupto), el sistema SHALL responder con un error de negocio claro (código `PDF_PROTEGIDO_O_DANADO`, nunca `500`), sin generar ningún archivo de caché parcial. Esto es distinto del fallo de sellado ya aceptado sobre un PDF convertido por LibreOffice (ver Requirement "Nuevos métodos de sellado en DocumentoPdfGenerator"), que sigue degradando a "vista previa sin sello" sin bloquear la respuesta.

Cuando se reemplaza el archivo original de un documento (`ReemplazarArchivoOriginalHandler`), la clave de caché cambia automáticamente (nuevo nombre archivado) — la entrada de caché de la versión anterior del original queda huérfana (no se borra activamente; mismo criterio de no destruir evidencia que ya aplica a los archivos originales reemplazados) y la siguiente apertura del visor genera una entrada nueva.

#### Scenario: Primera apertura genera y cachea la vista previa
- **WHEN** se solicita `GET /:id/visor` por primera vez sobre un documento `EN_REVISION` con archivo original `.docx`
- **THEN** el sistema invoca `IDocumentoPdfConverter`, sella el resultado con "VISTA PREVIA — NO CONTROLADO — EN_REVISION", lo guarda en caché fuera de `wwwroot`, y lo devuelve

#### Scenario: Segunda apertura usa la caché sin reconvertir
- **WHEN** se solicita `GET /:id/visor` una segunda vez sobre el mismo documento sin cambios
- **THEN** el sistema sirve el archivo de caché existente sin invocar `IDocumentoPdfConverter` de nuevo

#### Scenario: Reemplazar el original invalida la caché anterior
- **WHEN** se reemplaza el archivo original de un documento y luego se solicita `GET /:id/visor`
- **THEN** el sistema genera una vista previa nueva a partir del archivo reemplazado, sin servir la caché de la versión anterior

#### Scenario: Documento sin archivo original responde 404 claro
- **WHEN** se solicita `GET /:id/visor` sobre un documento en `BORRADOR` cuyo `ArchivoOriginalUrl` es `null`
- **THEN** el sistema responde `404` con un mensaje indicando que el documento aún no tiene archivo para visualizar, sin intentar ninguna conversión

#### Scenario: Fallo de conversión no genera un 500 ni una caché parcial
- **WHEN** la conversión del archivo original Office falla (p.ej. LibreOffice no disponible)
- **THEN** el sistema responde con un error de negocio (`PDF_CONVERSION_FAILED`, no `500`), registra el detalle en el log, y no queda ningún archivo de caché para esa clave

#### Scenario: Dos solicitudes simultáneas de la misma versión no duplican la conversión
- **WHEN** se solicitan dos `GET /:id/visor` en paralelo sobre la misma versión de un documento sin caché previa
- **THEN** `IDocumentoPdfConverter.ConvertirAsync` se invoca una sola vez, y ambas respuestas sirven el mismo resultado

#### Scenario: Original PDF nativo genera la vista previa sin invocar el conversor
- **WHEN** se solicita `GET /:id/visor` sobre un documento `tipo: PLAN` en `EN_REVISION` con archivo original PDF nativo
- **THEN** el sistema responde `200` con la marca "VISTA PREVIA — NO CONTROLADO — EN_REVISION", y `IDocumentoPdfConverter.ConvertirAsync` no se invoca

#### Scenario: Original PDF nativo protegido responde con error de negocio, no 500
- **WHEN** se solicita `GET /:id/visor` sobre un documento con archivo original PDF nativo cifrado con contraseña
- **THEN** el sistema responde con un error de negocio (código `PDF_PROTEGIDO_O_DANADO`, no `500`), y no queda ningún archivo de caché para esa clave
