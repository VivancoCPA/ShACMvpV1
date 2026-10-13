# document-viewer-api

Backend endpoint for the embedded document viewer in M1 Control Documentario. Exposes `GET /api/documents/{id}/visor`, a JWT-authenticated endpoint that returns PDF bytes directly (no signed-token pattern), serving per-state content: a cached, watermarked preview generated from the original file for draft/review states, the existing distribution PDF as-is for published states, and an on-the-fly "OBSOLETO" stamp for obsolete documents.

## Requirements

### Requirement: Endpoint de visor devuelve PDF autenticado según estado
El sistema SHALL exponer `GET /api/documents/{id}/visor`, protegido por `.RequireAuthorization()` (JWT estándar, no un token firmado), devolviendo `application/pdf` con `Content-Disposition: inline`. El contenido servido depende de `Estado`:
- `BORRADOR`, `EN_REVISION`, `EN_APROBACION`: una vista previa generada a partir de `ArchivoOriginalUrl` (ver Requirement "Generación de vista previa con caché").
- `PUBLICADO`, `EN_REVISION_PERIODICA`: el `ArchivoDistribucionUrl` existente, servido tal cual desde disco, sin regenerar.
- `OBSOLETO`: el `ArchivoDistribucionUrl` existente, con el sello "OBSOLETO — No usar" aplicado al vuelo en cada solicitud (sin modificar el archivo en disco).

El endpoint SHALL aplicar primero el aislamiento multi-tenant y `CanAccessByConfidencialidad` (404 uniforme si falla, antes de evaluar cualquier otra regla), y después el permiso por `(Estado, DocRole)` (ver Requirement "Permiso del visor").

#### Scenario: BORRADOR con el docRole AUTOR devuelve 200 con vista previa
- **WHEN** el `docRole AUTOR` de un documento en `BORRADOR` con archivo original solicita `GET /:id/visor`
- **THEN** el sistema responde `200` con `Content-Type: application/pdf` y `Content-Disposition: inline`

#### Scenario: PUBLICADO sirve el PDF de distribución existente sin regenerar
- **WHEN** se solicita `GET /:id/visor` dos veces seguidas sobre un documento `PUBLICADO`
- **THEN** ambas respuestas devuelven el mismo archivo de distribución ya guardado, sin invocar `IDocumentoPdfConverter`

#### Scenario: OBSOLETO devuelve el PDF de distribución con el sello aplicado
- **WHEN** se solicita `GET /:id/visor` sobre un documento `OBSOLETO`
- **THEN** el PDF devuelto contiene el sello "OBSOLETO — No usar" en cada página, y el archivo `ArchivoDistribucionUrl` en disco permanece sin modificar

#### Scenario: Documento de otra empresa responde 404
- **WHEN** un actor con empresa activa distinta solicita `GET /:id/visor` de un documento de otra empresa
- **THEN** el sistema responde `404`, sin distinguir si el documento no existe o pertenece a otra empresa

#### Scenario: CONFIDENCIAL sin rol habilitado responde 404
- **WHEN** un `OPERARIO` solicita `GET /:id/visor` de un documento `CONFIDENCIAL`
- **THEN** el sistema responde `404` (mismo criterio de no revelar existencia que `CanAccessByConfidencialidad` en el resto del módulo)

### Requirement: Permiso del visor reutiliza la matriz real, con la excepción CA-34 para OBSOLETO
El sistema SHALL conceder acceso al visor cuando `DocumentPermissionResolver.GetBasePermissions(estado, docRole).CanRead` es `true`. Para `estado == OBSOLETO` adicionalmente SHALL conceder acceso cuando `DocumentPermissionResolver.CanViewArchivoOriginalConCA34(estado, docRole, actorRolGlobal)` es `true`, incluso si `CanRead` es `false` para ese `docRole` (p.ej. un `ALTA_DIRECCION` o `JEFE_CONTROL_DOCUMENTARIO` cuyo `docRole` resuelto no sea `REVISOR`/`APROBADOR`/`JEFE_CALIDAD`). Fuera de `OBSOLETO`, ningún otro gate adicional aplica — la matriz base es suficiente. Si el gate falla, el sistema SHALL responder con un error de autorización (403), no 404 (el tenant/confidencialidad ya se validó).

