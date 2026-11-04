## 1. Servicio de conversión (backend)

- [x] 1.1 Crear `IDocumentoPdfConverter` (`Task<byte[]> ConvertirAsync(Stream original, string nombreArchivo, CancellationToken ct)`) y la excepción `PdfConversionException` en `Features/Documentos/Shared/`.
- [x] 1.2 Crear `PdfConversionOptions` (`SofficePath`, `TimeoutSeconds`, `MaxConcurrentConversions`), registrar la sección `PdfConversion` en `appsettings.json` y documentar el valor de Windows en `appsettings.Development.json.example`.
- [x] 1.3 Implementar `LibreOfficePdfConverter`: directorio temporal único por conversión, perfil de usuario aislado (`-env:UserInstallation`), invocación con `ProcessStartInfo` + `ArgumentList` (sin `UseShellExecute`), `SemaphoreSlim` según `MaxConcurrentConversions`, timeout con `Process.Kill(entireProcessTree: true)`, limpieza del directorio temporal en `finally`, log de duración y tamaño del resultado.
- [x] 1.4 Registrar `IDocumentoPdfConverter` → `LibreOfficePdfConverter` como singleton en DI.
- [x] 1.5 Agregar el log de advertencia al arranque si `SofficePath` no es una ruta de archivo válida (sin impedir el arranque).

## 2. Publicación (`FirmarPublicarDocumentoHandler`)

- [x] 2.1 Bloquear la firma con `BusinessRuleException("...", "SIN_ARCHIVO_ORIGINAL")` si `documento.ArchivoOriginalUrl is null`, antes de cualquier otro paso posterior a la validación de PIN.
- [x] 2.2 Leer el archivo original desde disco (`DocumentoStorageService.ResolveDiskPath` + `File.OpenRead`) y llamar a `IDocumentoPdfConverter.ConvertirAsync`.
- [x] 2.3 Capturar `PdfConversionException` y traducirla a `BusinessRuleException("...", "PDF_CONVERSION_FAILED")` — confirmar que `ApiExceptionHandler` la mapea a `422`, no a `500`.
- [x] 2.4 Reordenar el handler: validar estado/aprobador/PIN/archivo original → convertir → sellar (grupo 3) → calcular hash → recién ahí construir las entradas de audit trail, obsoletizar la versión previa, cambiar el estado, guardar el archivo y llamar `SaveChangesAsync`.
- [x] 2.5 Registrar el hash SHA-256 del PDF final como `ValorNuevo` de la entrada `FIRMA_REGISTRADA`.

## 3. Sello del documento publicado

- [x] 3.1 Implementar el sellado del PDF convertido con PdfSharpCore (`PdfReader.Open(..., PdfDocumentOpenMode.Modify)`), agregando en cada página un pie/encabezado discreto: código, versión, "PUBLICADO", fecha de emisión, nombre del aprobador, "Página X de N".
- [x] 3.2 La degradación (guardar sin sello + log de error en vez de bloquear la publicación) **está implementada** en `FirmarPublicarDocumentoHandler` (try/catch alrededor de `SellarPublicado`). **Verificado (2026-10-06):** con LibreOffice ya instalado en la máquina de desarrollo, `LibreOfficePdfConverterTests` confirmó que `PdfReader.Open` abre sin problemas el PDF real producido por esta instalación — el camino feliz funciona, la degradación queda como salvaguarda sin ejercitar.

## 4. PDF controlado bajo demanda

- [x] 4.1 Reescribir `ExportarPdfControladoHandler` para leer el PDF de distribución guardado (`DocumentoStorageService.ResolveDiskPath(documento.ArchivoDistribucionUrl)`) en vez de generar una página nueva.
- [x] 4.2 Reescribir `DocumentoPdfGenerator.GenerarControlado` para aceptar los bytes del PDF de distribución como entrada, agregar la marca de agua existente (nombre, timestamp Lima, leyenda) en cada página, y recalcular el hash SHA-256 sobre el resultado.

## 5. Frontend

- [x] 5.1 Generalizar `DocumentSignatureModal` para mostrar inline (sin toast, modal abierto) cualquier error de la mutación de firma — no solo 401 — incluyendo los nuevos errores de negocio `SIN_ARCHIVO_ORIGINAL` y `PDF_CONVERSION_FAILED`, usando el mensaje localizado que venga del backend. **Verificado sin cambio de código**: el componente ya tenía una rama `genericError` (`setGenericError(response?.data?.message ?? t('signature.errorGeneric'))`) para cualquier error que no sea 401 ni `PIN_NO_CONFIGURADO`, mostrado inline sin toast — ambos códigos nuevos caen ahí automáticamente.
- [x] 5.2 Verificar que `DocumentActionPanel` ("Ver archivo" / "Descargar PDF" / vista previa del PDF controlado) ya muestra el archivo real sin requerir cambios de código — documentar si se encuentra algún gap. **Sin gap**: `useGetArchivoUrl`/`useExportarPdfControlado` ya consumen los endpoints reales (`archivoUrl` resuelto por `DocumentoArchivoVigenteResolver`, blob de `exportar-pdf`) desde el cutover — no dependen de contenido dummy en el frontend.
- [x] 5.3 Actualizar los handlers MSW de documentos para simular el error "sin archivo original" al firmar, con el mismo código/mensaje que el backend real.

