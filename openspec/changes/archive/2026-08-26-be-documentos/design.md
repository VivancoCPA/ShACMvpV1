## Context

`ShcMvpEndPoint` no tiene ningún código de Documentos hoy — confirmado de nuevo, no existe `Features/Documentos/` ni `Domain/Entities/Documento.cs`. Este design.md releyó completo el código real (no solo el handoff de Cowork) antes de fijar cada decisión; varias correcciones aparecen abajo porque el handoff original se apoyaba en una lectura de agosto que ya no coincide exactamente con el código actual.

**Patrones confirmados a reutilizar, leídos completos:**

- **Almacenamiento de archivos** — `PlanoStorageService` (`Features/Locales/Shared/PlanoStorageService.cs`): `IWebHostEnvironment env` inyectado, `Path.Combine(env.WebRootPath, "uploads", "planos", empresaId)`, `Directory.CreateDirectory`, nombre de archivo `Guid.NewGuid():N` + extensión, retorna la URL relativa `/uploads/planos/{empresaId}/{nombre}`. Comentario propio ya advierte "aceptable solo para este entorno de desarrollo, no es la solución de almacenamiento de producción" — mismo criterio que este cambio.
- **Secuencia por tipo** — `LocalZonaNumeroGenerator.cs`: `INSERT INTO empresa_secuencias (empresa_id, tipo, anio, ultimo_valor) VALUES (@empresaId, @tipo, @anio, 1) ON CONFLICT (empresa_id, tipo, anio) DO UPDATE SET ultimo_valor = ultimo_valor + 1 RETURNING ultimo_valor`, ejecutado como SQL crudo sobre `db.Database.GetDbConnection()` (reutiliza la transacción ambiente si existe), con `AnioConstante = 0` para los códigos que no llevan año. `EmpresaSecuencia` tiene clave compuesta `(EmpresaId, Tipo, Anio)` sin `Id` propio — confirmado en `Domain/Entities/EmpresaSecuencia.cs`.
- **PIN de firma** — `ShacUser.PinHash` (`ShcMvpEndPoint.Infrastructure/Identity/ShacUser.cs:20`, `string?`), validado con `IPasswordHasher<ShacUser>` (ASP.NET Identity — **no BCrypt**, corrige la instrucción original) vía `pinHasher.VerifyHashedPassword(actor, actor.PinHash, pin)`, exactamente como en `FirmarCierreQEHandler.cs`: `NotFoundException` si la entidad no existe o no pertenece a la empresa activa, `BusinessRuleException` si `actor.PinHash is null` ("Debés configurar tu PIN... POST /api/auth/set-pin"), `UnauthorizedBusinessException` si el PIN no coincide.
- **Notificación best-effort** — `IAsignacionNotificationSender`/`AsignacionNotificationSender` (`Features/Notifications/Shared/`): un record de payload sellado (`sealed record`), una interfaz de un método, una implementación que persiste `Notificacion` directamente vía `ShacDbContext`, invocada en cada call site dentro de `try/catch` con `logger.LogWarning` — nunca bloqueante.
- **Escaneo de vencimiento** — `VencimientoScanner.ScanAsync` (`Features/Notifications/Shared/VencimientoScanner.cs`, `static class`, invocado por el `BackgroundService` `VencimientoScanService`): recorre las 3 tablas de AC (Incidente/NC/QE) vía LINQ+`Join`, calcula `AjustePlazoCalculator.ContarDiasHabiles(ahora, plazoFecha)`, dispara si `VencimientoSemaforo.CalcularEstado(dias) == "AMARILLO"`, checa idempotencia con `AnyAsync(EntidadTipo, EntidadId, Tipo=VENCIMIENTO)` y confía además en un índice único parcial de Postgres para concurrencia (ver Decisión D9 más abajo — este índice, tal como existe hoy, **no soporta** el caso de Documentos).
- **`NotificacionEntidadTipo`/`NotificacionTipo`** (`Domain/Enums/`): `DOCUMENTO` ya existe en el primero, con el comentario explícito "aunque este backend no lo emita todavía" — este cambio lo activa.
- **Estructura de feature** — patrón vertical-slice confirmado en `Features/QualityEvents/*`: `Features/<Modulo>/<Accion>/{<Accion>Command,<Accion>Validator,<Accion>Handler,<Accion>Endpoint}.cs` para mutaciones (EF Core vía `ShacDbContext`); listados usan Dapper puro (`ListarQualityEventsHandler` inyecta `DapperConnectionFactory`, SQL crudo con alias `AS "PascalCase"`), sin Command/Validator.
- **Scoping multi-tenant** — confirmado en `FirmarCierreQEHandler.cs:24`: `if (qe is null || qe.EmpresaId != empresaId) throw new NotFoundException(...)` — 404 antes de cualquier otra validación, nunca 403 (no revela existencia cross-tenant). Mismo patrón para todo endpoint de Documentos.

