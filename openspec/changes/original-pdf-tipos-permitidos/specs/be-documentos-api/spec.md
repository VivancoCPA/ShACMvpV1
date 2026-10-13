## ADDED Requirements

### Requirement: Validación de formato del archivo original por tipo de documento (RN-DOC-021)
El sistema SHALL definir, en un único lugar (`DocumentoFormatosPermitidos`), la lista de tipos de documento que aceptan un PDF nativo como archivo original: `INF`, `MAT`, `PLAN`. Para cualquier otro `Tipo` (`POL`, `PRC`, `INS`, `REG`), el archivo original SHALL ser únicamente `.docx` o `.xlsx`.

`POST /api/documents/:id/archivo-original` (tanto en la primera carga tras crear el documento como en cualquier reemplazo posterior) SHALL validar el archivo recibido contra esta lista usando el `Tipo` ya persistido del documento, verificando **tanto la extensión como la firma binaria** de los primeros bytes del archivo: un PDF SHALL comenzar con la secuencia ASCII `%PDF-`; un `.docx`/`.xlsx` SHALL ser una estructura ZIP válida (firma `PK`). Un archivo cuya extensión no coincide con su firma binaria (por ejemplo, un `.docx` renombrado a `.pdf`, o un archivo de texto renombrado a `.pdf`) SHALL ser rechazado igual que un archivo del tipo equivocado. El sistema SHALL responder `400` con un mensaje claro indicando los formatos aceptados para el `Tipo` del documento.

#### Scenario: PDF nativo aceptado para PLAN
- **WHEN** se envía `POST /:id/archivo-original` con un PDF válido sobre un documento `tipo: PLAN`
- **THEN** el sistema acepta el archivo y responde `200` con `archivoOriginalUrl`/`archivoOriginalNombre` actualizados

#### Scenario: PDF rechazado para PRC
- **WHEN** se envía `POST /:id/archivo-original` con un PDF válido sobre un documento `tipo: PRC`
- **THEN** el sistema responde `400` indicando que ese tipo requiere un archivo Word o Excel

#### Scenario: Archivo renombrado con extensión falsa es rechazado
- **WHEN** se envía `POST /:id/archivo-original` con un archivo `.pdf` cuyos primeros bytes no son `%PDF-` (p.ej. un `.docx` renombrado) sobre un documento `tipo: PLAN`
- **THEN** el sistema responde `400`, sin importar que la extensión declarada sea válida para ese tipo

#### Scenario: .docx válido sigue aceptado para cualquier tipo
- **WHEN** se envía `POST /:id/archivo-original` con un `.docx` válido sobre un documento `tipo: PLAN` o `tipo: PRC`
- **THEN** el sistema acepta el archivo en ambos casos

## MODIFIED Requirements

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide.

SHALL rechazar la firma con `BusinessRuleException` (código `SIN_ARCHIVO_ORIGINAL`) si el documento no tiene `ArchivoOriginalUrl`, antes de intentar cualquier conversión — sin generar ningún PDF sustituto.

Si el PIN es válido y hay archivo original, el sistema SHALL determinar si el archivo original es un PDF nativo (por su extensión real) o un archivo Office (`.docx`/`.xlsx`). Si es un archivo Office, SHALL convertirlo a PDF (`IDocumentoPdfConverter`, ver capacidad `document-pdf-conversion`) exactamente como hoy. Si es un PDF nativo, SHALL usar sus bytes directamente como entrada de `DocumentoPdfGenerator.SellarPublicado`, sin invocar `IDocumentoPdfConverter`. En ambos casos, el sistema SHALL sellar el resultado con los metadatos de publicación en cada página y calcular su hash SHA-256, **antes** de aplicar ningún cambio de estado o persistencia.

Si la conversión (archivo Office) falla, el sistema SHALL responder con `BusinessRuleException` (código `PDF_CONVERSION_FAILED`, no un error 500 genérico) y SHALL NOT modificar el estado del documento, la versión previa, ni crear ningún archivo o entrada de audit trail — sin cambios respecto al comportamiento actual.

Si el original es un PDF nativo y `PdfSharpCore` no puede abrirlo para sellarlo (protegido con contraseña o corrupto), el sistema SHALL responder con `BusinessRuleException` (código `PDF_PROTEGIDO_O_DANADO`, no un error 500 genérico) y SHALL NOT modificar el estado del documento, la versión previa, ni crear ningún archivo o entrada de audit trail. Esto es distinto del caso ya aceptado de un PDF *convertido* por LibreOffice que `PdfSharpCore` no logra abrir (incompatibilidad rara de la salida del conversor): ese caso SHALL seguir degradando a "publicado sin sello" sin bloquear la operación, porque el PDF de entrada en ese camino es siempre un archivo bien formado generado por el propio sistema. La distinción entre ambos casos SHALL basarse en si el PDF de entrada vino de una conversión (`IDocumentoPdfConverter`) o directamente del archivo original subido por el usuario.

Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; persistir el PDF de distribución ya convertido (o ya nativo) y sellado; registrar el hash SHA-256 del archivo publicado como `ValorNuevo` de la entrada `FIRMA_REGISTRADA` del audit trail.

