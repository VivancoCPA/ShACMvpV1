## 1. Backend — CORS y Content-Type

- [x] 1.1 En `ShcMvpEndPoint/Program.cs`, agregar `.WithExposedHeaders("Content-Disposition")` a la política CORS `ShacFrontend` (junto a `.WithOrigins(...).AllowAnyMethod().AllowAnyHeader().AllowCredentials()`).
- [x] 1.2 En `ArchivoOriginalEndpoint.HandleGet` (`Features/Documentos/ArchivoOriginal/ArchivoOriginalEndpoint.cs`), resolver el `Content-Type` real de `archivo.NombreArchivo` con `FileExtensionContentTypeProvider.TryGetContentType(...)`, con fallback a `application/octet-stream` si no se reconoce la extensión. Reemplazar el `"application/octet-stream"` fijo del `Results.File(...)`.
- [x] 1.3 Revisar si `ArchivoDistribucionEndpoint` y `ExportarPdfControladoEndpoint` necesitan algún ajuste de Content-Type (ya usan `application/pdf` fijo, correcto) — no se esperan cambios, solo confirmar.

## 2. Backend — Tests de integración

- [x] 2.1 Test: `GET /:id/archivo-original` de un documento cuyo `ArchivoOriginalNombre` termina en `.docx` responde con `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- [x] 2.2 Test: mismo caso con `.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- [x] 2.3 Test: `ArchivoOriginalNombre` con tildes/espacios (p.ej. `Procedimiento de Inspección.docx`) → la respuesta incluye `Content-Disposition` con `filename*=UTF-8''...` codificado correctamente.
- [x] 2.4 Test de CORS: petición con header `Origin: http://localhost:5173` a `GET /:id/archivo-original` recibe `Access-Control-Expose-Headers` incluyendo `Content-Disposition`.

## 3. Frontend — helper compartido

- [x] 3.1 Crear `shc-controldoc/src/utils/contentDisposition.ts` con `getFileNameFromContentDisposition(header, fallback)`: prioriza `filename*=UTF-8''...` (decodificado con `decodeURIComponent`), luego `filename=` con o sin comillas, y cae a `fallback` solo si no encuentra ninguno.
- [x] 3.2 Tests unitarios (`contentDisposition.test.ts`): con comillas, sin comillas, solo `filename*` con tildes/espacios, ambos presentes (gana `filename*`), header vacío/`undefined` (usa fallback).

## 4. Frontend — documents.api.ts

- [x] 4.1 Reemplazar la regex de `getArchivoOriginalUrl` por el helper; cambiar la firma a `getArchivoOriginalUrl(id: string, fallbackNombre?: string)`, usando `fallbackNombre` cuando el header no trae nombre, y un fallback final con extensión (`.bin`) si tampoco hay `fallbackNombre`.
- [x] 4.2 Reemplazar la regex de `getArchivoDistribucionBlob` por el helper, conservando el fallback `documento-${id}-distribucion.pdf`.
- [x] 4.3 Reemplazar la regex de `exportarPdfControlado` por el helper, conservando el fallback `documento-${id}-controlado.pdf`.

## 5. Frontend — call sites

- [x] 5.1 Actualizar `useGetArchivoOriginalUrl` (`features/documents/hooks/useDocumentActions.ts`) para aceptar y pasar el `documento.archivoOriginalNombre` disponible en el caller.
- [x] 5.2 Actualizar `DocumentDetailPage.tsx` para pasar `documento.archivoOriginalNombre` a `abrirArchivoOriginal`.
- [x] 5.3 Buscar otros call-sites de `getArchivoOriginalUrl` que pudieran quedar sin el nuevo parámetro y confirmar que su fallback sigue siendo seguro (con extensión). Confirmado: único call-site (`DocumentDetailPage.tsx`), ya actualizado; sin tests que dependieran de la firma anterior.

## 6. Verificación

- [x] 6.1 Correr la suite completa del frontend (`npm test` / vitest) en `shc-controldoc`. 183 archivos / 1463 tests OK (1 expected fail preexistente, no relacionado).
- [x] 6.2 Correr los tests del backend (`dotnet test`) en `ShcMvpEndPoint`. 534/534 OK.
- [x] 6.3 Correr `tsc` (type-check) en `shc-controldoc`. Sin errores.
- [x] 6.4 Detener el backend en ejecución y correr `dotnet build` antes de la prueba manual. Hecho (se detuvo el proceso que bloqueaba el build, con tu confirmación).
- [ ] 6.5 Prueba manual con MSW apagado (`VITE_ENABLE_MSW=false`), en dos sesiones/navegadores: como autor, crear un documento subiendo un `.docx` con nombre con tilde y espacios (p.ej. `Procedimiento de Inspección.docx`); como revisor, descargarlo y confirmar que el nombre, extensión y contenido son correctos al abrir en Word.
- [ ] 6.6 Repetir la prueba manual con un `.xlsx`.
- [ ] 6.7 Descargar el PDF de distribución de un documento publicado y confirmar su nombre.

## 7. Cierre

- [ ] 7.1 Avisar "listo" para verificación de causa raíz releyendo el código real.
