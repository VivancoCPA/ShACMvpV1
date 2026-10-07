## ADDED Requirements

### Requirement: CORS expone Content-Disposition para descargas de archivo
La política CORS `ShacFrontend` SHALL incluir `Content-Disposition` en sus headers de respuesta expuestos (`WithExposedHeaders`), para que el frontend (origen distinto en desarrollo) pueda leer ese header desde JavaScript en las respuestas de `GET /:id/archivo-original`, `GET /:id/archivo-distribucion` y `POST /:id/exportar-pdf`. Sin este header expuesto, el navegador oculta `Content-Disposition` al código JS aunque el servidor lo envíe, y cualquier parseo del lado del cliente siempre encuentra un valor vacío.

#### Scenario: Content-Disposition visible desde JavaScript en origen distinto
- **WHEN** el frontend en `http://localhost:5173` solicita `GET /:id/archivo-original` al backend en `http://localhost:5072`
- **THEN** `response.headers['content-disposition']` no está vacío en el cliente

### Requirement: Test de integración de CORS para descargas
El sistema SHALL tener un test de integración que verifique que una petición con `Origin: http://localhost:5173` a un endpoint de descarga de Documentos recibe `Access-Control-Expose-Headers: Content-Disposition` en la respuesta.

#### Scenario: Header de exposición presente para el origen del frontend
- **WHEN** se envía `GET /api/documents/:id/archivo-original` con `Origin: http://localhost:5173`
- **THEN** la respuesta incluye `Access-Control-Expose-Headers` con `Content-Disposition` entre sus valores

## MODIFIED Requirements

### Requirement: Archivo original editable (RN-DOC-013, RN-DOC-015, RN-DOC-016, RN-DOC-018, CA-34)
El sistema SHALL exponer `GET /api/documents/:id/archivo-original` (descarga binaria real desde disco), permitido si `docRole != OPERARIO` y `estado ∈ {BORRADOR, EN_REVISION}`, **o** si el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` y `estado == OBSOLETO` (CA-34, excepción de trazabilidad histórica). SHALL exponer `POST /api/documents/:id/archivo-original` (multipart, campo `archivoOriginal`) para reemplazar el original, permitido solo si `docRole ∈ {AUTOR, JEFE_CALIDAD}`, `estado ∈ {BORRADOR, EN_REVISION}` y `!ArchivoOriginalBloqueado` — validación de `docRole` que el mock no aplicaba en el POST. El archivo reemplazado SHALL archivarse con timestamp (no se sobreescribe ni se borra), preservando la trazabilidad.

La respuesta de `GET /:id/archivo-original` SHALL usar el `Content-Type` real correspondiente a la extensión de `ArchivoOriginalNombre` (resuelto vía `FileExtensionContentTypeProvider`, p.ej. `application/vnd.openxmlformats-officedocument.wordprocessingml.document` para `.docx`), en vez de `application/octet-stream` fijo. Si la extensión no se reconoce, SHALL usar `application/octet-stream` como fallback.

#### Scenario: Autor descarga el original en BORRADOR
- **WHEN** el `docRole AUTOR` de un documento en `BORRADOR` solicita `GET /:id/archivo-original`
- **THEN** el sistema responde con el archivo binario real

#### Scenario: OPERARIO no puede ver el original aunque el documento esté en BORRADOR
- **WHEN** un usuario con `docRole OPERARIO` solicita `GET /:id/archivo-original` de un documento en `BORRADOR`
- **THEN** el sistema rechaza el acceso

#### Scenario: CA-34 permite a JEFE_CONTROL_DOCUMENTARIO ver el original de un OBSOLETO
- **WHEN** un usuario con rol global `JEFE_CONTROL_DOCUMENTARIO` solicita `GET /:id/archivo-original` de un documento `OBSOLETO` del cual no es `docRole` asignado
- **THEN** el sistema responde con el archivo binario real

#### Scenario: Reemplazo rechazado por docRole insuficiente
- **WHEN** un usuario con `docRole REVISOR` intenta `POST /:id/archivo-original`
- **THEN** el sistema rechaza el reemplazo, incluso si el estado es `BORRADOR`

#### Scenario: Reemplazo rechazado por congelamiento
- **WHEN** el `docRole AUTOR` intenta `POST /:id/archivo-original` con `ArchivoOriginalBloqueado: true`
- **THEN** el sistema rechaza el reemplazo

#### Scenario: El archivo anterior se archiva, no se borra
- **WHEN** se reemplaza exitosamente el archivo original
- **THEN** el archivo físico anterior permanece accesible en disco bajo un nombre con timestamp, no se elimina

#### Scenario: Content-Type real para un .docx
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` termina en `.docx`
- **THEN** la respuesta tiene `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`

#### Scenario: Content-Type real para un .xlsx
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` termina en `.xlsx`
- **THEN** la respuesta tiene `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

#### Scenario: Content-Disposition con nombre no-ASCII usa filename*
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` contiene tildes o espacios (p.ej. "Procedimiento de Inspección.docx")
- **THEN** la respuesta incluye `Content-Disposition` con un valor `filename*=UTF-8''...` codificado correctamente, además del `filename=` ASCII de respaldo
