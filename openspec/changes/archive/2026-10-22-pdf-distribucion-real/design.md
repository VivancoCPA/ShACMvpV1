## Context

`DocumentoPdfGenerator.GenerarDistribucion` y `GenerarControlado` (`Features/Documentos/Shared/DocumentoPdfGenerator.cs`) son el primer (y hasta ahora único) generador de PDF server-side del backend — ninguna otra feature usa PdfSharpCore para generar contenido desde cero. Ambos métodos arman una sola página con metadatos y nunca leen `Documento.ArchivoOriginalUrl` (el `.docx`/`.xlsx` subido por el autor, servido desde disco vía `DocumentoStorageService`). `FirmarPublicarDocumentoHandler` llama a `GenerarDistribucion` dentro de la transacción de firma y guarda el resultado con `DocumentoStorageService.GuardarDistribucionAsync` como `{version}.pdf`; `ExportarPdfControladoHandler` llama a `GenerarControlado` bajo demanda (RN-DOC-007) y nunca toca el archivo de distribución guardado.

El `.csproj` del backend ya referencia `PdfSharpCore` y `SixLabors.ImageSharp`, pero no existe ningún motor de conversión Office→PDF. `ArchivoOriginalUrl`/`ArchivoOriginalNombre` son nullable en el dominio (`Documento.cs`) — RN-DOC-017 permite documentos sin archivo original, y ningún paso del flujo (`BORRADOR → EN_REVISION → EN_APROBACION`) lo exige hoy.

**Decisiones ya tomadas por Toño (no abiertas a discusión en este design):**
- D1: conversión con LibreOffice instalado (`soffice --headless --convert-to pdf`), ejecutado como proceso del backend. Descartados: Gotenberg en Docker, librería comercial .NET, subida manual del PDF por el usuario.
- D2: el PDF se genera al firmar y publicar (momento actual), no al pasar a `EN_APROBACION`.
- El hosting de producción (dónde corre `soffice` en producción) queda fuera de este change — la conversión depende solo de configuración (ruta del ejecutable), sin asumir SO ni contenedor.

## Goals / Non-Goals

**Goals:**
- El PDF de distribución (maestro, guardado al publicar) contiene el contenido real del archivo original, convertido por LibreOffice, con un sello de página aplicado sobre el PDF convertido.
- El PDF controlado exportado bajo demanda parte del PDF de distribución real (no genera su propia página de metadatos).
- La firma es atómica respecto a la conversión: si la conversión falla, no se publica nada (ni cambio de estado, ni obsoletización de la versión previa, ni archivo huérfano).
- Un documento sin archivo original no puede firmarse — mensaje de bloqueo explícito, no una portada dummy.
- El hash SHA-256 del archivo publicado queda registrado en el audit trail (`FIRMA_REGISTRADA`).
- La conversión es segura bajo concurrencia (perfil de LibreOffice aislado + límite de conversiones simultáneas) y nunca cuelga indefinidamente (timeout con kill de proceso).

**Non-Goals:**
- No se define ni configura infraestructura de producción para `soffice` (contenedor, VM, servicio administrado) — solo la configuración del lado de la aplicación.
- No se implementa un endpoint para subir un PDF de distribución directamente cuando no hay archivo original (pregunta abierta, ver abajo).
- No se agrega la validación de archivo original obligatorio en `BORRADOR → EN_REVISION` (pregunta abierta, ver abajo) — en este change el bloqueo ocurre solo en la firma, donde ya era inevitable.
- No se migran masivamente los documentos `PUBLICADO` existentes que quedaron con el PDF dummy.
- No se resuelve la divergencia de texto "COPIA NO CONTROLADA" vs. PRD "COPIA CONTROLADA" (pregunta abierta).

## Decisions

### D3 — Interfaz y ubicación del conversor
`IDocumentoPdfConverter` con `Task<byte[]> ConvertirAsync(Stream original, string nombreArchivo, CancellationToken ct)`, implementación `LibreOfficePdfConverter`, ambos en `Features/Documentos/Shared/` (mismo namespace que `DocumentoPdfGenerator` y `DocumentoStorageService`, con quienes colabora directamente). Se registra en DI como singleton (mantiene el `SemaphoreSlim` de concurrencia vivo durante toda la vida de la app) con alcance `IDocumentoPdfConverter` → para que los handlers y los tests dependan de la interfaz, nunca de la implementación concreta.

### D4 — Configuración (`PdfConversion`)
Sección nueva en `appsettings.json`:
```json
"PdfConversion": {
  "SofficePath": "soffice",
  "TimeoutSeconds": 60,
  "MaxConcurrentConversions": 2
}
```
`appsettings.Development.json.example` documenta el valor típico de Windows: `C:\\Program Files\\LibreOffice\\program\\soffice.exe`. Se lee con `IOptions<PdfConversionOptions>` (patrón estándar .NET), nunca `IConfiguration` directo en el servicio.

