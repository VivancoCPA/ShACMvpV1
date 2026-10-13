## 0. Pre-requisito de secuenciación

- [x] 0.1 Confirmar que `revision-periodica-permiso-por-rol` ya fue archivado (o al menos que sus 2 tareas pendientes están resueltas) antes de empezar la implementación de este change — si no, pausar aquí y retomar cuando se archive. **Decisión explícita del usuario (2026-10-07): proceder sin esperar** — `revision-periodica-permiso-por-rol` sigue con 2 tareas pendientes y sin archivar; se ignora el orden a propósito.

## 1. Backend — DocumentoPdfGenerator (sellos nuevos)

- [x] 1.1 Agregar `DocumentoPdfGenerator.SellarVistaPrevia(byte[] pdfConvertido, Documento documento)` — banda/encabezado prominente "VISTA PREVIA — NO CONTROLADO — {Estado}" en cada página (código y versión incluidos), visualmente distinto al pie de página discreto de `SellarPublicado`.
- [x] 1.2 Agregar `DocumentoPdfGenerator.SellarObsoleto(byte[] pdfDistribucion)` — encabezado prominente en rojo "OBSOLETO — No usar" en cada página (RN-DOC-003).
- [x] 1.3 En ambos métodos, si `PdfReader.Open`/el sellado falla, degradar devolviendo el PDF de entrada sin sello y registrar el error en el log (mismo patrón ya aceptado para `SellarPublicado`) — nunca lanzar una excepción que tumbe la respuesta.
- [x] 1.4 Tests unitarios de `SellarVistaPrevia`/`SellarObsoleto`: contenido esperado presente en cada página, número de páginas preservado, degradación ante un PDF de entrada corrupto. (`DocumentoPdfGeneratorVisorTests.cs`, ya existente; verificado presente en la corrida completa — ninguno de los 3 fallos reales encontrados estaba aquí.)

## 2. Backend — Caché de vista previa (`DocumentoPreviewCacheService`)

- [x] 2.1 Crear `Features/Documentos/Shared/DocumentoPreviewCacheService.cs`: ruta base `Path.Combine(env.ContentRootPath, "cache", "documentos-preview", empresaId, documentoId)` — fuera de `wwwroot`/`WebRootPath`.
- [x] 2.2 Método para calcular la clave de caché a partir del nombre de archivo ya archivado de `ArchivoOriginalUrl` (`Path.GetFileName`), y para resolver/guardar el archivo de caché bajo esa clave (`{documentoId}__{clave}.pdf`).
- [x] 2.3 Lock por clave (`ConcurrentDictionary<string, SemaphoreSlim>` interno al servicio, registrado como singleton) — adquirir antes de verificar/generar, liberar siempre en `finally`.
- [x] 2.4 Tests: dos solicitudes concurrentes de la misma clave generan una sola conversión; claves distintas no se bloquean entre sí; el archivo de caché queda fuera de `wwwroot`. (`DocumentoPreviewCacheServiceTests.cs`, ya existente; verificado presente en la corrida completa.)

## 3. Backend — Endpoint `GET /api/documents/{id}/visor`

