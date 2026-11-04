## Why

Al descargar el archivo original (o el PDF de distribución/controlado) de un documento, el navegador recibe el archivo sin nombre ni extensión (`documento-<guid>-original`), porque (1) la política CORS del backend no expone `Content-Disposition` al JavaScript del frontend (origen distinto en dev: `5173` vs `5072`) y (2) la regex del frontend que extrae el nombre del header solo acepta `filename="..."` entre comillas, mientras ASP.NET Core a veces lo emite sin comillas o únicamente como `filename*=UTF-8''...` (RFC 5987) cuando el nombre tiene tildes/ñ. El resultado: Windows no sabe abrir el archivo descargado y el usuario cree que recibió el archivo equivocado.

## What Changes

- Backend: exponer `Content-Disposition` en la política CORS (`WithExposedHeaders`) para que el navegador permita leerlo desde JavaScript cross-origin.
- Backend: `GET /api/documents/:id/archivo-original` responde con el `Content-Type` real según la extensión del archivo (no siempre `application/octet-stream`).
- Frontend: nuevo helper compartido `getFileNameFromContentDisposition` que soporta `filename*=UTF-8''...` (decodificado) con prioridad sobre `filename=` con o sin comillas, y cae a un fallback solo si no encuentra ninguno.
- Frontend: las tres funciones de descarga en `documents.api.ts` (`getArchivoOriginalUrl`, `getArchivoDistribucionBlob`, `exportarPdfControlado`) usan el helper compartido en vez de su propia regex duplicada; el fallback del archivo original usa `documento.archivoOriginalNombre` cuando el header no llega, y nunca un nombre sin extensión.

## Capabilities

### New Capabilities
- `shared-content-disposition`: helper puro `getFileNameFromContentDisposition(header, fallback)` en `src/utils/contentDisposition.ts`, con sus tests (con comillas, sin comillas, solo `filename*` con tildes/espacios, ambos presentes, header vacío).

### Modified Capabilities
- `be-documentos-api`: la política CORS expone `Content-Disposition`; `GET /:id/archivo-original` usa el `Content-Type` real según extensión en vez de `application/octet-stream` fijo.
- `document-api-client`: `getArchivoOriginalUrl`, `getArchivoDistribucionBlob` y `exportarPdfControlado` usan el helper compartido de `shared-content-disposition` para resolver el nombre de archivo, con fallback a `documento.archivoOriginalNombre` (original) o un nombre con extensión conocida — nunca sin extensión.

## Impact

- `ShcMvpEndPoint/Program.cs` (política CORS `ShacFrontend`).
- `ShcMvpEndPoint/Features/Documentos/ArchivoOriginal/ArchivoOriginalEndpoint.cs` (Content-Type por extensión).
- `shc-controldoc/src/utils/contentDisposition.ts` (nuevo).
- `shc-controldoc/src/api/endpoints/documents.api.ts` (las 3 funciones de descarga).
- `shc-controldoc/src/features/documents/hooks/useDocumentActions.ts` / `DocumentDetailPage.tsx` si se requiere pasar `documento.archivoOriginalNombre` como fallback.
- Tests de integración backend (CORS expuesto + Content-Type/Content-Disposition con nombre con tildes) y tests unitarios del helper frontend.