**Correcciones a la instrucción original de Cowork, confirmadas releyendo el código real (no solo el handoff):**

1. **`POST /api/documents/:id/status` (con `firma`) es código muerto, no una ruta activa.** `documents.api.ts` exporta `changeDocumentStatus` (POST) y `patchDocumentStatus` (PATCH) como funciones separadas. `changeDocumentStatus` solo se referencia desde `useDocuments.ts` (`useChangeDocumentStatus`) y el test de ese mismo hook — ningún componente lo importa. Todas las transiciones reales de UI (`DocumentActionPanel.tsx` vía `useChangeStatus` en `useDocumentActions.ts`) llaman `patchDocumentStatus` (PATCH, sin firma) para BORRADOR→EN_REVISION, EN_REVISION→EN_APROBACION, cancelar revisión, y el rechazo (`DocumentRejectModal`, PATCH con `{estado, motivo, notificarAutor}`). La única transición que exige PIN es `EN_APROBACION → PUBLICADO`, y usa un endpoint completamente distinto: `POST /:id/sign`. La instrucción original ("el mock las mantiene separadas y ambas están activamente en uso") es incorrecta — solo `PATCH /:id/status` está en uso. Esto **simplifica el alcance**: no hace falta una segunda ruta de status con firma.
2. **`POST /api/documents/:id/upload` no es "sin ningún call site"** — sí tiene uno: `useDocumentForm.ts` (líneas ~127-133 y ~149-155) lo invoca en ambos modos (crear/editar) cuando `data.archivo` está presente, con `FormData` campo `archivo`. Sin embargo, `DocumentForm.tsx` no renderiza ningún `Controller`/input con `name="archivo"` — solo `archivoOriginalFile` (original editable) y la vista informativa del PDF de distribución. El campo del schema Zod (`documentForm.schema.ts:23`, `archivo: z.instanceof(File).nullable().optional()`) nunca recibe un valor en la práctica: es código alcanzable pero disparado por cero flujos de usuario reales hoy. La recomendación de no portarlo se mantiene, pero por una razón distinta y más precisa que la del handoff original.
3. **RN-DOC-006 sí está implementada en el mock**, contra lo que afirmaba la instrucción original ("no implementada... solo referenciada en specs"). `generateVencimientoNotifications()` (`src/mocks/fixtures/notificationGeneration.ts:197-230`) ya escanea `getDocumentsStore()`, calcula `differenceInCalendarDays(fechaRevisionProxima, ahora)` — **días corridos, no hábiles** — y dispara cuando `diasRestantes <= DOC_REVISION_ALERT_DAYS` (`businessRules.config.ts:9`, constante = `30`). Los destinatarios son exactamente los que el handoff adivinaba: `doc.autorId` (si resoluble) + todo usuario cuyo `getRolEfectivo(u.id, doc.empresaId)` sea `JEFE_CONTROL_DOCUMENTARIO` o `JEFE_CALIDAD_SYST` en la empresa del documento — resuelto por rol efectivo por empresa, no por `MockUser.rol` global. La idempotencia del mock es **por documento, no por destinatario**: una única `buildVencimientoKey('DOCUMENTO', doc.id)` bloquea toda regeneración futura para ese documento, sin importar cuántos destinatarios se hayan notificado la primera vez. Esto resuelve dos preguntas que el handoff dejaba abiertas (días hábiles vs. corridos; qué semáforo reutilizar) con evidencia directa del código, no con una decisión nueva.

   **Hallazgo adicional, releyendo el bucle completo (líneas 197-204)**: el mock **no filtra por `estado`** — evalúa cualquier documento con `fechaRevisionProxima` no nula dentro de la ventana de 30 días, sin exigir `estado === 'PUBLICADO'`. Esto significa que un documento en `BORRADOR` con `fechaRevisionProxima` ya asignada (posible desde que `fechaVigencia` tiene valor, RN-DOC-020) también dispara la notificación. No es intuitivo desde la lectura de negocio de RN-DOC-006 ("revisión próxima a vencer" implica un documento vigente y publicado), pero es el comportamiento real y verificado del código, y este diseño lo replica fiel al código — mismo criterio que ya aplicó `be-dashboard-api` al implementar el filtro de ACs vencidas fiel al código real en vez de al brief original (ver `be-dashboard-api/spec.md`, Requirement "Resumen SUPERVISOR"). D8 abajo replica esto sin el filtro de estado que la instrucción original hubiera asumido implícitamente.
