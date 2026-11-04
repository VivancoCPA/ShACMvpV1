## Why

Un operario puede hoy descargar el PDF maestro (sin marca de agua) de un documento `PUBLICADO` vía `GET /:id/archivo-distribucion`, y esa descarga no queda registrada en el audit trail — confirmado leyendo el handler real (`ArchivoDistribucionHandler`), que no escribe ninguna entrada. Además, `ExportarPdfControladoHandler` (la única ruta que sí sella y audita) valida solo tenant + `estado === PUBLICADO`, sin `confidencialidad` ni `CanRead` — cualquiera con el id del documento puede generar una copia controlada de un documento `CONFIDENCIAL`/`RESTRINGIDO` que no debería poder leer. Y el storage de archivos de todo el backend (`DocumentoStorageService`, `PlanoStorageService`, `IncidenteEvidenciaStorageService`) guarda bajo `wwwroot`, servido por `app.UseStaticFiles()` **antes** de `UseAuthentication()` — cualquiera que adivine o conozca la ruta descarga el archivo sin sesión, sin pasar por confidencialidad, permisos, ni audit trail.

## What Changes

- **BREAKING (contrato de descarga de documentos):** el PDF maestro de un documento vigente deja de ser descargable directamente. La única descarga para cualquier lector (incluido OPERARIO) es la **copia controlada**: PDF con marca de agua (usuario + fecha + "COPIA NO CONTROLADA"), sin copia de texto, impresión restringida a `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION`, y siempre registrada en el audit trail (`DESCARGA`, con hash).
  - `GET /:id/archivo-distribucion` deja de servir el maestro para descarga (se elimina o se redirige al mismo flujo que la copia controlada — decisión en design.md).
  - `ExportarPdfControladoHandler` agrega las validaciones que le faltan (confidencialidad → 404, `CanRead` → 403) y amplía los estados permitidos a `PUBLICADO` y `EN_REVISION_PERIODICA` (antes solo `PUBLICADO`); `OBSOLETO` sigue sin descarga, solo visor.
  - El frontend reemplaza el botón de descarga directa del PDF de distribución por "Descargar copia (PDF)", con un texto de ayuda explicando que la copia lleva nombre/fecha y es una COPIA NO CONTROLADA.
- **Almacenamiento privado de archivos (cross-módulo):** todo archivo subido por un usuario (documentos, planos de Locales, evidencias de Incidentes) se mueve fuera de `wwwroot`, a una raíz privada configurable (`FileStorage`). `app.UseStaticFiles()` deja de exponer esos archivos; `GET /uploads/...` responde `404`. Se agrega una migración idempotente que mueve los archivos existentes y actualiza sus claves en la base de datos.
  - Documentos: `DocumentoStorageService` ya resolvía el archivo solo a través de endpoints autenticados (`archivo-original`, `visor`, `exportar-pdf`) — el cambio es solo de ubicación/clave, sin nuevo endpoint.
  - Locales: nuevo endpoint autenticado `GET /api/locales/{id}/plano`; el frontend (`IncidentMapCanvas`, mapa de incidentes) deja de usar `<img src="/uploads/...">` y carga el plano como blob autenticado.
  - Incidentes: nuevo endpoint autenticado `GET /api/incidents/{id}/evidencias/{evidenciaId}/archivo`; el frontend (`IncidentDetailPage`) deja de usar `<img src={ev.url}>`/`<a href={ev.url}>` directo y carga evidencias como blob autenticado. (`informeMedicoAdjunto` no existe en el backend real — confirmado durante el diseño, ver design.md D8 — no se toca.)
- **Circuito de URL firmada (`GET /:id/archivo` + `/stream/{token}`) se retira**: confirmado que su único consumidor en producción (`useGetArchivoUrl`/botón "Ver archivo") nunca se renderiza (depende de `documento.archivoUrl`, que el backend real nunca envía) — es código muerto. Se elimina el endpoint, el handler, `DocumentoSignedUrlService`, y el botón/hook del frontend; RN-DOC-009 (nunca exponer una URL de archivo directa) queda cumplida porque toda descarga pasa por una petición autenticada con JWT, sin URL intermedia.
- **Restricciones reales del PDF (RN-DOC-010):** la copia controlada aplica `SecuritySettings` de PdfSharpCore — sin copia de texto para nadie, sin impresión salvo `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION`. Documentado como medida disuasoria (un lector de PDF puede ignorarla), no como protección absoluta.

## Capabilities

### New Capabilities
- `private-file-storage`: raíz de almacenamiento privada fuera de `wwwroot`, cierre de `UseStaticFiles()` para archivos de usuario, migración idempotente de archivos existentes (Documentos, Locales, Incidentes), y los nuevos endpoints autenticados `GET /api/locales/{id}/plano` y `GET /api/incidents/{id}/evidencias/{evidenciaId}/archivo`.
- `document-copia-controlada`: la copia controlada (`exportar-pdf-controlado`) como única vía de descarga de un documento vigente — validaciones de confidencialidad/`CanRead`, estados permitidos, restricciones de copia/impresión del PDF, y el retiro de la descarga directa del maestro (`archivo-distribucion`) y del circuito de URL firmada (`archivo`/`stream`).

### Modified Capabilities
- `document-detail`: se retira el botón de descarga directa del PDF de distribución; se agrega "Descargar copia (PDF)" como acción secundaria junto a "Ver documento", con texto de ayuda sobre la marca de agua. `OBSOLETO` no muestra ninguna acción de descarga (solo "Ver documento").
- `incident-map-view`: `IncidentMapCanvas` deja de recibir `planoPngUrl` como una URL estática directa para el atributo `src`; el plano se obtiene vía una petición autenticada y se renderiza desde un object URL.
- `incident-detail`: la galería de evidencias deja de apuntar a una URL estática directa; se carga vía petición autenticada (blob).

## Impact

- **Backend** (`ShcMvpEndPoint`): `DocumentoStorageService`, `PlanoStorageService`, `IncidenteEvidenciaStorageService`, `Program.cs` (`UseStaticFiles`), `ArchivoDistribucionHandler`/`Endpoint`, `ExportarPdfControladoHandler`, `DocumentoPdfGenerator` (SecuritySettings), nuevos endpoints de Locales/Incidentes, retiro de `ObtenerArchivoHandler`/`StreamArchivoHandler`/`DocumentoSignedUrlService`, nueva sección de configuración `FileStorage`, migración de archivos.
- **Frontend** (`shc-controldoc`): `DocumentActionPanel.tsx`/`DocumentDetailPage.tsx` (botones de descarga), `documents.api.ts`/`useDocumentActions.ts` (retiro de `useGetArchivoUrl`, nuevo flujo de copia controlada ampliado), `IncidentMapCanvas.tsx`/`IncidentMapView.tsx`, `IncidentDetailPage.tsx`, `features/locations/api/locales.api.ts`.
- **MSW**: handlers de `documents`, `locales`, `incidents` deben reflejar los endpoints nuevos/retirados.
- **Tests**: backend (.NET) e2e de los endpoints nuevos y retirados; frontend (vitest) de los componentes afectados.