**autor-lectura-publicado (2026-10-08, decisión de Toño):** desde esta fecha, `GetBasePermissions` le da `CanRead: true` a `AUTOR` en `PUBLICADO` y en `OBSOLETO` (ver `document-permissions`) — el docRole `AUTOR` ya no necesita la excepción CA-34 para ver su propio documento en ninguno de los dos estados; el `OR` con CA-34 descrito arriba sigue existiendo solo para el caso restante (un `docRole` sin `CanRead`, típicamente `OPERARIO`, con rol global `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION`).

#### Scenario: OPERARIO sin canRead en BORRADOR es rechazado
- **WHEN** un usuario con `docRole OPERARIO` solicita `GET /:id/visor` de un documento en `BORRADOR`
- **THEN** el sistema rechaza el acceso con un error de autorización

#### Scenario: EN_APROBACION permite ver al aprobador asignado
- **WHEN** el `docRole APROBADOR` asignado solicita `GET /:id/visor` de un documento en `EN_APROBACION` con archivo original
- **THEN** el sistema responde `200` con la vista previa generada

#### Scenario: CA-34 permite a ALTA_DIRECCION ver el visor de un OBSOLETO sin ser el docRole asignado
- **WHEN** un usuario con rol global `ALTA_DIRECCION`, cuyo `docRole` resuelto para ese documento es `OPERARIO`, solicita `GET /:id/visor` de un documento `OBSOLETO`
- **THEN** el sistema responde `200` con el PDF sellado "OBSOLETO — No usar"

#### Scenario: Sin CA-34, un OPERARIO sin canRead en OBSOLETO es rechazado
- **WHEN** el `docRole OPERARIO` de un documento `OBSOLETO`, cuyo rol global no es `JEFE_CONTROL_DOCUMENTARIO` ni `ALTA_DIRECCION`, solicita `GET /:id/visor`
- **THEN** el sistema rechaza el acceso con un error de autorización

#### Scenario: AUTOR ve el visor de su propio documento en OBSOLETO sin necesitar CA-34
- **WHEN** el `docRole AUTOR` de un documento `OBSOLETO` solicita `GET /:id/visor`
- **THEN** el sistema responde `200` con el PDF sellado "OBSOLETO — No usar" — `autor-lectura-publicado` (2026-10-08) le da `CanRead: true` en la matriz base para este estado, sin depender de CA-34

### Requirement: Generación de vista previa con caché y bloqueo por clave
Para `Estado ∈ {BORRADOR, EN_REVISION, EN_APROBACION}`, el sistema SHALL:
1. Responder `404` con un mensaje claro ("Este documento aún no tiene archivo para visualizar") si `ArchivoOriginalUrl` es `null`, sin intentar ninguna conversión.
2. Calcular la clave de caché a partir del nombre de archivo ya archivado de `ArchivoOriginalUrl` (asignado por `DocumentoStorageService.GuardarOriginalAsync`, único por cada reemplazo real del original).
3. Adquirir un lock específico de esa clave (no el `SemaphoreSlim` global de `MaxConcurrentConversions`) antes de verificar o generar el archivo de caché, para que dos solicitudes simultáneas sobre la misma versión del original nunca disparen dos conversiones en paralelo.
4. Si el archivo de caché ya existe en disco bajo esa clave, servirlo directamente sin reconvertir.
5. Si no existe, convertir el original con `IDocumentoPdfConverter.ConvertirAsync`, sellarlo con `DocumentoPdfGenerator.SellarVistaPrevia(pdfConvertido, documento)` (marca "VISTA PREVIA — NO CONTROLADO — {ESTADO}" en cada página), guardar el resultado en la caché bajo esa clave, y servirlo.
6. La caché SHALL residir fuera de `wwwroot` (bajo `IWebHostEnvironment.ContentRootPath`, no `WebRootPath`), de forma que `app.UseStaticFiles()` nunca pueda servirla directamente.
7. Si la conversión falla (`PdfConversionException`), el sistema SHALL responder con un error de negocio claro (código `PDF_CONVERSION_FAILED`, nunca `500`) y SHALL registrar el detalle técnico en el log, sin generar ningún archivo de caché parcial.

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
- **WHEN** la conversión del archivo original falla (p.ej. LibreOffice no disponible)
- **THEN** el sistema responde con un error de negocio (`PDF_CONVERSION_FAILED`, no `500`), registra el detalle en el log, y no queda ningún archivo de caché para esa clave