4. **El índice único de idempotencia de `Notificacion` (D9 de `be-notificaciones`) no soporta destinatarios múltiples por entidad** — ver Decisión D9 más abajo. Este es un hallazgo propio de este design, no anticipado por el handoff, que asumía que "el mismo índice único parcial que ya protege a los otros 3" simplemente se extendería sin cambios.
5. **No existe ningún generador de PDF en el backend hoy** — corrige la premisa original ("mismo stack de generación de PDF ya usado en ExportarPdfQE"). `ExportarPdfQEHandler.cs` (releído completo) solo agrega una entrada de audit trail (`Accion: "EXPORTADO_PDF"`); no genera ningún archivo — esa responsabilidad es 100% del frontend (`buildQualityEventPdf.ts`, client-side). `ShcMvpEndPoint.csproj` no referencia ninguna librería de PDF (`QuestPDF`, `PdfSharp`, `iText`, etc.). Este cambio es el primero en necesitar generación real de PDF server-side (RN-DOC-007 y el PDF de distribución al firmar) — ver Decisión D12 (nueva).

## Goals / Non-Goals

**Goals:**
- Entidad `Documento` + migración, máquina de estados de 6 estados, confidencialidad + `rolesAutorizados`, código correlativo por tipo vía `EmpresaSecuencia`.
- Almacenamiento real en disco (original editable + PDF de distribución) reemplazando los blobs simulados del mock.
- 18 endpoints reales (de 21 del mock, ver Decisión D2 para los 3 excluidos).
- Firma real de publicación vía `ShacUser.PinHash` + verificación de identidad del firmante (`docRole APROBADOR` asignado — brecha que el mock no cierra).
- `IDocumentoNotificationSender` (asignación, rechazo) + 4º bloque de `VencimientoScanner` para RN-DOC-006.
- Resolver 3 de los 4 sentinels de `be-dashboard-api` (KPI-06, `resumenPorModulo.documentos`, `evidenciasHallazgos` vía su comentario actualizado) — el 4º (`documentosPendientesLectura`) permanece sin definición de producto, ver Open Questions.

**Non-Goals:**
- `POST /:id/publicar` y `POST /:id/status` (con firma) — código muerto confirmado, ver Decisión D2.
- `POST /:id/upload` (archivo de trabajo) — alcanzable pero sin ningún flujo de UI que lo dispare, ver Decisión D2.
- Vinculación real Documento↔QE (tabla puente, UI de vincular/desvincular) — ver Decisión D3.
- `documentosPendientesLectura` con semántica real — no existe definición de producto en ningún lado del sistema (ni mock, ni `permissions.ts`, ni ningún componente); se mantiene como sentinel `[]` hasta que exista una decisión de producto explícita.
- Cualquier backend de almacenamiento distinto a disco local (blob storage real) — decisión ya tomada por Toño antes de este documento.

## Decisions

### D1 — Estructura de Features
```
Features/Documentos/
  ListarDocumentos/{Endpoint,Handler,Query,DocumentoListResponse}.cs        (Dapper)
  ObtenerDocumento/{Endpoint,Handler}.cs                                     (Dapper)
  ContarPendientes/{Endpoint,Handler}.cs                                     (Dapper)
  CrearDocumento/{Command,Validator,Handler,Endpoint}.cs                     (EF Core)
  EditarDocumento/{Command,Validator,Handler,Endpoint}.cs
  EliminarDocumento/{Handler,Endpoint}.cs                                    (soft delete)
  RestaurarDocumento/{Handler,Endpoint}.cs
  CambiarEstadoDocumento/{Command,Validator,Handler,Endpoint}.cs             (PATCH /:id/status)
  FirmarPublicarDocumento/{Command,Validator,Handler,Endpoint}.cs            (POST /:id/sign)
  NuevaVersionDocumento/{Command,Validator,Handler,Endpoint}.cs
  ConfirmarRevisionPeriodica/{Handler,Endpoint}.cs
  ExportarPdfControlado/{Handler,Endpoint}.cs
  ObtenerArchivo/{Handler,Endpoint}.cs                                       (GET /:id/archivo — vigente)
  ObtenerDownloadUrl/{Handler,Endpoint}.cs
  RegistrarAccesoAudit/{Handler,Endpoint}.cs
  ArchivoOriginal/{ObtenerHandler,ReemplazarHandler,Endpoint}.cs             (GET + POST)
  ArchivoDistribucion/{Handler,Endpoint}.cs                                  (GET, sirve el ya generado)
  Shared/
    DocumentoStorageService.cs      (D5)
    DocumentoCodigoGenerator.cs     (D4)
    DocumentPermissionResolver.cs   (D6, docRole + matriz)
    IDocumentoNotificationSender.cs / DocumentoNotificationSender.cs (D7)
```
Mismo criterio de D1 en `be-notificaciones`: los listados van por Dapper porque no tienen lógica de negocio, las mutaciones por EF Core porque necesitan tracking de entidades y el `AuditTrail` append-only.

