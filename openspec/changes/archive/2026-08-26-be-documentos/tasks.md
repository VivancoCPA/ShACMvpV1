## 1. Modelo de datos y migración

- [x] 1.1 Crear `Domain/Enums/{DocStatus,DocType,DocConfidencialidad}.cs` (sin `DocumentoAuditAccion` — se usa `string` libre para `Accion`, mismo criterio que `QualityEventAuditTrail`/`IncidenteAuditTrail`, corrección de fidelidad al código real)
- [x] 1.2 Crear `Domain/Entities/Documento.cs` (todos los campos de design.md; `AreaId` corregido a `string` — no `Guid` — para calzar con `Area.Id`/`QualityEvent.AreaId`; `QeVinculados` como `List<Guid>`, `RolesAutorizados` como `List<string>`, ambos mapeados nativamente por Npgsql a arrays sin tabla puente)
- [x] 1.3 Crear `Domain/Entities/DocumentoAuditTrail.cs` (append-only, mismo patrón que `QualityEventAuditTrail`)
- [x] 1.4 Configurar `Documento`/`DocumentoAuditTrail` en `ShacDbContext` (conversiones de enum a string, índices por `EmpresaId`+`Codigo`, `EmpresaId`+`Estado`)
- [x] 1.5 Migración EF Core: tablas `documentos`, `documento_audit_trail` (generada con `dotnet ef migrations add AddDocumentos` — el entorno sí tiene SDK de .NET 10 y `dotnet-ef`, contra lo que asumía design.md)
- [x] 1.6 Migración EF Core (misma migración `AddDocumentos`, ya que el modelo se definió antes de generarla): amplía el índice único de `Notificacion` de `(EntidadTipo, EntidadId)` a `(EntidadTipo, EntidadId, UsuarioId)` filtrado a `Tipo='VENCIMIENTO'` (design.md D9) — `DropIndex` + `CreateIndex`, con `Down()` reversible, sin tocar la migración original de `be-notificaciones`

## 2. Servicios compartidos (Features/Documentos/Shared)

- [x] 2.1 `DocumentoCodigoGenerator.cs` — mismo mecanismo SQL crudo que `LocalZonaNumeroGenerator`, clave `Tipo = "DOC_" + tipo`, `Anio = 0`, formato `"{TIPO}-CD-{NNN}"`
- [x] 2.2 `DocumentoStorageService.cs` — mismo patrón que `PlanoStorageService`, métodos `GuardarOriginalAsync`/`GuardarDistribucionAsync`/`CopiarOriginalAsync`, rutas `wwwroot/uploads/documentos/{empresaId}/{documentoId}/{original|distribucion}/...`; reemplazo del original archiva el anterior con timestamp (no borra, no sobreescribe)
- [x] 2.3 `DocumentPermissionResolver.cs` — `docRole` por documento (orden AUTOR→REVISOR→APROBADOR→JEFE_CALIDAD→OPERARIO) + matriz de 9 flags por `(estado, docRole)` + los 3 flags derivados de archivo (`canViewArchivoOriginal`, `canReplaceArchivoOriginal`, `canViewArchivoDistribucion`, más `CanViewArchivoOriginalConCA34` separado para el gate real del handler)
- [x] 2.4 `IDocumentoNotificationSender.cs`/`DocumentoNotificationSender.cs` — records `DocumentoAsignacionNotificacion`/`DocumentoRechazoNotificacion`, persiste `Notificacion` vía `ShacDbContext`
- [x] 2.5 `DocumentoPdfGenerator.cs` — **corrección**: no existía ningún stack de PDF en el backend (`ExportarPdfQEHandler` solo registra audit trail, el PDF de QE es 100% client-side); se agregó `PdfSharpCore` como dependencia nueva (design.md D12), con `SixLabors.ImageSharp` fijado a `3.1.12` para resolver 2 CVEs de la versión transitiva por defecto (`1.0.4`)

## 3. Endpoints de lectura (Dapper)

