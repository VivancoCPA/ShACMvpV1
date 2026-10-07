## Context

Confirmado leyendo el código real (2026-10-06):

- `Program.cs:51-56` — la política CORS `ShacFrontend` tiene `AllowAnyHeader()` (headers de **request**) pero ningún `.WithExposedHeaders(...)` (headers de **response** visibles a JS). Sin eso, `fetch`/Axios en `http://localhost:5173` no puede leer `Content-Disposition` de una respuesta de `http://localhost:5072`.
- `ArchivoOriginalEndpoint.cs:32` — `Results.File(archivo.RutaFisica, "application/octet-stream", archivo.NombreArchivo)`: el tercer argumento (`fileDownloadName`) SÍ hace que ASP.NET Core emita `Content-Disposition: attachment; filename=...` correctamente (con `filename*` RFC 5987 si hay caracteres no-ASCII) — el problema no es el backend generando el header, es (a) CORS ocultándolo y (b) el `Content-Type` fijo en `application/octet-stream` en vez del real.
- `ArchivoDistribucionEndpoint.cs:23` y `ExportarPdfControladoEndpoint.cs:21` ya usan `application/pdf` — correcto, nada que cambiar en content-type ahí. `ExportarPdfControladoEndpoint` ya pasa `fileDownloadName`; `ArchivoDistribucionEndpoint` no pasa ninguno (sin `Content-Disposition` en absoluto hoy) — fuera del alcance reportado por Toño, pero se documenta como hallazgo secundario (ver Non-Goals).
- `documents.api.ts` líneas 139-141, 158-160, 167-169 — tres copias de `/filename="([^"]+)"/.exec(disposition)`, exigiendo comillas, sin soporte para `filename*=UTF-8''...`.
- `documento.archivoOriginalNombre` ya viene poblado en el detalle (`Documento` entity, columna persistida) — ver `ObtenerDocumentoHandler` / `Documento.cs`. Es el fallback natural cuando el header no llega.
- No existe hoy ningún otro punto en `src/` que parsee `content-disposition` fuera de `documents.api.ts` (QE, NC, Incidentes no descargan archivos binarios con este patrón) — confirmado por búsqueda global. No hay migración adicional pendiente en otros dominios.

## Goals / Non-Goals

**Goals:**
- El navegador recibe y puede leer `Content-Disposition` en las 3 descargas de Documentos (original, distribución, controlado) en dev (orígenes distintos).
- El nombre de archivo mostrado al usuario siempre tiene extensión y es fiel al archivo real subido, incluso con tildes/ñ/espacios.
- `Content-Type` del archivo original refleja la extensión real (Word/Excel), no `application/octet-stream` genérico.
- Una sola implementación del parseo de `Content-Disposition`, reusada por las 3 funciones de descarga.

**Non-Goals:**
- No se toca `ArchivoDistribucionEndpoint` para agregarle `fileDownloadName` (hoy no envía `Content-Disposition` en absoluto): el fallback del frontend para esa descarga (`documento-${id}-distribucion.pdf`) ya incluye extensión y no es el bug reportado. Se deja como mejora futura, no como parte de este fix — evita ampliar el alcance más allá del reporte de Toño.
- No se migra el patrón de descarga Blob (`document-pdf-security` / `downloadBlob.ts`) ni se introduce uno nuevo — las descargas ya usan Blob + `<a download>`; este fix solo corrige cómo se calcula el nombre, no el mecanismo de descarga.
- No se tocan descargas de QE/NC/Incidentes — no existen hoy con este patrón (confirmado).

## Decisions

**D1 — CORS: exponer el header en la política global, no por endpoint.**
`WithExposedHeaders("Content-Disposition")` se agrega a la única política `ShacFrontend` en `Program.cs`. Alternativa descartada: un `[EnableCors]` por endpoint con una política distinta — innecesario, ya hay una sola política para toda la API y las 3 descargas la usan.

**D2 — Content-Type del archivo original: `FileExtensionContentTypeProvider`, no un mapa manual.**
ASP.NET Core ya trae `Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider` con el mapeo `.docx`/`.xlsx`/etc. correcto (incluye los MIME types OOXML completos). Se usa `TryGetContentType(nombreArchivo, out var contentType)`, con fallback a `application/octet-stream` si la extensión no se reconoce. Alternativa descartada: diccionario manual — duplicaría una tabla que el framework ya mantiene, y el documento de Toño solo sugiere `FileExtensionContentTypeProvider` o un mapa como alternativas, prefiriendo la primera por menos código propio.

**D3 — Resolución del nombre en el frontend: un helper puro, no un método en cada función de descarga.**
`getFileNameFromContentDisposition(header: string | undefined, fallback: string): string` en `src/utils/contentDisposition.ts`, sin dependencias de Axios ni de React — testeable de forma aislada. Prioridad: `filename*=UTF-8''...` (decodificado con `decodeURIComponent`) → `filename=` (con o sin comillas) → `fallback`. Esto coincide con la prioridad que exige RFC 6266 (si ambos están presentes, los user-agents modernos prefieren `filename*`).

**D4 — Fallback del archivo original: pasar `documento.archivoOriginalNombre` explícitamente, no leerlo dentro de `documents.api.ts`.**
`getArchivoOriginalUrl` no tiene acceso al `Documento` completo (solo recibe `id`), y no debe hacer un segundo `GET` solo para obtener el nombre. Se cambia la firma a `getArchivoOriginalUrl(id: string, fallbackNombre?: string)`, y el caller (`useGetArchivoOriginalUrl` / `DocumentDetailPage`, que ya tiene `documento` cargado en memoria) pasa `documento.archivoOriginalNombre`. Si tampoco hay `fallbackNombre` (caso extremo: ni header ni dato persistido), el fallback final sigue siendo un nombre genérico pero DEBE incluir una extensión — se usa `.bin` como última red de seguridad, nunca un nombre pelado.
Para `getArchivoDistribucionBlob` y `exportarPdfControlado` el fallback genérico ya incluye `.pdf` (es siempre PDF) — no necesitan un parámetro adicional.

**D5 — Alcance de la migración de regex: solo `documents.api.ts`.**
Confirmado que ningún otro módulo (QE, NC, Incidentes, exportaciones de dashboard) parsea `content-disposition` hoy. No se crea abstracción adicional ni se tocan otros archivos — evita over-engineering para un caso que no existe todavía.

## Risks / Trade-offs

- [Riesgo] Cambiar la firma de `getArchivoOriginalUrl` a aceptar un segundo parámetro opcional rompe silenciosamente si algún caller no lo pasa (queda sin fallback de nombre real). → Mitigación: el parámetro es opcional con fallback interno seguro (nunca sin extensión); se audita con Grep todos los call-sites antes de mergear (ya identificado: solo `useGetArchivoOriginalUrl`/`DocumentDetailPage.tsx`).
- [Riesgo] `FileExtensionContentTypeProvider` no reconoce una extensión no estándar que alguien suba igual (el backend no valida extensión en el upload). → Mitigación: fallback explícito a `application/octet-stream` — mismo comportamiento que hoy, nunca peor.
- [Riesgo] CORS mal configurado en producción (`Cors:AllowedOrigins` no incluye el dominio real) seguiría ocultando el header aunque el código esté bien. → Fuera de alcance de este fix (config de despliegue, no de código); se deja como nota en tasks.md para QA de despliegue.

## Migration Plan

No aplica migración de datos. Cambio de código + config (CORS) sin breaking changes de contrato HTTP (los endpoints no cambian de forma/URL, solo headers de respuesta). Rollback: revertir el commit; ningún dato persistido se ve afectado.