### D2 — Endpoints excluidos de este cambio (3 de 21)
| Endpoint mock | Motivo | Evidencia |
|---|---|---|
| `POST /:id/publicar` | Sin ningún call site en `documents.api.ts` — ni siquiera existe la función wrapper. | Confirmado por grep, ningún resultado fuera del propio handler MSW. |
| `POST /:id/status` (con `firma`) | `changeDocumentStatus`/`useChangeDocumentStatus` solo se referencian entre sí y en su test — cero componentes los importan. | `useDocuments.ts:68-83`, `useDocuments.test.ts`. |
| `POST /:id/upload` | Tiene un call site real (`useDocumentForm.ts`) pero el campo de formulario que lo alimenta (`data.archivo`) nunca se renderiza en `DocumentForm.tsx` — inalcanzable desde cualquier interacción de usuario real. | `useDocumentForm.ts:123-133`, ausencia de `Controller name="archivo"` en `DocumentForm.tsx`. |

Si en el futuro aparece un consumidor real para cualquiera de los tres (p.ej. se agrega el campo de formulario para `archivo`, o una integración API-to-API externa para `/publicar`), es una adición autocontenida — no bloquea este cambio.

### D3 — `qeVinculados`/RN-DOC-005/`evidenciasHallazgos`: opción (b), campo sin UI de vinculación
Se modela `Documento.QeVinculados` como `List<Guid>` (columna JSON o tabla hija simple, sin FK reversa desde QE) — nadie lo puebla en este cambio, pero RN-DOC-005 puede evaluarlo si en el futuro se puebla por otra vía (bloquea pasar a `OBSOLETO` si la lista no está vacía, tratando "cualquier vínculo" como activo — mismo criterio simplificado que el mock, documentado como tal). No se construye tabla puente `DocumentoQualityEvent`, ni botón de vincular/desvincular en ningún detalle.

**Razón**: no existe ningún flujo de UI para *crear* este vínculo — ni en `features/documents/` ni en Quality Events — solo lectura de un banner sobre datos de fixture estático (`DocumentDetailHeader.tsx`). Construir la vinculación completa (tabla puente + UI) sin un flujo real que la alimente es infraestructura sin consumidor, mismo criterio que D2. `EvidenciasHallazgos` de `be-dashboard-api` permanece con su sentinel actual (`{conEvidencia: 0, sinEvidencia: totalHallazgosO3}`); solo se actualiza el comentario para explicar que ahora depende de una vinculación Documento↔QE real que puede llegar en un cambio de seguimiento, no de que Documentos no exista.

Esta es la recomendación de la instrucción original — adoptada tal cual, con la evidencia de UI ya verificada arriba. Queda como confirmación final de Toño antes de `/opsx:apply` (ver Open Questions), no como bloqueo duro: si prefiere partirla en un cambio de seguimiento separado en vez de resolverla aquí, la Sección 6 original ya lo dejaba como alternativa válida.

### D4 — Código correlativo: `EmpresaSecuencia` con clave `Tipo = "DOC_" + tipo`, `Anio = 0`
```csharp
public sealed class DocumentoCodigoGenerator(ShacDbContext db)
{
    public Task<string> GenerarAsync(Guid empresaId, DocType tipo, CancellationToken ct) =>
        GenerarAsync(empresaId, $"DOC_{tipo}", tipo.ToString(), ct); // misma SQL cruda que LocalZonaNumeroGenerator
}
```
Formato final `"{TIPO}-CD-{valor:D3}"` (p.ej. `PRC-CD-007`), sin componente de año — replica `generateCodigo` del mock exactamente. 7 claves de secuencia independientes por empresa (una por `DocType`), reutilizando la tabla `empresa_secuencias` existente sin nueva tabla de contadores — mismo criterio que D3 de `be-crud-locales-zonas`.