## 6. Tests backend

- [x] 6.1 Crear un `IDocumentoPdfConverter` fake para tests y verificar que la firma lo usa y guarda el PDF sellado que devuelve. `FakeDocumentoPdfConverter` registrado como default en `ShacWebApplicationFactory` (reemplaza `LibreOfficePdfConverter` en toda la suite "Integration").
- [x] 6.2 Test: un fallo del converter deja el documento en `EN_APROBACION`, la versión previa sin cambios, y sin archivo ni entradas de audit trail nuevas. `ThrowingDocumentoPdfConverter` + `DocumentosPdfConversionFailureFixture` (mismo patrón que `DocumentosNotificationFailureFixture`).
- [x] 6.3 Test: sin archivo original, la firma se bloquea con `SIN_ARCHIVO_ORIGINAL` y no se genera ningún PDF.
- [x] 6.4 Test: el hash de `FIRMA_REGISTRADA` coincide con el SHA-256 del archivo de distribución guardado.
- [x] 6.5 Test: el PDF controlado parte del PDF de distribución y conserva la misma cantidad de páginas.
- [x] 6.6 Agregar fixtures `.docx` y `.xlsx` pequeños al proyecto de tests y un test de integración real con LibreOffice, marcado para omitirse (`Skip`) si `SofficePath` no está disponible en el entorno de CI/dev. Se agregó el paquete `Xunit.SkippableFact` para que el skip se reporte como "Omitido" real, no como un passed silencioso. **Actualización (2026-10-06): LibreOffice quedó instalado** en la máquina de desarrollo — los 3 tests que antes se omitían corrieron de punta a punta contra el binario real (`.docx` y `.xlsx` reales → PDF válido con al menos una página) y **pasaron**, confirmando la compatibilidad con `PdfReader.Open(..., Modify)` (ver design.md D10, pregunta abierta #4 ahora resuelta).
- [x] 6.7 Test de concurrencia: dos conversiones simultáneas no fallan (perfil aislado). **Verificado con LibreOffice real (2026-10-06): pasó.**

## 7. Tests frontend y verificación cruzada

- [x] 7.1 Agregar/actualizar tests de `DocumentSignatureModal` para los nuevos escenarios de error inline (`SIN_ARCHIVO_ORIGINAL`, `PDF_CONVERSION_FAILED`). También se agregó un test MSW para `SIN_ARCHIVO_ORIGINAL` en `documents.handlers.test.ts`.
- [x] 7.2 Correr la suite completa del frontend y `tsc` sin errores. **182 archivos de test, 1456 passed (+1 expected fail preexistente), `tsc --noEmit` sin errores.**
- [x] 7.3 Correr la suite completa de tests del backend sin errores. **Última corrida completa (tras el fix de logging, 9.4): 530 tests, 530 passed, 0 failed, 0 skipped** — con LibreOffice ya instalado, los antes-omitidos también corren y pasan.

## 8. Documentación y cierre

- [x] 8.1 Actualizar `design.md` con cualquier divergencia encontrada durante la implementación: orden real del chequeo RN-DOC-005 vs. el archivo original (D9), degradación de sellado implementada en código (D10), confirmación de que `Documento.cs` no tiene `HashArchivo` (D11), y la pregunta abierta nueva #4 (compatibilidad PdfSharpCore/LibreOffice no verificable en este sandbox).
- [x] 8.2 Instrucciones de prueba manual para Toño agregadas en `design.md` ("Prueba manual (Toño) — pendiente, no ejecutable en el sandbox de implementación"): instalar LibreOffice, configurar `PdfConversion:SofficePath`, probar con MSW apagado (.docx, .xlsx, exportar PDF controlado, ruta de soffice inválida), y qué revisar en el log si el sellado falla.

## 9. Fix: el error real de conversión PDF nunca se registra en el log

- [x] 9.1 Corregir `FirmarPublicarDocumentoHandler`: el `catch (PdfConversionException)` ahora registra `logger.LogError(ex, "Falló la conversión a PDF del documento {DocumentoId} ({Archivo})", documento.Id, nombreOriginal)` antes de traducir a `BusinessRuleException`. Se corrigió el comentario que afirmaba (incorrectamente) que el detalle ya quedaba en el log de `IDocumentoPdfConverter`.
- [x] 9.2 Revisado: no existe otro consumidor de `IDocumentoPdfConverter` además de `FirmarPublicarDocumentoHandler` (`ExportarPdfControladoHandler` lee el PDF de distribución ya guardado, nunca convierte) — nada más que corregir ahí.
- [x] 9.3 Confirmado: el aviso de arranque de `pdf-distribucion-real` (D8) ya existe en `Program.cs` y ya registra la ruta efectiva configurada cuando `SofficePath` no es un archivo ejecutable válido. No se necesitó agregarlo.
- [x] 9.4 Test: `RecordingLogger<T>` (nuevo helper de tests, el proyecto no tenía ninguno) + `ThrowingDocumentoPdfConverter` verifican que un fallo de conversión deja una entrada de log `Error` con el `DocumentoId` y la `PdfConversionException` original. Suite completa del backend: 530 passed, 0 failed, 0 skipped (LibreOffice ya instalado).
