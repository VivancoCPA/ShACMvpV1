## Why

Al firmar y publicar un documento, el PDF de distribución generado hoy es un "dummy": `DocumentoPdfGenerator.GenerarDistribucion` arma una sola página con metadatos (código, versión, tipo, fecha de emisión) y nunca lee el archivo original (`.docx`/`.xlsx`) que el autor subió. `GenerarControlado` (exportación bajo demanda, RN-DOC-007) tiene el mismo problema. El PRD (ADD-02) define `archivoDistribucionUrl` como "el PDF controlado, generado automáticamente al publicar" — hoy esa promesa no se cumple: el contenido real del documento nunca llega al PDF que circula como maestro de distribución ni al que se exporta con marca de agua.

## What Changes

- Nuevo servicio de conversión backend (`IDocumentoPdfConverter` / `LibreOfficePdfConverter`) que invoca `soffice --headless --convert-to pdf` sobre el archivo original (`.docx`/`.xlsx`) para producir un PDF con el contenido real, con perfil de usuario de LibreOffice aislado por conversión, límite de concurrencia (`SemaphoreSlim`), timeout con kill del proceso, y limpieza garantizada del directorio temporal.
- `FirmarPublicarDocumentoHandler` pasa a: convertir el original → sellar el PDF convertido (encabezado/pie con código, versión, "PUBLICADO", fecha de emisión, aprobador, "Página X de N") → calcular SHA-256 → recién entonces persistir cambios de estado, obsoletización de la versión previa y audit trail. Si la conversión falla, no se publica nada (el documento permanece en `EN_APROBACION`, sin archivo huérfano, con un error de negocio claro — no un 500).
- **BREAKING (regla de negocio):** firmar un documento sin archivo original queda bloqueado con un mensaje explícito, en vez de generar la portada dummy como sustituto.
- El hash SHA-256 del PDF de distribución sellado se registra en la entrada `FIRMA_REGISTRADA` del audit trail (`ValorNuevo`), algo que hoy no ocurre.
- `GenerarControlado` / `ExportarPdfControladoHandler` parten del PDF de distribución ya guardado (contenido real) en vez de generar una página nueva de metadatos; conservan la marca de agua y el recálculo de hash existentes.
- Frontend: el modal de firma (`DocumentSignatureModal`) generaliza la visualización de error inline más allá del 401 por PIN incorrecto, para mostrar también el error de negocio de conversión fallida o de archivo original faltante (mismo patrón ya usado por `pin-firma-ui`, sin toast, modal abierto). MSW simula el error de "sin archivo original" igual que el backend real.

## Capabilities

### New Capabilities
- `document-pdf-conversion`: servicio backend de conversión de archivos originales (`.docx`/`.xlsx`) a PDF real vía LibreOffice headless — interfaz, configuración (`PdfConversion:SofficePath/TimeoutSeconds/MaxConcurrentConversions`), aislamiento de perfil por conversión, límite de concurrencia, timeout con terminación de proceso, manejo de errores y logging.

### Modified Capabilities
- `be-documentos-api`: el PDF de distribución (`GenerarDistribucion`) y el PDF controlado (`GenerarControlado`) dejan de ser páginas de metadatos — el primero se genera a partir de la conversión real del archivo original y queda sellado página por página; el segundo parte del PDF de distribución guardado. La firma (`POST /documents/:id/sign`) agrega precondiciones (archivo original presente, conversión exitosa) y falla atómicamente con un error de negocio (no 500) si la conversión no se puede completar. El audit trail `FIRMA_REGISTRADA` pasa a registrar el hash SHA-256 del archivo publicado.
- `document-approval-flow`: `DocumentSignatureModal` generaliza el requirement de "On 401 response: error message inline" a cubrir cualquier error de negocio (401 PIN incorrecto, 422 conversión fallida, 422 sin archivo original) con el mismo patrón inline sin toast.

## Impact

- Backend: `Features/Documentos/Shared/DocumentoPdfGenerator.cs`, `FirmarPublicarDocumentoHandler.cs`, `ExportarPdfControladoHandler.cs`, `DocumentoStorageService.cs` (lectura del original como stream), nuevo servicio de conversión e interfaz, `appsettings*.json` (sección `PdfConversion`), registro en DI, excepciones de negocio existentes (`BusinessRuleException` vía `ApiExceptionHandler`, sin status nuevo).
- Dependencia externa nueva: binario `soffice` (LibreOffice) instalado en el entorno de ejecución — solo configuración (ruta), sin asumir SO ni contenedor; sin infraestructura de producción definida en este change.
- Frontend: `DocumentSignatureModal` (y el hook/schema asociado si aplica), `DocumentActionPanel` (verificación de que ya consume el PDF real sin cambios de código), handlers MSW de documentos (simular error "sin archivo original").
- Preguntas abiertas para Toño (se documentan en `design.md`, no se implementan en este change): endpoint para subir un PDF de distribución directamente cuando no hay original; validar presencia de archivo original ya en `BORRADOR → EN_REVISION`; divergencia de texto "COPIA NO CONTROLADA" vs. PRD "COPIA CONTROLADA"; documentos `PUBLICADO` antiguos que quedan con el PDF dummy (no se migran masivamente).