### D5 — `DocumentoStorageService`: mismo patrón que `PlanoStorageService`, 3 sub-rutas
```csharp
public sealed class DocumentoStorageService(IWebHostEnvironment env)
{
    public Task<string> GuardarOriginalAsync(Guid empresaId, Guid documentoId, IFormFile archivo, CancellationToken ct);
    public Task<string> GuardarDistribucionAsync(Guid empresaId, Guid documentoId, string version, byte[] pdfBytes, CancellationToken ct);
}
```
Rutas: `wwwroot/uploads/documentos/{empresaId}/{documentoId}/original/{timestamp}-{nombreOriginal}` y `.../distribucion/{version}.pdf`. El archivo "de trabajo" (`archivoUrl`/`hashArchivo`) no tiene método propio — no se porta (D2).

**Retención del original al reemplazar (punto 5 de la instrucción original)**: se archiva con timestamp en el nombre de archivo (no se sobreescribe ni se borra) — consistente con que todo lo demás en este dominio es un sistema de trazabilidad ISO 9001 §7.5 (mismo criterio que el resto del sistema, adoptado sin necesitar confirmación adicional: nunca se destruye evidencia documental en ningún otro flujo de SHAC).

**Copia física en `nueva-version` (punto 6)**: copia real de bytes a la carpeta de la nueva versión (`File.Copy`), no una referencia al archivo de la versión anterior — más simple de razonar y coherente con que el original de la versión vieja queda congelado e inmutable (`ArchivoOriginalBloqueado` no aplica retroactivamente a una versión ya cerrada).

### D6 — `DocumentPermissionResolver`: replica exacta de `permissions.ts`, con la brecha CA-34 cerrada en el backend
`docRole` se resuelve **por documento**, no por `UserRole` global — orden de evaluación exacto (`getDocRoleForUser` del mock): `AUTOR` si `doc.AutorId == actor.Id`; si no, `REVISOR` si `doc.RevisorId == actor.Id`; si no, `APROBADOR` si `doc.AprobadorId == actor.Id`; si no, `JEFE_CALIDAD` si el rol global es `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`; si no, `OPERARIO`.

La matriz de 9 flags por `(estado, docRole)` se porta carácter por carácter desde `permissions.ts` (confirmado línea por línea, incluyendo el caso context-aware de `EN_REVISION_PERIODICA` con `isAssignedAuthor`). Los 3 flags derivados de archivo:
- `canViewArchivoOriginal = docRole != OPERARIO && estado ∈ {BORRADOR, EN_REVISION}` — **excepto** en el endpoint `GET /:id/archivo-original`, donde se aplica la excepción CA-34 confirmada en el propio handler mock (`documents.handlers.ts:244-251`, repetida en el handler de reemplazo): `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` (por rol global, no por `docRole`) también acceden al original de un documento `OBSOLETO`. El backend replica el gate del **handler** (más permisivo, con CA-34), no el flag de UI `canViewArchivoOriginal` (que no la contempla) — es la fuente de verdad ya usada para servir el archivo real. El frontend seguirá subestimando la disponibilidad de este botón para esos 2 roles sobre documentos `OBSOLETO` hasta que se corrija aparte (fuera de alcance de este cambio, según ya señalaba la instrucción original).
- `canReplaceArchivoOriginal = (docRole ∈ {AUTOR, JEFE_CALIDAD}) && estado ∈ {BORRADOR, EN_REVISION} && !ArchivoOriginalBloqueado` — sin excepción CA-34. El mock no valida `docRole` en el `POST` (solo estado y congelamiento) — el backend sí lo valida, cerrando esa brecha (`ForbiddenBusinessException` si `docRole` no califica).
- `canViewArchivoDistribucion = canRead && estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}`.

Confidencialidad (`canAccessDocument`, aplicado en el listado Dapper vía `WHERE` dinámico y revalidado en el detalle): `PUBLICO`/`INTERNO` → cualquier rol del módulo; `CONFIDENCIAL` → `JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`; `RESTRINGIDO` → solo roles en `RolesAutorizados` (mínimo 1 al crear/editar con esta confidencialidad, `422` si vacío — replica la validación Zod del frontend, hoy no revalidada server-side por el mock).

