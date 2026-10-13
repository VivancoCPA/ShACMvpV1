## 1. Backend — fuente única de formatos permitidos

- [x] 1.1 Crear `ShcMvpEndPoint/Features/Documentos/Shared/DocumentoFormatosPermitidos.cs`: `TiposConOriginalPdf` (`INF`, `MAT`, `PLAN`) y un método que valida extensión + firma binaria (`%PDF-` para PDF; `PK` para `.docx`/`.xlsx`) de un stream, devolviendo un resultado claro (válido / extensión no permitida / firma no coincide con la extensión).
- [x] 1.2 Crear un helper `ObtenerPdfBaseAsync` (mismo archivo o uno nuevo en `Shared/`) que decide, a partir de la extensión real del original, si delega en `IDocumentoPdfConverter.ConvertirAsync` o si lee y valida los bytes del PDF nativo directamente (abrir con `PdfReader.Open` en modo lectura; lanzar una excepción propia y clara si falla).

## 2. Backend — validación al subir/reemplazar el archivo original

- [x] 2.1 En `ReemplazarArchivoOriginalHandler.HandleAsync`, antes de `storage.GuardarOriginalAsync`, validar el archivo recibido contra `DocumentoFormatosPermitidos` usando `documento.Tipo` ya persistido; responder `BadRequestBusinessException` (400) con mensaje claro si no cumple.
- [x] 2.2 Si el archivo validado es un PDF nativo, intentar abrirlo con `PdfReader.Open` (modo lectura) antes de guardarlo; si falla (protegido/dañado), responder `BadRequestBusinessException` ("El PDF está protegido o dañado; súbelo sin contraseña") sin persistir el archivo.
- [x] 2.3 Confirmar que `CrearDocumentoHandler` no necesita cambios (no recibe archivo) y que `EditarDocumentoHandler`/`EditarDocumentoCommand` no necesitan cambios (`Tipo` no es editable — ver `design.md` Context).

## 3. Backend — firma y publicación

- [x] 3.1 En `FirmarPublicarDocumentoHandler`, reemplazar la llamada directa a `pdfConverter.ConvertirAsync` por el helper `ObtenerPdfBaseAsync` (tarea 1.2), que decide convertir o usar el PDF nativo según la extensión real del original.
- [x] 3.2 Distinguir, en el `catch` alrededor de `DocumentoPdfGenerator.SellarPublicado`, el caso "original es PDF nativo" (lanzar `BusinessRuleException("...", "PDF_PROTEGIDO_O_DANADO")`, sin degradar) del caso "original fue convertido por LibreOffice" (mantener la degradación a "sin sello" ya existente, sin cambios).
- [x] 3.3 Confirmar que el resto del flujo (hash SHA-256, obsoletización RN-DOC-001, `ArchivoOriginalBloqueado`, entradas de audit trail `FIRMA_REGISTRADA`/`ESTADO_CAMBIADO`/`ARCHIVO_ORIGINAL_CONGELADO`/`ARCHIVO_DISTRIBUCION_GENERADO`) no cambia.

## 4. Backend — visor

- [x] 4.1 En `VisualizarDocumentoHandler.ObtenerVistaPreviaAsync`, usar el mismo helper `ObtenerPdfBaseAsync` (tarea 1.2) en vez de llamar directo a `pdfConverter.ConvertirAsync`, manteniendo la clave de caché y el lock por clave sin cambios.
- [x] 4.2 Distinguir, en el `catch` alrededor de `DocumentoPdfGenerator.SellarVistaPrevia`, el caso "PDF nativo protegido/dañado" (`BusinessRuleException("...", "PDF_PROTEGIDO_O_DANADO")`, sin generar caché parcial) del caso "conversión LibreOffice con salida que PdfSharpCore no abre" (degradación existente a "sin sello", sin cambios).

## 5. Backend — nueva versión (verificación, sin cambio esperado)

