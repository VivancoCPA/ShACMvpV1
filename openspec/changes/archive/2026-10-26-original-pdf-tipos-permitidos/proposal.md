## Why

Toño necesita publicar un Plan que solo existe como PDF nativo (sin editable). Hoy el sistema no lo permite: `FileUploadField` (variante `original`) solo acepta `.docx`/`.xlsx` para cualquier tipo de documento, y ni `CrearDocumentoHandler` ni `ReemplazarArchivoOriginalHandler` validan el formato en el servidor — la única restricción real vive en el frontend. Esto contradice RN-DOC-017 y CA-33 del PRD (ADD-02), que ya contemplan un documento publicado "solo con PDF nativo, sin editable". Además, `FirmarPublicarDocumentoHandler` y `VisualizarDocumentoHandler` siempre invocan `IDocumentoPdfConverter` (LibreOffice) sobre el archivo original antes de sellarlo — si el original ya es un PDF, esa conversión es innecesaria y, si el PDF está protegido/dañado, el fallo de `PdfReader.Open` (PdfSharpCore) dentro de `DocumentoPdfGenerator.SellarPublicado`/`SellarVistaPrevia` hoy se degrada en silencio (se publica/previsualiza sin sello) en vez de informarlo con claridad.

## What Changes

- Permitir PDF nativo como archivo original, en la misma zona de carga que Word/Excel (sin un segundo camino de carga para el "PDF de distribución", que sigue siendo exclusivamente generado por el sistema).
- Restringir el PDF nativo únicamente a los tipos `INF`, `MAT` y `PLAN`. `POL`, `PRC`, `INS` y `REG` siguen aceptando solo `.docx`/`.xlsx`. La lista vive en un solo lugar en cada capa (backend: `DocumentoFormatosPermitidos.TiposConOriginalPdf`; frontend: `TIPOS_CON_ORIGINAL_PDF` en `constants.ts`), igual que el patrón ya usado por `DOCUMENT_ASIGNACION_ELIGIBLE_ROLES`/`DocumentoAsignacionRoles`.
- **Backend — validación real de formato (nueva, RN-DOC-021):** `POST /api/documents/:id/archivo-original` (usado tanto en la primera carga tras crear el documento como en reemplazos posteriores) SHALL validar la extensión **y** la firma binaria del archivo (`%PDF-` para PDF; `PK` + estructura ZIP para `.docx`/`.xlsx`) contra la lista permitida para el `Tipo` ya persistido del documento, respondiendo `400` con un mensaje claro si no cumple. Esto cierra la brecha: hoy ningún endpoint de creación/edición/reemplazo del original valida formato en el servidor.
- **Backend — firma y publicación:** si el archivo original es un PDF nativo, `FirmarPublicarDocumentoHandler` SHALL usar sus bytes directamente como entrada de `DocumentoPdfGenerator.SellarPublicado`, sin invocar `IDocumentoPdfConverter`. El resto del flujo (hash, obsoletización, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_DISTRIBUCION_GENERADO`) no cambia.
- **Backend — visor:** `VisualizarDocumentoHandler`, para `BORRADOR`/`EN_REVISION`/`EN_APROBACION` con original PDF nativo, SHALL generar la vista previa sellándolo directamente (`SellarVistaPrevia`) sin pasar por `IDocumentoPdfConverter`, manteniendo la caché por clave de original ya existente.
- **Backend — PDF protegido o dañado (comportamiento nuevo para este caso, no una regresión del fallback ya aceptado para conversiones):** si un original PDF nativo está cifrado con contraseña o corrupto y `PdfSharpCore` no puede abrirlo, el sistema SHALL responder con un error de negocio claro (nunca `500`) en vez de degradar en silencio publicando/previsualizando el PDF original sin sello — degradación que hoy existe para el caso ya aceptado de un PDF *convertido* por LibreOffice, pero que para un PDF nativo subido directamente dejaría circulando como "oficial" un archivo que ni el propio sistema puede abrir después. Idealmente detectado ya en la carga (`POST .../archivo-original`), no solo al firmar.
- **Backend — nueva versión:** confirmar (sin cambios de código, ya es así) que `NuevaVersionDocumentoHandler`/`DocumentoStorageService.CopiarOriginalAsync` copian el original PDF igual que un `.docx`, al ser agnósticos al tipo de archivo.
- **Frontend:** `FileUploadField` (variante `original`) y `DocumentReplaceArchivoOriginalModal` aceptan `.pdf` únicamente cuando el `tipo` del documento está en la lista permitida; `DocumentForm` cambia el texto de ayuda según `tipo` y bloquea el guardado (vía Zod, `documentFormSchema`) si el usuario cambia a un `tipo` no compatible mientras ya hay un PDF seleccionado — esto ocurre únicamente en el formulario de creación, en memoria antes de persistir: el campo `Tipo` del documento es inmutable una vez creado (`EditarDocumentoCommand` no lo incluye; confirmado leyendo el handler real), así que no hay un escenario de "cambiar tipo con PDF ya cargado" en edición — ver Nota técnica en `design.md`.

## Capabilities

### New Capabilities

(ninguna — el cambio extiende capacidades existentes)

### Modified Capabilities

- `be-documentos-api`: nuevo requirement de validación de formato del archivo original por tipo (RN-DOC-021); el requirement "Firma y publicación" gana el caso de PDF nativo (sin conversión) y el caso de PDF protegido/dañado (error de negocio, no degradación silenciosa); el requirement "Archivo original editable" referencia la nueva validación en el reemplazo.
- `document-viewer-api`: el requirement "Generación de vista previa con caché y bloqueo por clave" gana el caso de original PDF nativo (sellado directo, sin `IDocumentoPdfConverter`).
- `document-file-upload`: nuevo requirement — la variante `original` de `FileUploadField` acepta `.pdf` condicionado al `tipo` del documento.
- `document-form`: nuevo requirement — el texto de ayuda del archivo original cambia según `tipo`, y el formulario bloquea el guardado si el `tipo` elegido no admite el PDF ya seleccionado.
- `document-schemas`: nuevo requirement — `documentFormSchema` valida que `archivoOriginalFile` sea compatible con `tipo` (RN-DOC-021).

## Impact

- Backend: `Features/Documentos/Shared/` (nuevo `DocumentoFormatosPermitidos`, nuevo validador de firma binaria), `Features/Documentos/ArchivoOriginal/ReemplazarArchivoOriginalHandler.cs`, `Features/Documentos/FirmarPublicarDocumento/FirmarPublicarDocumentoHandler.cs`, `Features/Documentos/VisualizarDocumento/VisualizarDocumentoHandler.cs`, `Features/Documentos/Shared/DocumentoPdfGenerator.cs` (sin cambio de firma, pero nuevo caller directo sobre bytes nativos).
- Frontend: `features/documents/constants.ts`, `features/documents/components/FileUploadField.tsx`, `features/documents/components/DocumentForm.tsx`, `features/documents/components/DocumentReplaceArchivoOriginalModal.tsx`, `features/documents/schemas/documentForm.schema.ts`, `i18n/es-PE.json` + `i18n/en-US.json` (namespace `documents`).
- MSW: `mocks/handlers/documents.handlers.ts` replica la misma validación por tipo para que el modo mock no diverja del backend real.
- Tests: nuevos tests de backend (`ShcMvpEndPoint.Tests/Features/Documentos/`) y frontend (`FileUploadField.test.tsx`, `DocumentForm.test.tsx`, `documentForm.schema.test.ts`, `DocumentReplaceArchivoOriginalModal.test.tsx`).
- Sin cambio de contrato de API (mismo endpoint `POST /:id/archivo-original`, mismo `multipart/form-data`) — solo se amplía qué contenido es válido y se endurece la validación de formato que hoy no existe en el servidor.