### D7 — `IDocumentoNotificationSender`: mismo patrón que `IAsignacionNotificationSender`
```csharp
public sealed record DocumentoAsignacionNotificacion(Guid EmpresaId, Guid DocumentoId, string Codigo, Guid AsignadoId, Guid ActorId);
public sealed record DocumentoRechazoNotificacion(Guid EmpresaId, Guid DocumentoId, string Codigo, Guid AutorId, Guid ActorId);

public interface IDocumentoNotificationSender
{
    Task NotificarAsignacionAsync(DocumentoAsignacionNotificacion n, CancellationToken ct);
    Task NotificarRechazoAsync(DocumentoRechazoNotificacion n, CancellationToken ct);
}
```
Disparadores: al crear/editar con `revisorId`/`aprobadorId` nuevo o distinto del anterior → `ASIGNACION` al asignado (excluyendo autoasignación, mismo criterio que D5 de `be-notificaciones`). Al rechazar (`PATCH /:id/status` con `estado: BORRADOR` y `notificarAutor: true`) → `CAMBIO_ESTADO` al autor. Ambos best-effort (`try/catch` + `logger.LogWarning`), nunca bloqueantes.

### D8 — RN-DOC-006: 4º bloque de `VencimientoScanner`, días corridos, umbral 30, destinatarios múltiples
```csharp
private static async Task EscanearDocumentosAsync(ShacDbContext db, DateTime ahora, CancellationToken ct)
{
    // Sin filtro de Estado — el mock tampoco lo aplica (D8, hallazgo confirmado en el código real:
    // notificationGeneration.ts:197-204 no exige PUBLICADO, solo FechaRevisionProxima no nula).
    var documentos = await db.Documentos
        .Where(d => d.FechaRevisionProxima != null && d.DeletedAt == null)
        .ToListAsync(ct);

    foreach (var doc in documentos)
    {
        var diasRestantes = (doc.FechaRevisionProxima!.Value.Date - ahora.Date).Days; // calendario, no hábiles (D8, evidencia del mock)
        if (diasRestantes > 30) continue; // DOC_REVISION_ALERT_DAYS

        var yaExiste = await db.Notificaciones.AnyAsync(
            n => n.EntidadTipo == NotificacionEntidadTipo.DOCUMENTO && n.EntidadId == doc.Id && n.Tipo == NotificacionTipo.VENCIMIENTO, ct);
        if (yaExiste) continue; // idempotencia por documento, no por destinatario — replica el mock

        var destinatarios = await ResolverDestinatariosAsync(db, doc.EmpresaId, doc.AutorId, ct); // autor + JEFE_CONTROL_DOCUMENTARIO/JEFE_CALIDAD_SYST via UsuarioEmpresa
        foreach (var usuarioId in destinatarios)
            db.Notificaciones.Add(new Notificacion { /* ... Tipo=VENCIMIENTO, EntidadTipo=DOCUMENTO, EntidadId=doc.Id ... */ });

        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { db.ChangeTracker.Clear(); } // ver D9 — solo protege correctamente tras el cambio de índice
    }
}
```
No se reutiliza `VencimientoSemaforo.CalcularEstado` (construido para el umbral de 5 días hábiles de ACs) — es un umbral y una unidad de tiempo distintos (30 días corridos, confirmado en el mock, no una decisión nueva de este documento). El umbral se expresa como literal `30` documentado, no una nueva constante en `appsettings` (mismo nivel de configurabilidad que el mock, que tampoco lo expone).

### D9 — Corrección necesaria al índice único de idempotencia de `Notificacion` (hallazgo propio, no anticipado por la instrucción)
El índice actual (`ShacDbContext.cs:251-253`, introducido en `be-notificaciones` D9):
```csharp
entity.HasIndex(e => new { e.EntidadTipo, e.EntidadId })
      .HasFilter("tipo = 'VENCIMIENTO'")
      .IsUnique();
```
protege correctamente los 3 bloques existentes porque cada AC tiene **un solo** `ResponsableId` → una sola fila `Notificacion` por `(EntidadTipo=AC, EntidadId)`. El bloque de Documentos (D8) necesita **N filas** (una por destinatario: autor + cada Jefe) con el mismo `(EntidadTipo=DOCUMENTO, EntidadId)` — bajo el índice actual, solo la primera fila insertada por documento tendría éxito; las siguientes violarían la restricción única y se descartarían silenciosamente vía el `catch (DbUpdateException)` ya existente, dejando a los demás destinatarios sin notificar sin ningún error visible.

