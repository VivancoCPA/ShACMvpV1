## Why

Hoy, para revisar un documento (`.docx`/`.xlsx`) dentro de SHAC el usuario debe descargar el archivo original o el PDF de distribución y abrirlo en una app externa. Eso es especialmente malo para el **aprobador**, que en `EN_APROBACION` firma sin poder ver el contenido real del documento (RN-DOC-013 bloquea el original en ese estado). El usuario necesita revisar el documento **dentro de la app**, sin descargarlo, con las mismas restricciones de confidencialidad, permisos por estado/rol y marcas de agua que ya existen para la descarga.

## What Changes

- Nuevo **visor de documentos** embebido (pdf.js vía `react-pdf`) en el detalle del documento, con navegación de páginas, zoom y ajuste al ancho. Sin botón de descarga para nadie; impresión solo para `JEFE_CONTROL_DOCUMENTARIO` y `ALTA_DIRECCION`; sin capa de texto seleccionable (sin copiar texto).
- Nuevo endpoint backend `GET /api/documents/{id}/visor` que devuelve bytes PDF (`application/pdf`, `Content-Disposition: inline`):
  - `BORRADOR` / `EN_REVISION` / `EN_APROBACION` → **vista previa** generada en el servidor desde el archivo original (LibreOffice, reutilizando `IDocumentoPdfConverter`) con marca de agua "VISTA PREVIA — NO CONTROLADO — {ESTADO}". El aprobador puede verla en `EN_APROBACION` (antes no podía ver nada del contenido); el original sigue bloqueado para descarga (RN-DOC-013 no cambia).
  - `PUBLICADO` / `EN_REVISION_PERIODICA` → el PDF de distribución ya existente, sin regenerar.
  - `OBSOLETO` → el PDF de distribución con la marca "OBSOLETO — No usar" aplicada al servir (RN-DOC-003), sin tocar el archivo publicado original.
- Caché de vistas previas generadas, fuera de `wwwroot`, con invalidación cuando se reemplaza el archivo original.
- Cada apertura del visor registra una entrada `VISUALIZACION` en el audit trail (RN-DOC-008), sin duplicar con el mecanismo de auditoría de acceso existente.
- El endpoint aplica primero tenant + confidencialidad (404 uniforme) y después permiso por estado/docRole (403), usando la matriz real de permisos existente (`DocumentPermissionResolver` / `permissions.ts`) — sin reglas nuevas de acceso.
- Handler MSW del endpoint de visor, respetando los mismos permisos por estado y rol.
- **Hallazgo de seguridad documentado (no resuelto aquí):** `DocumentoStorageService` guarda originales y PDFs de distribución bajo `wwwroot/uploads/documentos/...`, servidos por `app.UseStaticFiles()` sin autenticación. Este change no agrava ese problema (la caché de vistas previas vive fuera de `wwwroot` y el visor nunca apunta a esas URLs estáticas), pero el hallazgo se deja registrado en `design.md` para un change aparte (`almacenamiento-documentos-privado`, aplica también a `PlanoStorageService`).

## Capabilities

### New Capabilities
- `document-viewer`: visor de PDF embebido en el frontend (componente `react-pdf`/pdf.js), sin descarga, impresión restringida por rol, sin capa de texto seleccionable, y su integración en el detalle del documento ("Ver documento").
- `document-viewer-api`: endpoint backend `GET /api/documents/{id}/visor`, generación y caché de vista previa server-side vía `IDocumentoPdfConverter`, marca OBSOLETO al servir, registro de auditoría `VISUALIZACION`, y control de concurrencia de conversión por documento.

### Modified Capabilities
- `document-detail`: agrega la acción principal "Ver documento" (antes "Descargar archivo original" era la acción principal) con sus estados de carga/error, visible según la tabla estado×rol.
- `document-permissions` (**autor-lectura-publicado**, 2026-10-08, decisión de Toño — tarea adicional plegada en este change porque todavía no estaba archivado): `AUTOR` pasa a tener `canRead: true` en `PUBLICADO` y en `OBSOLETO`, igual que `REVISOR`/`APROBADOR` — el PRD §4.2 describe esas celdas como "Sin acceso", pero esa literalidad se refería a edición, no a lectura: el autor no podía ver su propio documento una vez publicado. `canEdit`/`canDelete`/`canStartReview` siguen en `false` para `AUTOR` en ambos estados — solo cambia lectura. Efecto derivado (sin tocar la fórmula): `canViewArchivoDistribucion` pasa a `true` para `AUTOR` en `PUBLICADO` (depende de `canRead`); el acceso al archivo original (RN-DOC-013/014, CA-34) no cambia.

**Nota (investigada, sin cambio de spec):** `document-pdf-security` describe `requestDocumentPdf`/`requestDocumentView` (`src/utils/documentPdf.ts`), un flujo de la era mock que **ya no está en uso** en ningún componente real (confirmado por búsqueda — nada lo importa; fue superado por los hooks reales `useExportarPdfControlado`/`useGetArchivoUrl` durante el cutover). Su `TODO` sobre RN-DOC-010 ("deferred until the .NET backend exists") sigue literalmente en el código muerto. Este change implementa la aplicación real de RN-DOC-010 (impresión restringida, sin copia de texto) de cero en `document-viewer`, sin tocar `documentPdf.ts` ni su spec — retirar ese archivo muerto y actualizar/eliminar `document-pdf-security` es limpieza fuera de alcance aquí (ver `design.md`).

## Impact

- **Backend .NET**: nuevo endpoint/controlador de visor, nuevo servicio de caché de vista previa, reutiliza `IDocumentoPdfConverter` (`pdf-distribucion-real`) y `DocumentoPdfGenerator` (sellado con PdfSharpCore). Depende de que LibreOffice esté configurado (`PdfConversion:SofficePath`).
- **Frontend**: nueva dependencia `react-pdf` (+ worker de pdf.js para Vite), nuevo componente de visor reutilizable, cambios en `DocumentDetailPage`/`DocumentActionPanel`.
- **MSW**: nuevo handler `documents.handlers.ts` para el endpoint de visor.
- **Tipos TS / contrato**: sin cambios al tipo `Documento` (el visor es un endpoint derivado, no un campo nuevo).
- **Orden de implementación**: este change depende de `pdf-distribucion-real` y `fix-descarga-archivos-nombre` (ambos con tareas completas, pendientes de archivar) y debe implementarse **después** de que `revision-periodica-permiso-por-rol` se archive (actualmente tiene tareas pendientes).