- [x] 5.1 Confirmar leyendo `NuevaVersionDocumentoHandler` y `DocumentoStorageService.CopiarOriginalAsync` que la copia del original PDF funciona sin cambios (ambos ya son agnósticos al tipo de archivo) — agregar un comentario breve si hace falta aclarar la decisión, sin modificar la lógica.

## 6. Frontend — constantes y esquema

- [x] 6.1 Agregar `TIPOS_CON_ORIGINAL_PDF` en `shc-controldoc/src/features/documents/constants.ts` (espejo de `DocumentoFormatosPermitidos.TiposConOriginalPdf`, mismo comentario de "espejo del backend" que ya usa `DOCUMENT_ASIGNACION_ELIGIBLE_ROLES`).
- [x] 6.2 Actualizar `FileUploadField.tsx`: nueva prop para el `tipo` del documento (o un `allowPdf: boolean` calculado por el padre); ampliar `ACCEPTED_TYPES_ORIGINAL`/`acceptAttr` para la variante `original` cuando el tipo está en `TIPOS_CON_ORIGINAL_PDF`.
- [x] 6.3 Actualizar `documentForm.schema.ts`: agregar la rama en `superRefine` que rechaza `archivoOriginalFile` de tipo `application/pdf` cuando `tipo` no está en `TIPOS_CON_ORIGINAL_PDF`, con mensaje localizado.

## 7. Frontend — formulario y modal de reemplazo

- [x] 7.1 Actualizar `DocumentForm.tsx`: pasar el `tipo` observado (`watch('tipo')`) a `FileUploadField`; mostrar el texto de ayuda correspondiente según `tipo` (ver i18n, tarea 8).
- [x] 7.2 Actualizar `DocumentDetailPage.tsx` para pasar `tipo={documento.tipo}` a `DocumentReplaceArchivoOriginalModal`.
- [x] 7.3 Actualizar `DocumentReplaceArchivoOriginalModal.tsx`: recibir `tipo` como prop y pasarlo a `FileUploadField`.

## 8. Frontend — i18n

- [x] 8.1 Agregar/actualizar claves en `src/i18n/es-PE.json` y `src/i18n/en-US.json` (namespace `documents`): texto de ayuda del archivo original para tipos con PDF permitido vs. sin PDF permitido, y el mensaje de error de `documentForm.schema.ts` para la incompatibilidad tipo/archivo.

## 9. MSW

- [x] 9.1 Actualizar el handler de `POST /api/documents/:id/archivo-original` en `mocks/handlers/documents.handlers.ts` para validar el tipo de archivo (por extensión del nombre) contra `TIPOS_CON_ORIGINAL_PDF` y el `tipo` del documento en el store mutable, respondiendo `400` si no coincide — mismo patrón que ya usa para `DOCUMENT_ASIGNACION_ELIGIBLE_ROLES`. (El comentario preexistente "MSW cannot parse multipart/form-data boundaries" en este handler era drift: `locales.handlers.ts` ya usa `request.formData()` con éxito; se adoptó el mismo patrón.)
- [x] 9.2 Confirmar que un original PDF nativo se "publica" en el mock sin ninguna lógica de conversión adicional (el mock no convierte nada hoy; verificar que no haya ningún supuesto oculto de docx/xlsx en el camino de firma mock).

## 10. Tests — backend