**Decisión**: ampliar el índice a `(EntidadTipo, EntidadId, UsuarioId)` (migración que elimina y recrea el índice existente):
```csharp
entity.HasIndex(e => new { e.EntidadTipo, e.EntidadId, e.UsuarioId })
      .HasFilter("tipo = 'VENCIMIENTO'")
      .IsUnique();
```
Esto no cambia ningún comportamiento observable de los 3 bloques existentes (cada AC sigue generando como máximo 1 fila, ahora con la garantía "por AC y por responsable" en vez de solo "por AC" — equivalente en la práctica). El chequeo `AnyAsync` en código para el bloque de Documentos sigue siendo **por documento** (no por destinatario), replicando la semántica del mock de "si ya existe alguna notificación para este documento, no generar ninguna más" — el índice de BD es la garantía de concurrencia, no la regla de negocio de idempotencia (que sigue viviendo en el `AnyAsync` previo al loop de destinatarios).

### D10 — Firma de publicación: verificación de identidad que el mock no hace
`POST /:id/sign` valida `command.Pin` contra `actor.PinHash` (D6/`FirmarCierreQEHandler`) **y además** exige `docRole == APROBADOR` (i.e. `actor.Id == documento.AprobadorId`) antes de aceptar la firma — el mock solo valida el PIN fijo, sin comprobar que el firmante sea el aprobador asignado (`permissions.ts` sí lo exige a nivel de UI, pero el handler MSW no lo revalida). `ForbiddenBusinessException` si el actor no es el aprobador asignado. Efecto: `Estado → PUBLICADO`, obsoletiza automáticamente la versión `PUBLICADO` previa del mismo código (RN-DOC-001), congela `ArchivoOriginalBloqueado = true`, genera el PDF de distribución (D5).

### D11 — Dashboard: 3 de 4 sentinels resueltos
- **KPI-06**: `(docs PUBLICADO no eliminados con FechaRevisionProxima nula o futura) / (docs no eliminados, excluyendo OBSOLETO) × 100`. Supuesto documentado (no confirmado en código, es una lectura de una fórmula de una línea del PRD): "documentos activos" excluye `OBSOLETO` porque un documento obsoleto ya no está "bajo control" en curso.
- **`ResumenPorModulo.Documentos`**: `Total` = no eliminados; `Publicados` = `Estado == PUBLICADO`; `VencidosRevision` = `PUBLICADO` con `FechaRevisionProxima < hoy`.
- **`EvidenciasHallazgos`**: sin cambio de valor (D3) — solo se actualiza el comentario.
- **`DocumentosPendientesLectura`**: sin cambio — ver Open Questions.

### D12 — Nueva dependencia: generación de PDF server-side (hallazgo propio, no anticipado por la instrucción)
Se agrega `PdfSharpCore` (MIT, sin restricciones de licencia por ingresos, sin dependencia de `System.Drawing`/GDI+ — corre en Linux/contenedores) como `PackageReference` en `ShcMvpEndPoint.csproj`. Se usa para dos casos, ambos simples (texto plano sobre una página, sin maquetación compleja): (1) el PDF de distribución generado una sola vez al firmar (`FirmarPublicarDocumento`), contenido mínimo (código, título, versión, fecha) sin marca de agua; (2) el PDF controlado exportado bajo demanda (RN-DOC-007), con la marca de agua real (nombre del usuario, timestamp Lima, hash SHA-256, leyenda "COPIA NO CONTROLADA"). No se evaluaron alternativas con licenciamiento comercial (QuestPDF Community tiene límite de ingresos por organización, iText es AGPL/comercial) porque no aportan nada adicional para este caso de uso (texto simple, sin gráficos).

**Nota de seguridad**: `PdfSharpCore 1.3.67` trae como dependencia transitiva `SixLabors.ImageSharp 1.0.4`, con múltiples CVE de severidad alta/moderada conocidas (`NU1902`/`NU1903`, confirmado por `dotnet add package` al instalar). Se fija explícitamente `SixLabors.ImageSharp` a `3.1.12` (`PackageReference` directa, misma técnica de override de dependencia transitiva) — resuelve sin advertencias y compila sin cambios de API visibles para este caso de uso (no se manipulan imágenes, solo texto).

