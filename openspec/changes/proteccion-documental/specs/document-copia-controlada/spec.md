## ADDED Requirements

### Requirement: La copia controlada es la única descarga de un documento vigente (RN-DOC-007, decisión de Toño)
El sistema SHALL NOT exponer ningún endpoint que entregue el PDF maestro de un documento sin marca de agua para descarga. `GET /:id/archivo-distribucion` SHALL dejar de existir. `POST /:id/exportar-pdf` (`ExportarPdfControladoHandler`) SHALL ser la única vía de descarga de un documento vigente, sirviendo siempre el PDF con marca de agua (usuario, fecha, "COPIA NO CONTROLADA").

#### Scenario: El endpoint de descarga directa del maestro no existe
- **WHEN** se solicita `GET /:id/archivo-distribucion`
- **THEN** el sistema responde `404` (ruta no registrada)

#### Scenario: Exportar PDF controlado es la única descarga disponible para un documento PUBLICADO
- **WHEN** un lector con acceso solicita descargar un documento `PUBLICADO`
- **THEN** la única acción disponible es `POST /:id/exportar-pdf`, que devuelve el PDF con marca de agua

### Requirement: Exportar PDF controlado valida confidencialidad y CanRead (antes solo validaba tenant y estado)
`POST /:id/exportar-pdf` SHALL validar, en este orden: (1) aislamiento multi-tenant (`404` si el documento no pertenece a la empresa activa del actor), (2) `CanAccessByConfidencialidad` (`404` uniforme si falla), (3) `DocumentPermissionResolver.GetPermissions(estado, docRole).CanRead` (`403` si falla), (4) `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}` (error de negocio si no).

#### Scenario: CONFIDENCIAL sin rol habilitado responde 404
- **WHEN** un `OPERARIO` solicita `POST /:id/exportar-pdf` de un documento `CONFIDENCIAL` `PUBLICADO`
- **THEN** el sistema responde `404`

#### Scenario: Sin CanRead responde 403
- **WHEN** un `docRole` sin `CanRead` para el estado del documento solicita `POST /:id/exportar-pdf`
- **THEN** el sistema responde `403`

#### Scenario: OBSOLETO no permite exportar
- **WHEN** se solicita `POST /:id/exportar-pdf` de un documento `OBSOLETO`
- **THEN** el sistema responde con un error de negocio, sin generar ningún PDF

### Requirement: Exportar PDF controlado ahora permite EN_REVISION_PERIODICA (antes solo PUBLICADO)
`POST /:id/exportar-pdf` SHALL permitir la exportación cuando `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}` — el documento sigue vigente durante su revisión periódica.

#### Scenario: EN_REVISION_PERIODICA permite exportar la copia controlada
- **WHEN** un lector con acceso solicita `POST /:id/exportar-pdf` de un documento `EN_REVISION_PERIODICA`
- **THEN** el sistema responde `200` con el PDF con marca de agua

### Requirement: Restricciones de copia e impresión en la copia controlada (RN-DOC-010)
El PDF generado por `POST /:id/exportar-pdf` SHALL aplicar `SecuritySettings` (PdfSharpCore) que deshabilitan la extracción/copia de texto para cualquier rol, y permiten la impresión únicamente cuando el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`. Estas restricciones SHALL documentarse como disuasorias, no como protección absoluta — un lector de PDF puede ignorarlas; el control de acceso real es el del endpoint.

#### Scenario: Copia de texto deshabilitada para cualquier rol
- **WHEN** se genera la copia controlada para cualquier actor con acceso
- **THEN** el PDF resultante tiene `PermitExtractContent = false`

#### Scenario: Impresión habilitada solo para JEFE_CONTROL_DOCUMENTARIO
- **WHEN** `JEFE_CONTROL_DOCUMENTARIO` descarga la copia controlada
- **THEN** el PDF resultante permite impresión (`PermitPrint = true`)

#### Scenario: Impresión deshabilitada para otros roles
- **WHEN** un `OPERARIO` o `SUPERVISOR` descarga la copia controlada
- **THEN** el PDF resultante tiene `PermitPrint = false`

### Requirement: Circuito de URL firmada (archivo/stream/download-url/audit-access) retirado — RN-DOC-009 sin URL intermedia
El sistema SHALL NOT exponer `GET /:id/archivo`, `GET /stream/{token}`, `GET /:id/download-url` ni `POST /:id/audit/access` — confirmado que ninguno tiene un consumidor real en producción: el botón "Ver archivo" (gateado por `documento.archivoUrl`, nunca poblado por el backend real) no se renderiza nunca; `download-url`/`audit/access` son la misma familia de código muerto del flujo mock-era `document-pdf-security`, sin ningún componente real que los importe. Toda descarga/visualización de contenido de un documento SHALL pasar por un endpoint autenticado por request (`archivo-original`, `visor`, `exportar-pdf`), sin ninguna URL de archivo intermedia expuesta al cliente, y cada uno de esos tres registra su propia entrada de audit trail inline — nunca delegado a un endpoint genérico separado.

#### Scenario: El endpoint de URL firmada no existe
- **WHEN** se solicita `GET /:id/archivo`
- **THEN** el sistema responde `404` (ruta no registrada)

#### Scenario: El endpoint de stream no existe
- **WHEN** se solicita `GET /api/documents/stream/{cualquier-token}`
- **THEN** el sistema responde `404` (ruta no registrada)

#### Scenario: El endpoint de download-url no existe
- **WHEN** se solicita `GET /:id/download-url`
- **THEN** el sistema responde `404` (ruta no registrada)

#### Scenario: El endpoint genérico de audit/access no existe
- **WHEN** se solicita `POST /:id/audit/access`
- **THEN** el sistema responde `404` (ruta no registrada)