### D5 — Aislamiento por conversión
Cada llamada a `ConvertirAsync` crea un directorio temporal único (`Path.GetTempPath()/shac-pdfconv-{Guid}`), escribe ahí el archivo original con su extensión real (necesaria para que LibreOffice detecte el formato), y ejecuta:
```
soffice --headless --convert-to pdf --outdir <tmp> <tmp>/<nombreArchivo>
       -env:UserInstallation=file:///<tmp>/lo-profile
```
El perfil de usuario aislado (`-env:UserInstallation`) es obligatorio: sin él, dos conversiones simultáneas (o una instancia de LibreOffice ya abierta en la misma máquina) compiten por el lock del perfil por defecto y el proceso falla o cuelga. El directorio temporal se borra siempre en un `finally`, incluso si la conversión falla o hace timeout.

### D6 — Concurrencia y timeout
Un `SemaphoreSlim(MaxConcurrentConversions)` a nivel de instancia del servicio limita cuántas conversiones corren en paralelo; una conversión que no puede adquirir el semáforo espera (no falla) — el timeout se mide desde que arranca el proceso, no desde que se solicita la conversión. El proceso se lanza con `ProcessStartInfo` + `ArgumentList` (nunca concatenación de strings ni `UseShellExecute = true`) para que el nombre de archivo del usuario nunca se interprete como argumentos de shell. Si `Process.WaitForExitAsync` no completa dentro de `TimeoutSeconds`, se llama `process.Kill(entireProcessTree: true)` y se lanza `PdfConversionException` con mensaje claro ("La conversión del documento excedió el tiempo límite").

### D7 — Manejo de errores de conversión
`LibreOfficePdfConverter` lanza `PdfConversionException` (nueva, interna a Shared) en tres casos: el ejecutable no existe o no es ejecutable, el proceso termina con código ≠ 0, o el PDF esperado no aparece en el directorio de salida. `FirmarPublicarDocumentoHandler` atrapa esa excepción y la traduce a `BusinessRuleException("No se pudo generar el PDF del documento. Intenta de nuevo o contacta al administrador", "PDF_CONVERSION_FAILED")` — mismo mecanismo que `PIN_NO_CONFIGURADO`, que `ApiExceptionHandler` ya mapea a `422 Unprocessable Entity` (no un 500 genérico). Como la conversión ocurre *antes* de cualquier mutación de estado o `SaveChangesAsync`, una excepción ahí deja el `DbContext` sin cambios pendientes — no se necesita rollback manual ni transacción explícita adicional.

### D8 — Health check de arranque
Un log de advertencia (no un `IHealthCheck` registrado en el pipeline, para no acoplar esto a infraestructura de monitoreo todavía indefinida) al iniciar la app: si `File.Exists(SofficePath)` es `false` y `SofficePath` no es solo `"soffice"` (ruta relativa al PATH, no verificable con `File.Exists`), se loguea `LogWarning` con la ruta configurada. No impide el arranque.

### D9 — Orden de operaciones en la firma
`FirmarPublicarDocumentoHandler.HandleAsync`: validar estado/aprobador/PIN (igual que hoy) → **si `ArchivoOriginalUrl is null` (o el archivo no existe físicamente en disco — `ResolveDiskPath` devuelve `null` en ambos casos), lanzar `BusinessRuleException("El documento no tiene archivo original; súbelo antes de enviarlo a aprobación", "SIN_ARCHIVO_ORIGINAL")` y salir** → **(implementado: se mantiene aquí, sin mover, el chequeo RN-DOC-005 de versión previa/QE vinculado activo que ya existía — rechaza con `409` antes de intentar convertir, para no gastar trabajo de conversión en una operación que de todos modos se va a rechazar)** → leer el original desde disco (`DocumentoStorageService.ResolveDiskPath` + `File.OpenRead`) → `ConvertirAsync` → sellar (D10) → hash (D11) → recién ahí construir las entradas de audit trail, obsoletizar la versión previa, cambiar el estado y `GuardarDistribucionAsync` → `SaveChangesAsync`. Todo lo que puede fallar (conversión, sellado) ocurre antes de tocar el `DbContext` — las mutaciones en memoria de la versión previa (si pasó el chequeo RN-DOC-005) son seguras incluso si la conversión falla después, porque EF Core nunca las persiste sin un `SaveChangesAsync` exitoso.