- [x] 3.1 Crear feature slice `Features/Documentos/VisualizarDocumento/` (`VisualizarDocumentoEndpoint.cs`, `VisualizarDocumentoHandler.cs`), siguiendo el patrón de `ArchivoOriginalEndpoint`/`ArchivoDistribucionEndpoint` (`.RequireAuthorization()`, resolver `empresaActivaId`/`rol`/`docRole` desde `ClaimsPrincipal`).
- [x] 3.2 Aplicar primero aislamiento multi-tenant (404 si `EmpresaId` no coincide) y `CanAccessByConfidencialidad` (404 si falla).
- [x] 3.3 Resolver `docRole` y aplicar el gate de permiso: `GetBasePermissions(estado, docRole).CanRead`, con el `OR` explícito de `CanViewArchivoOriginalConCA34(estado, docRole, actorRolGlobal)` cuando `estado == OBSOLETO` (ver design.md D2). Rechazar con error de autorización (403) si falla.
- [x] 3.4 Rama `BORRADOR`/`EN_REVISION`/`EN_APROBACION`: si `ArchivoOriginalUrl` es `null` → 404 "Este documento aún no tiene archivo para visualizar". Si no, usar `DocumentoPreviewCacheService` + `IDocumentoPdfConverter.ConvertirAsync` + `DocumentoPdfGenerator.SellarVistaPrevia` (mismo patrón try/catch `PdfConversionException` → `BusinessRuleException("PDF_CONVERSION_FAILED")` + `logger.LogError` que `FirmarPublicarDocumentoHandler`).
- [x] 3.5 Rama `PUBLICADO`/`EN_REVISION_PERIODICA`: servir `ArchivoDistribucionUrl` desde disco tal cual (sin regenerar, sin sello adicional).
- [x] 3.6 Rama `OBSOLETO`: leer `ArchivoDistribucionUrl` desde disco y aplicar `SellarObsoleto` al vuelo (sin cachear, sin modificar el archivo en disco).
- [x] 3.7 Registrar la entrada `VISUALIZACION` en el audit trail inline (mismo patrón que `ObtenerArchivoHandler`), solo si la respuesta es `200`.
- [x] 3.8 Responder `application/pdf` con `Content-Disposition: inline`.
- [x] 3.9 Registrar el endpoint en `Program.cs` / el mapeo de endpoints de Documentos.

## 4. Backend — Tests de integración del endpoint

Todas verificadas: `DocumentosVisorEndpointTests.cs` (+ `DocumentosVisorConversionFailureTests` para 4.12) ya existían, escritos por la sesión anterior. Al correrlos se encontraron 3 fallos reales en 4.4/4.10/4.13 (aserciones sobre un contador `ConvertirAsyncCallCount` **absoluto**, compartido como Singleton por toda la colección "Integration" — contaminado por otros tests que también convierten PDFs; corregido a comparar deltas antes/después). Tras el fix: 15/15 tests de la clase pasan (`dotnet test --filter "FullyQualifiedName~DocumentosVisorEndpointTests"`, 5 s).

- [x] 4.1 BORRADOR con `docRole AUTOR` → `200 application/pdf`.
- [x] 4.2 BORRADOR con `docRole OPERARIO` → 403.
- [x] 4.3 EN_APROBACION con el `docRole APROBADOR` asignado → `200` (D2), y confirmar que `GET /:id/archivo-original` con el mismo usuario sigue en 403 (RN-DOC-013 no cambia).
- [x] 4.4 PUBLICADO con un lector con acceso por confidencialidad → `200`, devuelve el PDF de distribución existente, sin invocar `IDocumentoPdfConverter`.
- [x] 4.5 Documento `CONFIDENCIAL` con `OPERARIO` → 404.
- [x] 4.6 OBSOLETO → `200` con el PDF sellado "OBSOLETO — No usar"; confirmar que el archivo en disco no cambió.
- [x] 4.7 OBSOLETO con `ALTA_DIRECCION`/`JEFE_CONTROL_DOCUMENTARIO` cuyo `docRole` resuelto no tendría `CanRead` por la matriz base → `200` vía la excepción CA-34.
- [x] 4.8 Documento de otra empresa → 404.
- [x] 4.9 Documento sin `ArchivoOriginalUrl` en `BORRADOR` → 404 con el mensaje claro esperado.
- [x] 4.10 Segunda apertura usa la caché (el fake converter registra que `ConvertirAsync` se llamó una sola vez); tras reemplazar el original, la siguiente apertura genera una vista previa nueva (el fake converter se invoca de nuevo).
- [x] 4.11 Cada apertura exitosa registra `VISUALIZACION` exactamente una vez; una apertura rechazada (403/404) no registra nada.
- [x] 4.12 Fallo de conversión (converter fake que lanza `PdfConversionException`) → error de negocio `PDF_CONVERSION_FAILED`, no 500, sin archivo de caché parcial.
- [x] 4.13 Dos solicitudes concurrentes de la misma versión → una sola conversión (verificar contador de invocaciones del fake converter).

