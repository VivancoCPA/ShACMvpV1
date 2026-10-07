# Instrucciones para Claude Code: las descargas de archivos llegan sin nombre ni extensión

Fecha: 2026-10-06
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño. Cuando el revisor o el aprobador pulsan "Descargar archivo original", no reciben el documento que se cargó al crearlo.
Change sugerido: `fix-descarga-archivos-nombre`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

**El backend sirve el archivo correcto.** `ObtenerArchivoOriginalHandler` resuelve `documento.ArchivoOriginalUrl`, la ruta física del último original subido, y responde con `Results.File(ruta, "application/octet-stream", documento.ArchivoOriginalNombre)`. La subida en la creación (`useDocumentForm.onSubmit` → `POST /:id/archivo-original` → `ReemplazarArchivoOriginalHandler` → `GuardarOriginalAsync`) también es correcta.

**El problema está en cómo el frontend nombra el archivo descargado.** En `api/endpoints/documents.api.ts`, `getArchivoOriginalUrl` (línea ~155) y también `getArchivoDistribucionBlob` y la función de la línea ~139 hacen esto:

```ts
const disposition = response.headers['content-disposition'] ?? ''
const match = /filename="([^"]+)"/.exec(disposition)
const fileName = match?.[1] ?? `documento-${id}-original`
```

Ese código falla por dos motivos, y cualquiera de los dos alcanza para que el archivo se descargue como `documento-<guid>-original`, **sin extensión**. Windows no sabe abrirlo, y al usuario le parece que "no es el archivo que subió".

1. **CORS no expone `Content-Disposition`.** El frontend (`localhost:5173`) y el backend (`localhost:5072`) son orígenes distintos. La política `ShacFrontend` de `Program.cs` no tiene `.WithExposedHeaders(...)`, así que el navegador oculta esa cabecera a JavaScript. `response.headers['content-disposition']` siempre llega vacío y siempre se usa el nombre de respaldo. Con MSW no se nota porque todo corre en el mismo origen: es el mismo patrón de bug de toda la serie.
2. **La regex exige el nombre entre comillas.** ASP.NET Core genera `attachment; filename=PRC-CD-013.docx; filename*=UTF-8''PRC-CD-013.docx`, sin comillas cuando el nombre no tiene espacios. Y si el nombre lleva tildes o ñ (muy común en español), el valor útil está **solo** en `filename*` (RFC 5987), codificado.

Detalle secundario: el `Content-Type` es siempre `application/octet-stream`, aunque se conoce la extensión.

---

## Qué implementar

### Backend
1. En `Program.cs`, agrega `.WithExposedHeaders("Content-Disposition")` a la política CORS `ShacFrontend`. Revisa si alguna otra respuesta de archivo necesita exponer otras cabeceras.
2. En `ObtenerArchivoOriginalHandler` / `ArchivoOriginalEndpoint`, usa el `Content-Type` real según la extensión. Puedes usar `FileExtensionContentTypeProvider` o un mapa explícito (`.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Si la extensión no se reconoce, usa `application/octet-stream`. Haz lo mismo en las demás descargas de archivos de Documentos: PDF de distribución y PDF controlado.
3. Test de integración: la descarga del original devuelve el nombre original en `Content-Disposition` (incluido un nombre con tildes, que aparece en `filename*`) y el `Content-Type` correcto. Agrega un test de CORS que verifique `Access-Control-Expose-Headers: Content-Disposition` en una petición con `Origin: http://localhost:5173`.

### Frontend
1. Crea **un solo** helper compartido, por ejemplo `utils/contentDisposition.ts` con `getFileNameFromContentDisposition(header, fallback)`, que:
   - prefiera `filename*=UTF-8''...` y lo decodifique con `decodeURIComponent`;
   - si no hay `filename*`, acepte `filename=` con o sin comillas;
   - devuelva el `fallback` solo si no encuentra ninguno de los dos.
2. Reemplaza las tres copias de la regex en `documents.api.ts` por el helper. Busca en todo `src/` otras descargas que parseen `content-disposition` (QE, NC, Incidentes, exportaciones) y migra también esas.
3. **Fallback con extensión:** para el original, si la cabecera no llega, usa `documento.archivoOriginalNombre`, que ya viene en el detalle. Si eso tampoco existe, usa un nombre que incluya la extensión deducida del `Content-Type` del blob. Nunca descargues un archivo sin extensión.
4. Tests del helper con estos casos: con comillas, sin comillas, solo `filename*` con tildes y espacios, ambos presentes (gana `filename*`) y cabecera vacía (usa el fallback).

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado, en dos navegadores o sesiones:
  1. Como autor, crea un documento subiendo un `.docx` con un nombre con tilde y espacios (por ejemplo `Procedimiento de Inspección.docx`).
  2. Como revisor, descárgalo: el archivo debe bajar con su nombre original, con extensión, y abrirse en Word con el contenido correcto.
  3. Repite con un `.xlsx`.
  4. Descarga el PDF de distribución de un documento publicado y confirma su nombre.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