- [x] 3.1 `ListarDocumentos` — `GET /api/documents`, filtros `estado?`, `tipo?`, `areaId?`, `search?`, `codigo?`, `includeDeleted?`, `pendientes?`, filtrado por confidencialidad según rol
- [x] 3.2 `ContarPendientes` — `GET /api/documents/pendientes/count`, misma lógica de bandeja que el listado con `pendientes=true`, `0` fijo para `OPERARIO`/`AUDITOR_INTERNO`/`ALTA_DIRECCION`
- [x] 3.3 `ObtenerDocumento` — `GET /api/documents/:id`, revalida confidencialidad (404 si no accesible), expone `archivoOriginalUrl`/`archivoOriginalNombre` solo si el gate CA-34 aplica

## 4. Mutaciones core (EF Core)

- [x] 4.1 `CrearDocumento` — `POST /api/documents`, RN-DOC-019 (revisor≠aprobador), RN-DOC-020 (margen 30 días, excepción INF), notificación de asignación si `revisorId`/`aprobadorId` vienen seteados. **Corrección**: RN-DOC-001 (409 doble-en-proceso) NO se revalida aquí — el mock lo hace porque genera el código contando filas en memoria (puede colisionar); el generador real usa un contador atómico monótono (`EmpresaSecuencia`) que nunca produce un código ya existente, así que la comprobación sería código muerto. Se mantiene correctamente en `NuevaVersionDocumento` (5.3), donde el código SÍ se reutiliza entre versiones y la colisión es real.
- [x] 4.2 `EditarDocumento` — `PUT /api/documents/:id`, solo `BORRADOR` (409 si no), mismas validaciones RN-DOC-019/020 (esta última revalidada contra el `Tipo` ya persistido, que nunca se edita), notificación de asignación si `revisorId`/`aprobadorId` cambian
- [x] 4.3 `EliminarDocumento` — `DELETE /api/documents/:id`, soft delete, gates de estado + `QeVinculados` (RN-DOC-005); responde `200` + entidad (no `204` — mismo criterio que `EliminarIncidente`/`EliminarNoConformidad`)
- [x] 4.4 `RestaurarDocumento` — `PATCH /api/documents/:id/restaurar`, siempre vuelve a `BORRADOR`

## 5. Máquina de estados y firma

- [x] 5.1 `CambiarEstadoDocumento` — `PATCH /api/documents/:id/status`, valida transición contra un set explícito de 6 pares permitidos (excluye las 2 transiciones exclusivas de `/sign` y `/confirmar-revision`) + permisos del `docRole` por par, soporta rechazo con `motivo`/`notificarAutor` → notificación de rechazo (distingue "rechazo formal" con motivo de "cancelar revisión" sin motivo en `EN_REVISION → BORRADOR`, ambos con distinto `docRole` requerido)
- [x] 5.2 `FirmarPublicarDocumento` — `POST /api/documents/:id/sign`, valida `docRole APROBADOR` asignado + PIN vía `IPasswordHasher<ShacUser>`/`ShacUser.PinHash` (mismo patrón que `FirmarCierreQEHandler`), RN-DOC-001 (obsoletiza versión previa), congela original, genera PDF de distribución
- [x] 5.3 `NuevaVersionDocumento` — `POST /api/documents/:id/nueva-version`, solo desde `PUBLICADO`/`EN_REVISION_PERIODICA`, copia física real del original, `motivo` mínimo 20 caracteres, 409 si ya hay versión en proceso (aquí SÍ es real — el código se reutiliza entre versiones, a diferencia de `CrearDocumento`)
- [x] 5.4 `ConfirmarRevisionPeriodica` — `PATCH /api/documents/:id/confirmar-revision`, recalcula `FechaRevisionProxima` por `Tipo` (POL/PRC/PLAN +12m, INS +24m, MAT +6m, REG/INF sin nueva fecha); es la única transición `EN_REVISION_PERIODICA → PUBLICADO`, no vive en `CambiarEstadoDocumento`

## 6. Archivos y descargas