### D13 — Mecanismo real de URL firmada (hallazgo de implementación, no anticipado en D1)
El D1 original no detallaba cómo implementar "URL firmada" para `GET /:id/download-url`/`GET /:id/archivo` más allá del contrato `{url, expiresAt}`. Implementado como: `DocumentoSignedUrlService` (`Features/Documentos/Shared/`) genera un token opaco Base64Url autocontenido (`documentoId|recurso|expiración|firma HMAC-SHA256`, clave de `Documentos:SigningKey` en configuración), y `GET /api/documents/stream/{token}` (endpoint nuevo, deliberadamente **sin** `[Authorize]`) sirve el archivo si el token es válido y no expiró — la posesión de un token vigente es la única prueba de autorización, igual que una URL pre-firmada real (S3, Azure Blob, etc.). Los permisos (confidencialidad, `docRole`, CA-34) se validan una sola vez, al emitir el token; el endpoint de streaming no los revalida. `DocumentoArchivoVigenteResolver` decide qué archivo es el "vigente" (distribución si `PUBLICADO`/`EN_REVISION_PERIODICA` y ya existe; si no, el original con el mismo gate CA-34 que `GET /:id/archivo-original`).

## Risks / Trade-offs

- [Riesgo] Ampliar el índice único de `Notificacion` (D9) toca una migración ya archivada (`be-notificaciones`) → Mitigación: es aditivo en la práctica (mismo comportamiento observable para los 3 bloques existentes), se implementa como una migración EF Core nueva que hace `DropIndex` + `CreateIndex`, no se edita la migración original.
- [Riesgo] `DocumentoStorageService` sobre disco local no sobrevive un despliegue multi-instancia ni un redeploy sin volumen persistente → Mitigación: mismo riesgo ya aceptado y documentado para `PlanoStorageService`; explícitamente fuera de alcance por decisión de Toño (disco local, no blob storage, por ahora).
- [Riesgo] La excepción CA-34 replicada solo en el backend (D6) deja al frontend subestimando el botón de descarga del original para `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` sobre documentos `OBSOLETO` → Mitigación: ya es el estado actual con el mock (mismo gap), no lo introduce este cambio; se documenta como fix de frontend pendiente, fuera de alcance.
- [Riesgo, no bloqueante] `EvidenciasHallazgos` sigue siendo un sentinel tras este cambio (D3) → Mitigación: es la recomendación explícita de la instrucción original, con evidencia de que no hay UI que lo alimente; puede resolverse en un cambio de seguimiento si Toño decide construir la vinculación completa.

## Migration Plan

1. Migración EF Core: tabla `documentos` (+ tabla hija de auditoría `documento_audit_trail`), 4 enums (`DocStatus`, `DocType`, `DocConfidencialidad`, `DocumentoAuditAccion`), y la migración correctiva del índice de `Notificacion` (D9).
2. `DocumentoCodigoGenerator` (D4), `DocumentoStorageService` (D5), `DocumentPermissionResolver` (D6).
3. Los 18 endpoints (D1, D2), reutilizando `IPasswordHasher<ShacUser>` para `/sign` (D10).
4. `IDocumentoNotificationSender`/`DocumentoNotificationSender` (D7), 4º bloque de `VencimientoScanner` (D8).
5. `DashboardKpiCalculator.CalcularKpi06()`, `DashboardSummaryBuilder.BuildAltaDireccion`/`BuildAuditor` (D11).
6. Registrar en `Extensions/EndpointExtensions.cs` (18 endpoints + el sender).
7. `dotnet build` + `dotnet test` — Toño corre y reporta (Cowork no tiene SDK de .NET en este entorno).
8. Sin rollback especial — no hay datos de producción; la migración del índice de `Notificacion` es reversible (`Down()` restaura el índice de 2 columnas).

## Open Questions

1. **`documentosPendientesLectura`** (rol OPERARIO, `be-dashboard-api`) — no tiene definición en ningún lugar del sistema (ni mock, ni specs, ni componentes). Necesita respuesta de Toño antes de implementar: ¿documentos `PUBLICADO` del área del operario sin un mecanismo de "confirmar lectura" (¿cuál?), o simplemente los `PUBLICADO` de su área sin tracking real? Hasta tener respuesta, este campo permanece como sentinel `[]` en este cambio.
2. **Confirmación final de D3** (alcance (b) para `qeVinculados`) — la evidencia de código ya respalda la recomendación, pero queda para el visto bueno explícito de Toño antes de `/opsx:apply`, tal como pedía la instrucción original.
