# Instrucciones para Claude Code — PDF de distribución real (convertir el Word/Excel original al publicar)

Fecha: 2026-10-06
Autor: Cowork (investigación sobre el código real)
Origen: Toño. Al firmar y publicar un documento, el PDF que se genera es un "dummy": no contiene el documento.
Change sugerido: `pdf-distribucion-real`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

- `Features/Documentos/Shared/DocumentoPdfGenerator.cs`:
  - `GenerarDistribucion(documento)` arma con PdfSharpCore **una sola página** que solo contiene código y título, versión, tipo, fecha de emisión y la leyenda "Documento controlado — SHAC". **Nunca lee el archivo original.** El comentario del propio archivo lo reconoce: "Contenido simple (texto sobre una página), sin maquetación compleja".
  - `GenerarControlado(documento, usuario)`, el PDF que se exporta bajo demanda (RN-DOC-007), tiene el mismo problema: es otra página de metadatos con la marca de agua. No incluye el contenido del documento.
- `FirmarPublicarDocumentoHandler` llama a `GenerarDistribucion` y guarda el resultado con `DocumentoStorageService.GuardarDistribucionAsync` como `{version}.pdf`.
- El archivo original admitido es `.docx` o `.xlsx` (`FileUploadField`, variante `original`). El backend no tiene ningún motor de conversión: solo existen las referencias a `PdfSharpCore` y `SixLabors.ImageSharp` en el `.csproj`.
- Según PRD ADD-02, `archivoDistribucionUrl` es el "PDF controlado, generado automáticamente al publicar". Hoy eso no se cumple.

## Decisiones de Toño

- **D1 — ✅ DECIDIDO (2026-10-06): convertir con LibreOffice instalado**, ejecutando `soffice --headless --convert-to pdf` desde el backend. Descartados Gotenberg en Docker, una librería comercial .NET y que el usuario suba el PDF a mano.
- **D2 — ✅ DECIDIDO (2026-10-06): el PDF se genera al firmar y publicar**, igual que ahora. Descartado generarlo al pasar a Aprobación.

**Contexto que no debes resolver:** el hosting de producción sigue sin definirse, y Toño decidió dejarlo para el final. Diseña la conversión para que dependa **solo de configuración** (ruta del ejecutable), sin asumir un sistema operativo ni un contenedor. No propongas ni configures infraestructura de producción.

---

## Qué implementar

### 1. Servicio de conversión (backend)
1. Crea una interfaz, por ejemplo `IDocumentoPdfConverter` con `Task<byte[]> ConvertirAsync(Stream original, string nombreArchivo, CancellationToken ct)`, y su implementación `LibreOfficePdfConverter` en `Features/Documentos/Shared/` o en Infrastructure, donde encaje mejor. Con la interfaz, los tests pueden usar un fake y el motor se puede cambiar más adelante.
2. Configuración en `appsettings` (sección sugerida `PdfConversion`):
   - `SofficePath`: en Windows de desarrollo suele ser `C:\Program Files\LibreOffice\program\soffice.exe`; por defecto, `soffice` en el PATH.
   - `TimeoutSeconds`: por ejemplo 60.
   - `MaxConcurrentConversions`: por ejemplo 2.
   - Documenta en `appsettings.Development.json.example` el valor para Windows.
3. Implementación robusta:
   - Trabaja en un directorio temporal **único por conversión**: escribe ahí el original con su extensión real, ejecuta `soffice --headless --convert-to pdf --outdir <tmp> <archivo>` y lee el PDF generado.
   - Usa un **perfil de usuario de LibreOffice aislado por conversión** (`-env:UserInstallation=file:///<tmp>/lo-profile`). Sin esto, dos conversiones simultáneas o una ventana de LibreOffice abierta en la misma máquina hacen que el proceso falle o se quede colgado.
   - Limita la concurrencia con `SemaphoreSlim`, según `MaxConcurrentConversions`.
   - Aplica el timeout: si se excede, **mata el proceso** y lanza un error claro.
   - Borra el directorio temporal siempre, en un `finally`.
   - Si el ejecutable no existe, el proceso termina con código distinto de 0 o no aparece el PDF, lanza una excepción propia con un mensaje claro.
   - Registra en el log la duración y el tamaño del resultado.
   - **No** pases contenido del usuario como argumentos de shell: usa `ProcessStartInfo` con `ArgumentList`, sin `UseShellExecute`.
4. Agrega un health check o un log al arrancar que avise si `SofficePath` no es ejecutable. Que **no** impida arrancar la app: solo avisa.