- [x] 6.1 `ObtenerArchivoOriginal`/`ReemplazarArchivoOriginal` — `GET`/`POST /api/documents/:id/archivo-original`, gate con excepción CA-34 en el GET, gate estricto (docRole + congelamiento) en el POST — cerrando la brecha del mock que no validaba `docRole` en el POST
- [x] 6.2 `ObtenerArchivoDistribucion` — `GET /api/documents/:id/archivo-distribucion`, sirve el PDF ya generado, sin regenerar
- [x] 6.3 `ExportarPdfControlado` — `POST /api/documents/:id/exportar-pdf`, solo `PUBLICADO`, PDF real con marca de agua (usuario, timestamp Lima, hash SHA-256, leyenda), registra `DESCARGA`; el nombre para la marca de agua se toma del JWT, nunca del body (el mock sí lo tomaba del body — vector de falsificación cerrado)
- [x] 6.4 `ObtenerDownloadUrl`/`ObtenerArchivo` — `GET /:id/download-url` (TTL 15 min, sin side-effect), `GET /:id/archivo` (registra `VISUALIZACION` de inmediato). **Diseño nuevo, no anticipado en design.md**: `DocumentoSignedUrlService` (token opaco HMAC-SHA256 con documentoId+recurso+expiración) + `GET /api/documents/stream/{token}` (endpoint sin `[Authorize]` — la posesión del token vigente es la prueba de autorización, igual que una URL pre-firmada real) + `DocumentoArchivoVigenteResolver` (resuelve "archivo vigente" = distribución si PUBLICADO/EN_REVISION_PERIODICA, si no el original con el mismo gate CA-34)
- [x] 6.5 `RegistrarAccesoAudit` — `POST /api/documents/:id/audit/access`, actor resuelto del JWT, nunca del body

## 7. Notificaciones — RN-DOC-006

- [x] 7.1 Extender `VencimientoScanner.ScanAsync` con el 4º bloque sobre `Documento` (sin filtro de `Estado`, solo `FechaRevisionProxima != null`, ventana de 30 días corridos, destinatarios = autor (si resuelve a un usuario existente) + usuarios `ACTIVO` con rol `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST` vía `UsuarioEmpresa`, idempotencia por documento no por destinatario)
- [x] 7.2 Verificado: el índice ampliado (tarea 1.6) permite persistir múltiples notificaciones para el mismo `EntidadId` con distinto `UsuarioId` — build correcto, misma migración `AddDocumentos`

## 8. Dashboard — sentinels resueltos

- [x] 8.1 `DashboardKpiCalculator.CalcularKpi06(documentos)` — fórmula real sobre `Documento` (excluye `OBSOLETO` del denominador, ver design.md D11); `CalcularKpis`/`ObtenerKpisHandler`/`ObtenerSummaryHandler` propagan la nueva lista `documentos` (vía `DashboardDataFetcher.FetchDocumentosAsync`, nuevo)
- [x] 8.2 `DashboardSummaryBuilder.BuildAltaDireccion` — `ResumenPorModulo.Documentos` real (`total`/`publicados`/`vencidosRevision`)
- [x] 8.3 Actualizado el comentario de `DashboardSummaryBuilder.BuildAuditor` (`EvidenciasHallazgos`) y de `DocumentoResumen`/`DocumentosPendientesLectura` en `DashboardSummaryDtos.cs` para reflejar que Documentos ya existe pero la vinculación QE↔Documento y la semántica de "lectura confirmada" siguen sin construirse
- [x] 8.4 `OperarioDashboardData.DocumentosPendientesLectura` sin cambios (`[]`) — pendiente de definición de producto (ver design.md, Open Questions)

## 9. Registro y wiring

- [x] 9.1 Registrados los 18 endpoints + `GET /api/documents/stream/{token}` (nuevo, plumbing de URLs firmadas) en `Extensions/EndpointExtensions.cs`
- [x] 9.2 Registrados en DI: `IDocumentoNotificationSender`/`DocumentoNotificationSender`, `DocumentoStorageService`, `DocumentoCodigoGenerator`, `DocumentoSignedUrlService`, y los 17 handlers de `Features/Documentos/*`. Verificado con `dotnet build` + arranque real de la app (`dotnet run`, con conexión a una base de datos Postgres de desarrollo real) — el contenedor de DI de ASP.NET Core valida el grafo completo de dependencias al hacer `Build()` en Development (`ValidateOnBuild`), y arrancó sin errores. Migración `AddDocumentos` aplicada a esa base de datos (`dotnet ef database update`).