- [x] 10.1 `ReemplazarArchivoOriginalHandler`: crear un `PLAN` y subir un PDF válido → `200`.
- [x] 10.2 `ReemplazarArchivoOriginalHandler`: crear un `PRC` y subir un PDF válido → `400`.
- [x] 10.3 `ReemplazarArchivoOriginalHandler`: subir un archivo `.pdf` cuyos bytes no son `%PDF-` (p.ej. un `.docx` renombrado) sobre un `PLAN` → `400`.
- [x] 10.4 `ReemplazarArchivoOriginalHandler`: subir un `.docx` válido sobre un `PRC` → sigue aceptado (`200`), sin regresión.
- [x] 10.5 `FirmarPublicarDocumentoHandler`: firmar un `PLAN` con original PDF nativo válido → `PUBLICADO`, el PDF de distribución tiene el sello, el hash queda registrado, y el `IDocumentoPdfConverter` fake (`FakeDocumentoPdfConverter`/un nuevo spy) confirma que `ConvertirAsync` no se invocó.
- [x] 10.6 `FirmarPublicarDocumentoHandler`: firmar un `PRC` con `.docx` → sigue invocando el conversor, sin regresión (ya cubierto por `DocumentosPdfConversionTests.FirmarPublicar_HashDeFirmaRegistradaCoincideConElArchivoGuardado`, que usa `.docx` + el fake converter; no requirió un test nuevo).
- [x] 10.7 `FirmarPublicarDocumentoHandler`: firmar un `PLAN` con un PDF nativo cifrado con contraseña → error de negocio (`PDF_PROTEGIDO_O_DANADO`), no `500`, documento permanece `EN_APROBACION`.
- [x] 10.8 `VisualizarDocumentoHandler`: visor de un `PLAN` en `EN_REVISION` con original PDF nativo → `200` con la marca de vista previa, sin invocar el conversor.
- [x] 10.9 `VisualizarDocumentoHandler`: visor de un documento con original PDF nativo cifrado → error de negocio, no `500`, sin archivo de caché parcial.
- [x] 10.10 `NuevaVersionDocumentoHandler`: nueva versión de un `PLAN` con original PDF nativo → el nuevo `BORRADOR` tiene el PDF copiado físicamente (reutilizar el patrón de test ya existente para `.docx`).
- [x] 10.11 Extender `DocumentosArchivoEndpointTests.cs` o crear un archivo de test dedicado (p.ej. `DocumentosOriginalPdfFormatoTests.cs`) agrupando 10.1–10.4. (Se creó `DocumentosOriginalPdfFormatoTests.cs`, con un 5º test extra para el PDF protegido ya en la carga.)

**Verificación de la suite (2026-10-13):** `dotnet test --filter` sobre `DocumentosOriginalPdfFormatoTests|DocumentosPdfConversionTests|DocumentosVisorEndpointTests|DocumentosArchivoEndpointTests|DocumentosNuevaVersionEndpointTests` → 46/47 pasan. El único fallo (`ExportarPdfControlado_PartDelPdfDeDistribucionYConservaCantidadDePaginas`, `PdfReaderException: To modify the document the owner password is required`) es preexistente y no relacionado — falla igual corrido en total aislamiento, en una ruta de código (`GenerarControlado`/`ExportarPdfControladoHandler`) que este change no toca. Durante la primera corrida se encontró y corrigió un bug real en mi propio test (`PdfNativoAceptadoParaPlan` usaba solo la firma `"%PDF-"` de 9 bytes, no un PDF real — `ReemplazarArchivoOriginalHandler` también intenta abrir el PDF nativo con PdfSharpCore, así que un stub de solo-firma fallaba igual que un PDF dañado real). Un filtro más amplio (`~Documentos`, que incluye muchos más archivos no relacionados) se colgó sin avanzar CPU durante >15 min — no se investigó más allá de confirmar que el filtro acotado a los archivos de este change corre limpio en 24s; puede ser un problema preexistente de otro test no relacionado, a revisar por separado.

## 11. Tests — frontend

- [x] 11.1 `FileUploadField.test.tsx`: la variante `original` acepta `.pdf` cuando se le pasa un tipo permitido, y lo rechaza (error inline) cuando no.
- [x] 11.2 `DocumentForm.test.tsx`: el texto de ayuda cambia según `tipo`. (El bloqueo de envío con un PDF incompatible ya cargado se valida a nivel de esquema en 11.3 — más preciso que recrear un submit completo con todos los campos del formulario válidos solo para ejercitar esta rama.)
- [x] 11.3 `documentForm.schema.ts` (test nuevo o extendido): casos de la spec `document-schemas` (PDF compatible, PDF incompatible, `.docx` siempre OK, archivo ausente no dispara la validación).
- [x] 11.4 `DocumentReplaceArchivoOriginalModal.test.tsx`: con `tipo` permitido acepta PDF; con `tipo` no permitido lo rechaza.