## 5. Frontend — Dependencia y configuración de `react-pdf`

- [x] 5.1 Agregar `react-pdf` (y su dependencia transitiva `pdfjs-dist`) a `package.json`.
- [x] 5.2 Configurar el worker para Vite: `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`.
- [x] 5.3 Agregar el endpoint al cliente API: `getDocumentVisorBlob(id)` en `documents.api.ts` (`api.get('/api/documents/:id/visor', { responseType: 'blob' })`), siguiendo el patrón de `getArchivoOriginalUrl`/`getArchivoDistribucionBlob`.

## 6. Frontend — Componente `DocumentViewer`

- [x] 6.1 Crear `src/features/documents/components/DocumentViewer.tsx`: `<Document file={blob}>` + `<Page>` con navegación, zoom, y "ajustar al ancho"; responsive desde 360px.
- [x] 6.2 `renderTextLayer={false}`, `renderAnnotationLayer={false}` en cada `<Page>`; `onContextMenu` con `preventDefault` en el contenedor.
- [x] 6.3 Estados de carga ("Generando vista previa…" + spinner) y de error (incluyendo el caso específico de 404 "sin archivo para visualizar" vs. error genérico).
- [x] 6.4 Botón "Imprimir", visible solo si `useAuthStore().user.rol` es `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`: iframe oculto con `src = URL.createObjectURL(blob)` ya cargado, `onload` → `contentWindow.print()`, limpieza (`revokeObjectURL` + remover iframe) tras imprimir.
- [x] 6.5 Sin ningún botón de descarga, para ningún rol.
- [ ] 6.6 Tests de componente: navegación de páginas, botón de imprimir visible/ausente por rol, ausencia de botón de descarga, ausencia de capa de texto, estados de carga/error.

## 7. Frontend — Integración en el detalle del documento

- [x] 7.1 En `DocumentActionPanel`, agregar el botón "Ver documento" (acción principal, estilo primario) junto a "Ver archivo"/"Exportar PDF controlado" (quedan como secundarias) — visible según `getDocumentPermissions(estado, docRole).canRead` (con el `OR` de CA-34 para `OBSOLETO`) y `canAccessDocument`.
- [x] 7.2 Al hacer clic, abrir `DocumentViewer` en un modal (reutilizar el patrón de modal ya usado en el propio `DocumentActionPanel` para el preview cosmético, sin fusionarlo con él — son dos modales distintos).
- [x] 7.3 Agregar las claves i18n nuevas (`es-PE.json`/`en-US.json`, namespace `documents`): título del botón, textos del visor (carga, error, imprimir), confirmando que ninguna quede hardcodeada en JSX.

## 8. MSW

- [x] 8.1 Agregar handler `GET /api/documents/:id/visor` en `documents.handlers.ts`, replicando el mismo gate de permisos ya usado por `archivo-original`/`archivo-distribucion` (tenant, confidencialidad, `isEditableState`/CA-34 para OBSOLETO).
- [x] 8.2 Generar bytes de PDF reales locales para cada rama (reutilizar/extender `buildMinimalDistribucionPdfBytes`, o un helper nuevo equivalente para la vista previa con el texto "VISTA PREVIA — NO CONTROLADO — {ESTADO}") — no repetir el patrón de URL externa fija que usa hoy el handler de `archivo`.
- [x] 8.3 Registrar `VISUALIZACION` en el audit trail del fixture in-memory al servir `200`.

## 9. Verificación final