#### Scenario: Firma exitosa publica y obsoletiza la versión previa
- **WHEN** el aprobador asignado firma con su PIN correcto un documento en `EN_APROBACION` con archivo original, cuyo código ya tiene otra versión `PUBLICADO`
- **THEN** el sistema responde `200` con el documento actual en `PUBLICADO`, la versión previa pasa a `OBSOLETO`, y se genera y persiste el PDF de distribución con el contenido real del archivo original

#### Scenario: Firma rechazada si el actor no es el aprobador asignado
- **WHEN** un usuario distinto del `AprobadorId` del documento intenta `POST /:id/sign`
- **THEN** el sistema responde con un error de autorización, sin publicar el documento

#### Scenario: PIN incorrecto no publica
- **WHEN** el aprobador asignado envía un `pin` que no coincide con su `PinHash`
- **THEN** el sistema responde `401` sin cambiar el estado

#### Scenario: Actor sin PIN configurado
- **WHEN** el aprobador asignado nunca configuró su PIN (`PinHash` nulo)
- **THEN** el sistema responde con un mensaje de negocio indicando que debe configurar su PIN primero, sin error genérico

#### Scenario: Firma rechazada por falta de archivo original
- **WHEN** el aprobador asignado firma con PIN correcto un documento en `EN_APROBACION` cuyo `ArchivoOriginalUrl` es `null`
- **THEN** el sistema responde con un error de negocio (código `SIN_ARCHIVO_ORIGINAL`), el documento permanece en `EN_APROBACION`, y no se genera ningún PDF

#### Scenario: Fallo de conversión no publica nada
- **WHEN** el aprobador asignado firma con PIN correcto un documento con archivo original Office, pero la conversión a PDF falla (p.ej. el conversor no está disponible)
- **THEN** el sistema responde con un error de negocio (código `PDF_CONVERSION_FAILED`, no `500`), el documento permanece en `EN_APROBACION`, la versión previa `PUBLICADO` (si existía) no cambia de estado, y no queda ningún archivo de distribución nuevo ni entradas de audit trail de la firma

#### Scenario: El hash del archivo publicado queda en el audit trail
- **WHEN** la firma se completa exitosamente
- **THEN** la entrada `FIRMA_REGISTRADA` del audit trail tiene `ValorNuevo` igual al SHA-256 del PDF de distribución guardado

#### Scenario: Firma de un PLAN con original PDF nativo publica sin invocar el conversor
- **WHEN** el aprobador asignado firma con PIN correcto un documento `tipo: PLAN` cuyo archivo original es un PDF nativo válido
- **THEN** el sistema responde `200`, el documento queda `PUBLICADO`, el PDF de distribución tiene el sello de publicación, el hash queda registrado, y `IDocumentoPdfConverter.ConvertirAsync` no se invoca

#### Scenario: Firma de un PLAN con PDF nativo protegido no publica nada
- **WHEN** el aprobador asignado firma con PIN correcto un documento `tipo: PLAN` cuyo archivo original es un PDF cifrado con contraseña
- **THEN** el sistema responde con un error de negocio (código `PDF_PROTEGIDO_O_DANADO`, no `500`), el documento permanece en `EN_APROBACION`, y no queda ningún archivo de distribución nuevo ni entradas de audit trail de la firma

### Requirement: Archivo original editable (RN-DOC-013, RN-DOC-015, RN-DOC-016, RN-DOC-018, CA-34)
El sistema SHALL exponer `GET /api/documents/:id/archivo-original` (descarga binaria real desde disco), permitido si `docRole != OPERARIO` y `estado ∈ {BORRADOR, EN_REVISION}`, **o** si el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` y `estado == OBSOLETO` (CA-34, excepción de trazabilidad histórica). SHALL exponer `POST /api/documents/:id/archivo-original` (multipart, campo `archivoOriginal`) para reemplazar el original (o realizar la primera carga tras la creación), permitido solo si `docRole ∈ {AUTOR, JEFE_CALIDAD}`, `estado ∈ {BORRADOR, EN_REVISION}` y `!ArchivoOriginalBloqueado` — validación de `docRole` que el mock no aplicaba en el POST. El archivo recibido SHALL validarse contra los formatos permitidos para el `Tipo` del documento (ver Requirement "Validación de formato del archivo original por tipo de documento (RN-DOC-021)") antes de guardarse. El archivo reemplazado SHALL archivarse con timestamp (no se sobreescribe ni se borra), preservando la trazabilidad.

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

#### Scenario: Reemplazo rechazado por formato no permitido para el tipo
- **WHEN** el `docRole AUTOR` de un documento `tipo: PRC` en `BORRADOR` intenta `POST /:id/archivo-original` con un PDF
- **THEN** el sistema rechaza el reemplazo con `400`, sin tocar el archivo original existente