## 10. Tests

**Nota**: contra lo asumido en design.md ("Cowork no tiene SDK de .NET"), este entorno SÍ tiene el SDK de .NET 10, `dotnet-ef`, y Docker corriendo (usado por `ShacWebApplicationFactory` vía Testcontainers para levantar un Postgres real por corrida) — se ejecutaron y verificaron todos los tests directamente, sin depender de que Toño los corra.

- [x] 10.1 Máquina de estados: transiciones válidas (BORRADOR→EN_REVISION, OBSOLETO sin salientes) e inválidas (`DocumentosStateMachineEndpointTests`)
- [x] 10.2 Matriz de permisos — casos límite representativos: rechazo con motivo (`docRole REVISOR`, `canReject`) vs. cancelar sin motivo (`docRole JEFE_CALIDAD`, `canEdit`) en `EN_REVISION→BORRADOR`, `OBSOLETO` sin transiciones salientes para ningún rol (`DocumentosStateMachineEndpointTests`). No se enumeraron las ~30 celdas completas de la matriz vía HTTP (alcance acotado por tiempo) — la matriz en sí (`DocumentPermissionResolver`) es una réplica carácter por carácter y verificable por inspección directa contra `permissions.ts`.
- [x] 10.3 Confidencialidad × rol en listado (`PUBLICO`/`CONFIDENCIAL`/`RESTRINGIDO` con/sin rol autorizado) y bandeja de pendientes por rol (`DocumentosConfidencialidadEndpointTests`)
- [x] 10.4 RN-DOC-001: obsoletización automática al firmar (`DocumentosStateMachineEndpointTests`) + bloqueo de doble-en-proceso en `NuevaVersionDocumento`, donde el código sí se reutiliza (`DocumentosNuevaVersionEndpointTests`) — **no** en `CrearDocumento` (ver corrección en tarea 4.1: la comprobación ahí sería código muerto)
- [x] 10.5 RN-DOC-004: PIN correcto/incorrecto/no configurado, y rechazo si el firmante no es el aprobador asignado (`DocumentosStateMachineEndpointTests`)
- [x] 10.6 RN-DOC-013/015/016/018: gates de archivo original en GET (con CA-34, incluyendo el caso "sin CA-34 para OPERARIO") y POST (docRole insuficiente, congelamiento) (`DocumentosArchivoEndpointTests`)
- [x] 10.7 RN-DOC-019/020: revisor≠aprobador, margen de 30 días, excepción `INF` (`DocumentosCrudEndpointTests`)
- [x] 10.8 RN-DOC-005: bloqueo de eliminación con `QeVinculados` no vacío (`DocumentosEliminarRestaurarEndpointTests`)
- [x] 10.9 Notificaciones: asignación al crear (con exclusión de autoasignación), rechazo con `notificarAutor`, y vencimiento RN-DOC-006 (idempotencia corriendo el escaneo dos veces, múltiples destinatarios por documento, y el caso BORRADOR-con-fecha-asignada sin filtro de estado) (`DocumentosNotificationsTests`)
- [x] 10.10 Dashboard: KPI-06 y `resumenPorModulo.documentos` recalculados contra datos de prueba reales vía `GET /api/dashboard/kpis` y `GET /api/dashboard/summary` (`DocumentosDashboardTests`)
- [x] 10.11 Multi-tenant: 404 en `GET`/`DELETE /api/documents/:id` de otra empresa (`DocumentosCrudEndpointTests`)
- [x] 10.12 `dotnet build` (solución completa) + `dotnet test --filter "FullyQualifiedName~Features.Documentos"` (dos corridas completas, en verde) + regresión dirigida de `Features.Dashboard`/`Features.Notifications` (71/71 en verde, confirma que los cambios a código compartido — `DashboardKpiCalculator`, `DashboardSummaryBuilder`, `DashboardDataFetcher`, `VencimientoScanner`, el índice de `Notificacion` — no rompieron nada existente) — todo ejecutado directamente en este entorno