### 2. Publicación (`FirmarPublicarDocumentoHandler`)
1. Orden dentro de la firma: validar el estado, el aprobador y el PIN como hoy → **convertir el original** → sellar el PDF (punto 3) → calcular el hash → guardar el archivo → cambiar estados, obsoletizar la versión previa y escribir el audit trail → `SaveChangesAsync`.
2. **Si la conversión falla, no se publica nada.** El documento sigue en EN_APROBACION, la versión previa no cambia y no queda ningún archivo huérfano. Responde con un error de negocio claro, por ejemplo: "No se pudo generar el PDF del documento. Intenta de nuevo o contacta al administrador". Revisa qué status usa `ApiExceptionHandler` para ese tipo de excepción y elige uno coherente: un 500 genérico no es aceptable.
3. **Documento sin archivo original** (RN-DOC-017 lo permite): **bloquea la firma** con el mensaje "El documento no tiene archivo original; súbelo antes de enviarlo a aprobación". **No** generes la portada dummy como sustituto. Además:
   - Verifica si existe algún endpoint para subir un PDF de distribución directamente. `FileUploadField` tiene la variante `distribucion`, pero `ArchivoDistribucionEndpoint` parece ser solo de lectura. Si no existe, anótalo en `design.md` como pregunta abierta para Toño. No lo implementes.
   - Recomendación adicional: valida en `BORRADOR → EN_REVISION` que exista un archivo original, para que el problema no aparezca recién en la firma. Esto es una regla nueva, así que regístrala como **pregunta abierta** en `design.md` y no la implementes sin confirmación.

### 3. Sello del documento publicado
Sobre el PDF convertido, usando PdfSharpCore en modo `Modify` (`PdfReader.Open(..., PdfDocumentOpenMode.Modify)`), agrega en **cada página** un encabezado o pie discreto con: código, versión, "PUBLICADO", fecha de emisión, nombre del aprobador que firmó y "Página X de N". **No** pongas aquí la marca de agua de copia: este archivo es el maestro de distribución. Si PdfSharpCore no puede abrir el PDF que genera LibreOffice, documenta qué falla y la alternativa elegida.

### 4. Hash de firma (RN-DOC-004)
Calcula el SHA-256 del PDF final ya sellado y regístralo en la entrada `FIRMA_REGISTRADA` del audit trail. Hoy esa entrada no guarda ningún hash. Usa `ValorNuevo`, igual que `DESCARGA` guarda el hash del PDF controlado, salvo que exista un campo mejor; anota la elección en `design.md`. El hash corresponde al archivo publicado, así que cualquiera puede verificarlo después.

### 5. PDF controlado bajo demanda (`ExportarPdfControladoHandler` / `GenerarControlado`)
1. Debe partir del **PDF de distribución guardado**, no de una página nueva. Agrega en cada página la marca de agua con el nombre del usuario, la fecha y hora en Lima y la leyenda, y recalcula el hash como hoy.
2. Si un documento PUBLICADO antiguo todavía tiene el PDF dummy (publicado antes de este change), está bien que siga funcionando con ese archivo. Documenta en `design.md` que esos documentos necesitan republicarse o una regeneración manual, y **no** hagas una migración masiva.
3. **Divergencia a anotar, sin resolverla:** el código usa la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión", mientras que el PRD (DOC-AC-005) dice "COPIA CONTROLADA". Regístralo en `design.md` como pregunta para Toño y mantén el texto actual.

### 6. Frontend
1. Revisa que "Ver archivo" / "Descargar PDF" y la vista previa del PDF controlado (`DocumentActionPanel`) muestren el archivo real.
2. Muestra en el modal de firma el error de conversión o de "sin archivo original" (relacionado con `pin-firma-ui`: cualquier error debe verse en el modal).
3. MSW: el mock puede seguir devolviendo un PDF de ejemplo, pero debe simular el error de "sin archivo original" igual que el backend.

---

## Tests
- **Backend, con un `IDocumentoPdfConverter` fake** (sin LibreOffice):
  - la firma usa el converter y guarda el PDF que devuelve, sellado;
  - un fallo del converter deja el documento en EN_APROBACION, la versión previa sin cambios y sin archivo ni entradas de audit;
  - sin archivo original, la firma se bloquea;
  - el hash de `FIRMA_REGISTRADA` coincide con el SHA-256 del archivo guardado;
  - el PDF controlado parte del PDF de distribución y tiene la misma cantidad de páginas.
- **Un test de integración real con LibreOffice** marcado para omitirse si `SofficePath` no está disponible: convierte un `.docx` y un `.xlsx` pequeños de prueba (agrégalos como fixtures del proyecto de tests) y verifica que el resultado es un PDF válido con al menos una página.
- **Concurrencia:** dos conversiones simultáneas no fallan (perfil aislado).

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Requisito de la prueba manual:** instala LibreOffice en tu equipo (gratis, libreoffice.org) y configura `PdfConversion:SofficePath` en `appsettings.Development.json`. Detén el backend y ejecuta `dotnet build` antes de probar.
- Prueba manual con MSW apagado:
  1. Crea un documento con un `.docx` real de varias páginas, recórrelo hasta firmar y verifica que el PDF de distribución tenga el contenido real, el sello en cada página y el hash en el audit trail.
  2. Repite con un `.xlsx`.
  3. Exporta el PDF controlado y verifica que tenga el contenido y la marca de agua.
  4. Configura una ruta inválida de `soffice` e intenta firmar: el documento debe quedar en EN_APROBACION con un error claro.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