### D10 — Sellado del PDF convertido
Se abre el PDF resultante de LibreOffice con `PdfReader.Open(stream, PdfDocumentOpenMode.Modify)` (PdfSharpCore) y se recorre `doc.Pages`, agregando con `XGraphics.FromPdfPage(page, XGraphicsPdfPageOptions.Append)` un pie de página discreto: `"{Codigo} · {Version} · PUBLICADO · {FechaEmision:dd/MM/yyyy} · Firmado por {aprobadorNombre} · Página {i} de {N}"`. Sin marca de agua de copia aquí — ese texto es exclusivo de `GenerarControlado` (RN-DOC-018 ya distingue ambos PDFs). Si `PdfReader.Open` no puede abrir el PDF de LibreOffice (incompatibilidad de versión de PdfSharpCore con el PDF producido), se documenta como riesgo abierto (ver Risks) — la mitigación por defecto es degradar a guardar el PDF convertido sin sello y loguear un error, nunca bloquear la publicación por un fallo de sellado cuando la conversión en sí fue exitosa.

**Implementado:** `FirmarPublicarDocumentoHandler` envuelve la llamada a `SellarPublicado` en un `try/catch(Exception)` — si falla, registra un `LogError` con el `DocumentoId` y continúa publicando el PDF convertido **sin sellar** (`pdfBytes = pdfConvertido`) en vez de bloquear la firma. El hash SHA-256 (D11) se calcula sobre lo que efectivamente se guarda, sellado o no.

**Verificado (2026-10-06, actualización posterior):** LibreOffice quedó instalado en la máquina de desarrollo (`C:\Program Files\LibreOffice\program\soffice.exe`, detectado automáticamente por el fallback de ruta default de Windows en `LibreOfficePdfConverterTests`). Los 3 tests que antes se omitían (conversión real de `.docx`, de `.xlsx`, y concurrencia de dos conversiones simultáneas) corrieron de punta a punta contra el binario real y pasaron — **`PdfReader.Open(..., PdfDocumentOpenMode.Modify)` sí puede abrir el PDF real que produce esta instalación de LibreOffice**, sin necesitar el camino de degradación. Pregunta abierta #4 (más abajo) queda resuelta por este resultado; el camino de degradación (guardar sin sello + log) queda como salvaguarda para versiones de LibreOffice no probadas, no como comportamiento esperado.

### D11 — Hash en el audit trail
Verificado: `Documento.cs` (dominio real) no tiene un campo `HashArchivo` — ese campo existe solo en el tipo TypeScript de referencia de CLAUDE.md, no en el backend real. El SHA-256 del PDF final ya sellado se calcula una sola vez y se registra únicamente como `ValorNuevo` en la entrada `FIRMA_REGISTRADA` del audit trail, reutilizando el mismo patrón que `DESCARGA` en `ExportarPdfControladoHandler` (`ValorNuevo = hash`). No se introduce un campo nuevo en el dominio ni en `AuditTrailEntry`.