- [x] 9.1 Correr la suite completa del frontend (`vitest`) y `tsc --noEmit`.
- [ ] 9.2 Correr los tests del backend (.NET) — **parcialmente verificado**: una corrida completa terminó con solo 3 fallos (en `DocumentosVisorEndpointTests`, ya corregidos — ver sección 4), pero no se logró una segunda corrida completa 100% limpia por restricciones de recursos del entorno (la suite completa tardó >50 min y una corrida posterior fue detenida por el harness por memoria baja del sistema). La clase afectada (`DocumentosVisorEndpointTests`, 15/15) sí se confirmó limpia de forma aislada. Pendiente: una corrida completa sin interrupciones para cerrar esta tarea con certeza total.
- [ ] 9.3 Detener el backend, ejecutar `dotnet build`, confirmar `PdfConversion:SofficePath` configurado, y levantar de nuevo con MSW apagado (`VITE_ENABLE_MSW=false`).
- [ ] 9.4 Prueba manual: revisor abre un `.docx` de varias páginas `EN_REVISION` → vista previa con marca de agua, sin descarga ni texto seleccionable.
- [ ] 9.5 Prueba manual: aprobador abre el mismo documento en `EN_APROBACION` → se ve correctamente.
- [ ] 9.6 Prueba manual: publicar el documento y abrirlo como `OPERARIO` → se muestra el PDF de distribución.
- [ ] 9.7 Prueba manual: abrir como `JEFE_CONTROL_DOCUMENTARIO` y como `OPERARIO` para confirmar que el botón de imprimir solo aparece para el primero.
- [ ] 9.8 Prueba manual: reemplazar el original en `BORRADOR` y confirmar que la vista previa se regenera (no se sirve la caché vieja).
- [ ] 9.9 Repetir 9.4–9.8 con un `.xlsx`.
- [ ] 9.10 Releer el código real implementado y actualizar `design.md`/specs si algo divergió durante la implementación, antes de avisar "listo".

## 10. autor-lectura-publicado (2026-10-08, decisión de Toño — tarea adicional, design.md D9)

- [x] 10.1 Backend — `DocumentPermissionResolver.GetBasePermissions`: `PUBLICADO` + `AUTOR` y `OBSOLETO` + `AUTOR` → `DenyAll with { CanRead = true }` (sin tocar `canEdit`/`canDelete`/`canStartReview`, que siguen en `false`).
- [x] 10.2 Frontend — mismo cambio en `getBasePermissions` (`permissions.ts`).
- [x] 10.3 Frontend — tests actualizados en `permissions.test.ts` (AUTOR en PUBLICADO/OBSOLETO ya no es `DenyAll`; `canViewArchivoDistribucion` pasa a `true` para AUTOR en PUBLICADO) y tests nuevos en `DocumentActionPanel.test.tsx` ("Ver documento" visible para el autor en PUBLICADO y en OBSOLETO).
- [x] 10.4 Delta spec `document-permissions` (MODIFIED) agregado en este change — matriz PUBLICADO/OBSOLETO actualizada con la nota de divergencia del PRD §4.2.
- [x] 10.5 Delta spec `document-viewer-api`: escenario "Sin CA-34, un AUTOR... es rechazado" corregido a OPERARIO (ya no aplica a AUTOR); escenario nuevo confirmando que AUTOR ve el visor en OBSOLETO sin depender de CA-34.
- [x] 10.6 Backend — tests de integración nuevos en `DocumentosVisorEndpointTests.cs`: autor abre el visor de su documento `PUBLICADO` → 200; autor abre el visor de su documento `OBSOLETO` → 200 con el sello; autor pide `GET /:id/archivo-original` en `PUBLICADO`/`OBSOLETO` → sigue en 403/404 (sin cambios al archivo original). (`Publicado_Autor_...`/`Obsoleto_Autor_...`, ya existentes; parte de los 15/15 verificados.)
- [ ] 10.7 Correr la suite completa del frontend (`vitest`), `tsc --noEmit`, y los tests del backend (.NET) — confirmar cero regresiones.
- [ ] 10.8 Detener el backend, `dotnet build`, levantar con MSW apagado (`VITE_ENABLE_MSW=false`) y verificar manualmente: autor abre su documento `PUBLICADO` → ve "Ver documento" con el PDF de distribución; "Descargar archivo original" sigue sin estar disponible.
- [ ] 10.9 Cowork actualiza `SHAC-Mapa-Proceso-Control-Documentario.md` después de verificar el change (fuera del alcance de Claude Code — ver instrucciones).