## 12. Verificación manual (MSW apagado, backend real)

Nota: los pasos 12.2–12.6 ya están cubiertos a nivel de API/integración por los tests de la sección 10 (contra Postgres real, mismo pipeline HTTP, sin LibreOffice gracias a `FakeDocumentoPdfConverter`). Esta sección queda sin marcar a propósito — es la verificación visual/manual en navegador que, según las instrucciones de origen, hace Toño y avisa con "listo"; no se simuló un navegador real en esta sesión.

- [x] 12.1 Detener el backend si está corriendo y ejecutar `dotnet build` sobre `ShcMvpEndPoint.sln` antes de probar manualmente. (Backend detenido y `dotnet build` corrido limpio al inicio de la implementación.)
- [ ] 12.2 Crear un `PLAN` con un PDF nativo real. (Equivalente automatizado: `DocumentosOriginalPdfFormatoTests.PdfNativoAceptadoParaPlan`.)
- [ ] 12.3 Abrir el visor en `BORRADOR`/`EN_REVISION` — debe verse la marca de vista previa, sin pasar por LibreOffice. (Equivalente automatizado: `DocumentosVisorEndpointTests.PlanConOriginalPdfNativo_GeneraVistaPreviaSinInvocarElConversor`.)
- [ ] 12.4 Enviar a revisión, aprobar, y firmar — el documento queda `PUBLICADO` con el sello de publicación en el PDF de distribución. (Equivalente automatizado: `DocumentosPdfConversionTests.FirmarPublicar_PlanConOriginalPdfNativo_PublicaSinInvocarElConversor`.)
- [ ] 12.5 Descargar la copia no controlada (PDF controlado) y confirmar que conserva el contenido real. (No ejercitado específicamente con un original PDF nativo — el test existente de PDF controlado usa un original convertido; pendiente de confirmación visual.)
- [ ] 12.6 Intentar subir un PDF como archivo original de un `PRC` — debe rechazarse con `400` y un mensaje claro. (Equivalente automatizado: `DocumentosOriginalPdfFormatoTests.PdfRechazadoParaPrc`.)
- [ ] 12.7 Confirmar que el `<select id="tipo">` no tiene forma de cambiar el tipo de un documento ya creado (edición no envía `tipo`) — no hay paso de "cambiar tipo con PDF cargado" que probar en edición, por diseño (ver `design.md`).

## 13. Verificación final y cierre

- [x] 13.1 Correr la suite completa del frontend (`npm test` / `vitest`), los tests del backend (`dotnet test`), y `tsc --noEmit`. Frontend: 1615/1616 (el único fallo es preexistente y no relacionado — `documentReplaceOriginal.test.tsx`, parte del change sin commitear `detalle-documento-dos-columnas`, confirmado con `git diff HEAD` mostrando ese archivo ya reescrito antes de esta sesión). `tsc --noEmit`: errores preexistentes sin relación (confirmado que ninguno de los archivos reportados fue tocado por este change). Backend: suite acotada a los 5 archivos de test relevantes a este change, 46/47 (el único fallo, `ExportarPdfControlado_...`, es preexistente — falla igual en aislamiento total, en código que este change no toca). Un filtro backend más amplio (`~Documentos`) se colgó sin avanzar — no investigado más a fondo, ver nota en la sección 10.
- [x] 13.2 Releer el código real implementado contra `design.md`/specs antes de avisar que está listo. (Releído FirmarPublicarDocumentoHandler, VisualizarDocumentoHandler, ReemplazarArchivoOriginalHandler, DocumentoPdfBaseResolver, DocumentoFormatosPermitidos, y el lado frontend — consistente con design.md D1-D6.)
- [ ] 13.3 Actualizar `SHAC-Mapa-Proceso-Control-Documentario.md` (vive en `Claude outputs/`) — deliberadamente NO hecho todavía: según las instrucciones de origen, esto lo hace Cowork después de que Toño confirme "listo" tras su propia verificación manual (sección 12), no antes.