### D12 — PDF controlado parte del PDF de distribución
`ExportarPdfControladoHandler` deja de llamar a `DocumentoPdfGenerator.GenerarControlado(documento, actorNombre)` como generador desde cero. En su lugar: lee el PDF de distribución guardado (`DocumentoStorageService.ResolveDiskPath(documento.ArchivoDistribucionUrl)`), lo abre con `PdfReader.Open(..., Modify)`, agrega en cada página la marca de agua existente (nombre del usuario, timestamp Lima, leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión") y recalcula el hash sobre el resultado. `GenerarControlado` se reescribe para aceptar bytes de entrada en vez de reconstruir desde `Documento`.

### D13 — Documentos `PUBLICADO` anteriores con PDF dummy
Siguen funcionando: `ArchivoDistribucionUrl` ya apunta a un PDF válido (aunque sea de una sola página de metadatos), y `GenerarControlado` seguirá pudiendo sellarlo igual que a uno real. No se ejecuta ninguna migración ni regeneración masiva — si Toño quiere contenido real para esos documentos, la vía es republicarlos (nueva versión) o una regeneración manual puntual, fuera de alcance de este change.

## Risks / Trade-offs

- [LibreOffice no está instalado/configurado en el entorno donde corre el backend] → la firma falla con `422` claro en vez de un 500; el log de arranque (D8) avisa temprano. Mitigación operativa (fuera de este change): Toño instala LibreOffice antes de la prueba manual.
- [Dos firmas simultáneas sobre documentos distintos saturan `MaxConcurrentConversions`] → las conversiones adicionales esperan en el semáforo en vez de fallar; el timeout se mide por conversión individual, así que una cola larga puede acumular latencia pero no genera fallos espurios.
- [`PdfReader.Open(..., Modify)` no puede abrir el PDF producido por la versión de LibreOffice instalada] → riesgo de incompatibilidad entre PdfSharpCore y el PDF de salida de LibreOffice; mitigación descrita en D10 (degradar a guardar sin sello + log, confirmar con prueba manual antes de decidir si eso es aceptable a largo plazo).
- [Proceso `soffice` cuelga más allá del timeout por un archivo corrupto] → `Process.Kill(entireProcessTree: true)` lo termina; el directorio temporal se limpia en `finally` incluso en ese camino.
- [Documentos `PUBLICADO` antiguos con PDF dummy coexisten indefinidamente con los nuevos de contenido real] → aceptado explícitamente (D13); no es una migración pendiente de este change, solo una divergencia documentada.

## Open Questions

1. **Endpoint para subir un PDF de distribución directamente.** `FileUploadField` ya tiene la variante `distribucion` en el frontend, pero `ArchivoDistribucionEndpoint` actual es solo de lectura (`GET`). No existe ningún `POST`/`PUT` para que alguien suba un PDF de distribución ya hecho cuando el documento no tiene archivo original. No se implementa en este change — requiere decisión de Toño sobre si ese flujo manual debe existir y quién puede usarlo.
2. **Validar archivo original obligatorio en `BORRADOR → EN_REVISION`.** Hoy `CambiarEstadoDocumentoHandler` no exige `ArchivoOriginalUrl` en ninguna transición previa a la firma — el problema de "sin archivo original" recién aparece al firmar. Agregar esa validación antes evitaría que un documento llegue hasta `EN_APROBACION` sin poder nunca publicarse, pero es una regla de negocio nueva (no estaba en el PRD ni en RN-DOC-013 a RN-DOC-018) y no se implementa sin confirmación explícita de Toño.
3. **Divergencia de texto legal.** El código usa "COPIA NO CONTROLADA — Solo válido al momento de impresión"; el PRD (DOC-AC-005) dice "COPIA CONTROLADA". Este change mantiene el texto actual del código sin resolverlo — requiere que Toño confirme cuál es el texto correcto.
4. ~~**Compatibilidad real de PdfSharpCore con el PDF de LibreOffice.**~~ **RESUELTA (2026-10-06):** una vez instalado LibreOffice en la máquina de desarrollo, `LibreOfficePdfConverterTests` corrió de punta a punta y confirmó que `PdfReader.Open(..., PdfDocumentOpenMode.Modify)` abre sin problemas el PDF real que produce esta instalación — ver D10. El camino de degradación queda como salvaguarda, no como comportamiento esperado.

## Prueba manual (Toño) — pendiente, no ejecutable en el sandbox de implementación

Nada de lo siguiente se pudo correr en esta sesión porque el sandbox no tiene LibreOffice instalado. Pasos, en orden:

1. **Instalar LibreOffice** (gratis, libreoffice.org) en la máquina donde corre el backend en modo desarrollo.
2. **Configurar `PdfConversion:SofficePath`** en `appsettings.Development.json` (gitignored, no tocado por este change) — en Windows suele ser `C:\Program Files\LibreOffice\program\soffice.exe` (ver el valor de ejemplo ya agregado a `appsettings.Development.json.example`).
3. Opcional — para que `ShcMvpEndPoint.Tests` corra también `LibreOfficePdfConverterTests` (tasks.md 6.6/6.7) en vez de omitirlos: definir la variable de entorno `SHAC_TEST_SOFFICE_PATH` con la misma ruta antes de `dotnet test`, o confiar en que el helper de esos tests ya prueba la ruta por defecto de Windows y el PATH del sistema.
4. **Detener el backend si está corriendo** y ejecutar `dotnet build` antes de probar (para levantar la versión nueva).
5. Con **MSW apagado** (`VITE_ENABLE_MSW=false` o sirviendo contra el backend real):
   - Crear un documento con un `.docx` real de varias páginas, recorrerlo hasta `EN_APROBACION` y firmar. Verificar que el PDF de distribución (`GET /:id/archivo-distribucion`) tiene el contenido real del `.docx`, el sello de publicación visible en cada página, y que el audit trail `FIRMA_REGISTRADA` tiene un hash en `ValorNuevo`.
   - Repetir con un `.xlsx` real.
   - Exportar el PDF controlado (`POST /:id/exportar-pdf`) y verificar que tiene el contenido real y la marca de agua (nombre del usuario, timestamp Lima, leyenda) en cada página.
   - Configurar una ruta inválida de `soffice` y volver a intentar firmar un documento distinto: debe quedar en `EN_APROBACION` con un error de negocio claro (`PDF_CONVERSION_FAILED`, `422`), nunca un `500`.
6. **Si el paso 5 (contenido real + sello) falla específicamente en el sellado** (el PDF de distribución tiene el contenido real pero sin el pie de página), revisar el log del backend: debería haber un `LogError` de "No se pudo sellar el PDF de distribución..." — eso confirma la pregunta abierta #4 y activa la decisión pendiente ahí (aceptar la degradación o bloquear la firma).
7. Avisar con "listo" — Cowork verifica releyendo el código real, no solo este documento.
