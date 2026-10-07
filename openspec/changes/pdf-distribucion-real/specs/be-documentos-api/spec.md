## MODIFIED Requirements

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide.

SHALL rechazar la firma con `BusinessRuleException` (código `SIN_ARCHIVO_ORIGINAL`) si el documento no tiene `ArchivoOriginalUrl`, antes de intentar cualquier conversión — sin generar ningún PDF sustituto.

Si el PIN es válido y hay archivo original, el sistema SHALL convertir el archivo original a PDF (`IDocumentoPdfConverter`, ver capacidad `document-pdf-conversion`), sellar el resultado con los metadatos de publicación en cada página, y calcular su hash SHA-256, **antes** de aplicar ningún cambio de estado o persistencia. Si la conversión o el sellado fallan, el sistema SHALL responder con `BusinessRuleException` (código `PDF_CONVERSION_FAILED`, no un error 500 genérico) y SHALL NOT modificar el estado del documento, la versión previa, ni crear ningún archivo o entrada de audit trail.

Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; persistir el PDF de distribución ya convertido y sellado; registrar el hash SHA-256 del archivo publicado como `ValorNuevo` de la entrada `FIRMA_REGISTRADA` del audit trail.

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
- **WHEN** el aprobador asignado firma con PIN correcto un documento con archivo original, pero la conversión a PDF falla (p.ej. el conversor no está disponible)
- **THEN** el sistema responde con un error de negocio (código `PDF_CONVERSION_FAILED`, no `500`), el documento permanece en `EN_APROBACION`, la versión previa `PUBLICADO` (si existía) no cambia de estado, y no queda ningún archivo de distribución nuevo ni entradas de audit trail de la firma

#### Scenario: El hash del archivo publicado queda en el audit trail
- **WHEN** la firma se completa exitosamente
- **THEN** la entrada `FIRMA_REGISTRADA` del audit trail tiene `ValorNuevo` igual al SHA-256 del PDF de distribución guardado

### Requirement: PDF de distribución
El sistema SHALL exponer `GET /api/documents/:id/archivo-distribucion` (descarga binaria del PDF ya generado al momento de la firma), accesible a cualquier actor con `canRead` base y `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}`, sin gate adicional de asignación. El sistema SHALL NOT regenerar el PDF en cada solicitud — solo lo sirve desde disco.

El PDF de distribución generado al firmar SHALL contener el contenido real del archivo original (`.docx`/`.xlsx`), convertido a PDF, con un sello aplicado en cada página indicando código, versión, "PUBLICADO", fecha de emisión, nombre del aprobador que firmó, y "Página X de N" — sin la marca de agua de copia, que es exclusiva del PDF controlado exportado bajo demanda.

#### Scenario: OPERARIO puede descargar el PDF de distribución de un documento PUBLICADO
- **WHEN** un `OPERARIO` con acceso de lectura solicita `GET /:id/archivo-distribucion` de un documento `PUBLICADO`
- **THEN** el sistema responde con el PDF ya generado

#### Scenario: Solicitudes repetidas no regeneran el PDF
- **WHEN** se solicita `GET /:id/archivo-distribucion` dos veces seguidas
- **THEN** ambas respuestas sirven el mismo archivo físico, sin regenerar contenido

#### Scenario: El PDF de distribución contiene el contenido real del documento
- **WHEN** se firma y publica un documento cuyo archivo original es un `.docx` con contenido de varias páginas
- **THEN** el PDF de distribución resultante tiene ese mismo contenido, con el sello de publicación visible en cada página

### Requirement: Exportación de PDF controlado (RN-DOC-007)
El sistema SHALL exponer `POST /api/documents/:id/exportar-pdf`, permitido solo si `estado == PUBLICADO`, generando de forma síncrona un PDF real a partir del PDF de distribución ya guardado (nunca una página nueva de metadatos), con marca de agua visible agregada en cada página: nombre completo del usuario descargante, timestamp en zona horaria de Lima (GMT-5), hash SHA-256, y la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión". SHALL registrar una entrada `DESCARGA` en el audit trail del documento.

#### Scenario: Exportación exitosa incluye marca de agua
- **WHEN** se exporta el PDF controlado de un documento `PUBLICADO`
- **THEN** el PDF generado incluye el nombre del usuario, el timestamp de Lima, y la leyenda de copia no controlada en cada página, y el audit trail gana una entrada `DESCARGA`

#### Scenario: Exportación rechazada fuera de PUBLICADO
- **WHEN** se solicita `POST /:id/exportar-pdf` sobre un documento en `BORRADOR`
- **THEN** el sistema rechaza la exportación

#### Scenario: El PDF controlado conserva el contenido real y la cantidad de páginas
- **WHEN** se exporta el PDF controlado de un documento cuyo PDF de distribución tiene 3 páginas de contenido real
- **THEN** el PDF controlado resultante tiene las mismas 3 páginas, cada una con la marca de agua agregada