#### Scenario: Dos solicitudes simultáneas de la misma versión no duplican la conversión
- **WHEN** se solicitan dos `GET /:id/visor` en paralelo sobre la misma versión de un documento sin caché previa
- **THEN** `IDocumentoPdfConverter.ConvertirAsync` se invoca una sola vez, y ambas respuestas sirven el mismo resultado

### Requirement: Auditoría VISUALIZACION registrada una sola vez por apertura
Cada apertura exitosa del visor (`200` con contenido) SHALL registrar exactamente una entrada `VISUALIZACION` en el audit trail del documento, con el actor resuelto del JWT de la sesión, de la misma forma que ya hace `ObtenerArchivoHandler` para `GET /:id/archivo` — el endpoint `/visor` registra esta entrada internamente; el frontend SHALL NOT llamar adicionalmente a `POST /:id/audit/access` tras abrir el visor.

#### Scenario: Apertura exitosa registra una entrada VISUALIZACION
- **WHEN** un usuario con acceso abre el visor de un documento
- **THEN** el audit trail del documento gana exactamente una entrada `VISUALIZACION` con el actor real de la sesión

#### Scenario: Apertura rechazada no registra auditoría
- **WHEN** un usuario sin permiso solicita `GET /:id/visor` y recibe un error (403/404)
- **THEN** no se agrega ninguna entrada al audit trail

### Requirement: Nuevos métodos de sellado en DocumentoPdfGenerator
El sistema SHALL agregar dos métodos estáticos a `DocumentoPdfGenerator` (PdfSharpCore, mismo patrón que `SellarPublicado`/`GenerarControlado` — abrir en `PdfDocumentOpenMode.Modify`, dibujar por página, nunca regenerar contenido desde cero):
- `SellarVistaPrevia(byte[] pdfConvertido, Documento documento)`: agrega en cada página el texto "VISTA PREVIA — NO CONTROLADO — {Estado}" (código y versión del documento incluidos, estilo visualmente distinto al sello de publicación — p.ej. banda diagonal o encabezado prominente, no un pie de página discreto, para que sea inconfundible con el PDF de distribución real).
- `SellarObsoleto(byte[] pdfDistribucion)`: agrega en cada página un encabezado prominente en rojo "OBSOLETO — No usar" (RN-DOC-003).

Si PdfSharpCore no puede abrir el PDF de entrada (mismo riesgo ya aceptado para `SellarPublicado`), el sistema SHALL degradar sirviendo el PDF sin sello en vez de fallar con `500`, registrando el error en el log.

#### Scenario: SellarVistaPrevia agrega el texto en cada página
- **WHEN** se llama `SellarVistaPrevia` con un PDF convertido de 3 páginas y un documento en `EN_REVISION`
- **THEN** el PDF resultante tiene 3 páginas, cada una con el texto "VISTA PREVIA — NO CONTROLADO — EN_REVISION"

#### Scenario: SellarObsoleto agrega el encabezado rojo en cada página
- **WHEN** se llama `SellarObsoleto` con un PDF de distribución de 2 páginas
- **THEN** el PDF resultante tiene 2 páginas, cada una con el encabezado "OBSOLETO — No usar" en rojo

#### Scenario: Fallo de sellado degrada sin bloquear la respuesta
- **WHEN** PdfSharpCore no puede abrir el PDF de entrada para sellarlo
- **THEN** el sistema registra el error en el log y sirve el PDF sin sello en vez de responder `500`
