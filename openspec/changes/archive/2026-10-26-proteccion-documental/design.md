## Context

Diagnóstico confirmado leyendo el código real (`ShcMvpEndPoint`, cutover ya hecho — el backend .NET existe y está activo, a diferencia de lo que dice la tabla de stack de `CLAUDE.md`, desactualizada en ese punto):

| Vía | Qué entrega | Quién | ¿Log? |
|---|---|---|---|
| `GET /:id/archivo-distribucion` (`ArchivoDistribucionHandler`) | PDF maestro `PUBLICADO`, sin marca de agua | Cualquiera con `CanViewArchivoDistribucion` (incluye OPERARIO en `PUBLICADO`) | No — el handler no escribe ninguna entrada de audit trail |
| `POST /:id/exportar-pdf` (`ExportarPdfControladoHandler`) | Copia con marca de agua (usuario, hora Lima, hash), `DocumentoPdfGenerator.GenerarControlado` | Solo valida tenant y `estado === PUBLICADO`: **no valida confidencialidad ni `CanRead`** | Sí, `DESCARGA` con hash |
| `GET /:id/archivo` (`ObtenerArchivoHandler`) + `GET /stream/{token}` (`StreamArchivoHandler`, sin `.RequireAuthorization()`) + `DocumentoSignedUrlService` | URL firmada HMAC, TTL 15 min | — | Registra `VISUALIZACION` (aunque a veces es una descarga del original) |
| Botón "Ver archivo" (`canVerArchivo`, `DocumentActionPanel.tsx:136`) | — | **Nunca se muestra**: `canVerArchivo = hasFileAccess && !!documento.archivoUrl`, y el backend real nunca envía `archivoUrl` (confirmado: cero ocurrencias de `ArchivoUrl` en el código del backend) | — |
| Botón "Descargar PDF de distribución" (`DocumentDetailPage.tsx:205-217`, **no** `DocumentActionPanel` — corrección al documento de instrucciones original, que lo ubicaba ahí) | Llama `useGetArchivoDistribucionUrl`/`descargarArchivoDistribucion`, que pide `getArchivoDistribucionBlob` y dispara `<a download>` sobre el blob | Gateado por `perms.canViewArchivoDistribucion` (deriva de `CanRead` + estado) | No — mismo handler sin auditoría de arriba |
| `GET /uploads/documentos/...`, `/uploads/planos/...`, `/uploads/incidentes/...` (`DocumentoStorageService`, `PlanoStorageService`, `IncidenteEvidenciaStorageService`, todos bajo `env.WebRootPath`) | Cualquier archivo subido: originales y PDFs de distribución de Documentos, planos de Locales, evidencias/informes médicos de Incidentes | **Cualquiera, sin sesión** — `Program.cs:120` llama `app.UseStaticFiles()` antes de `UseAuthentication()`/`UseAuthorization()` (línea 123-124) | No |

Confirmado también: `useGetArchivoUrl`/`abrirArchivo` (el circuito de URL firmada) no tiene ningún otro consumidor en el código real — es el único lugar que lo importa, y su botón nunca se renderiza por la razón de arriba. Es código muerto en producción, no solo una ruta secundaria.

El visor embebido (`GET /:id/visor`, `visor-documentos`, 2026-10-07) ya lee el original/distribución **internamente** vía `DocumentoStorageService.ResolveDiskPath` — nunca construye ni expone una URL estática. No necesita cambios de comportamiento por este change, solo sigue funcionando igual una vez que `DocumentoStorageService` lea de la raíz privada en vez de `wwwroot`.

## Goals / Non-Goals

**Goals:**
- Ningún archivo de usuario (documentos, planos, evidencias/informes médicos de incidentes) queda accesible sin pasar por un endpoint autenticado con sus propias reglas de permiso.
- La única descarga de un documento vigente es la copia controlada: marca de agua, hash, restricciones de copia/impresión, y siempre auditada.
- `RN-DOC-009` (nunca exponer una URL de archivo directa) se cumple eliminando el único mecanismo que la necesitaba (el circuito de URL firmada), no añadiendo una capa nueva sobre él.

**Non-Goals:**
- No se decide el hosting de producción del storage (S3, Azure Blob, etc.) — Toño lo dejó explícitamente para después; este change solo saca los archivos de `wwwroot` hacia una raíz de disco local configurable.
- No se toca `documentPdf.ts`/la spec `document-pdf-security` (código muerto ya identificado en `visor-documentos` D8, confirmado de nuevo aquí — sigue sin ningún import real).
- No se agrega un mecanismo de limpieza de archivos huérfanos tras la migración (mismo criterio ya aceptado en `visor-documentos` D4 para la caché de vistas previas: nunca se destruye evidencia, el crecimiento sin límite se documenta como seguimiento).
- No se cambia el formato de `evidencias[].url`/`informeMedicoAdjunto` como string en la base de datos — sigue siendo un string; lo que cambia es que ese string se interpreta como una clave relativa de storage privado, resuelta por un endpoint, nunca como una URL servible directamente por el navegador.

## Decisions

### D1 — Única descarga de un documento vigente: la copia controlada (decisión de Toño)
`GET /:id/archivo-distribucion` deja de servir el PDF maestro para descarga directa. Se elimina el endpoint (no se mantiene como alias) — su único consumidor real (`useGetArchivoDistribucionUrl`/botón "Descargar PDF de distribución" en `DocumentDetailPage`) se retira del frontend y se reemplaza por "Descargar copia (PDF)", que llama a `exportar-pdf-controlado`.

`ExportarPdfControladoHandler` pasa a ser la única descarga de un documento vigente:
- Agrega `CanAccessByConfidencialidad` (404 uniforme, igual criterio que el resto del módulo) y `CanRead` vía `DocumentPermissionResolver.GetPermissions(...).CanRead` (403 si falla) — hoy no valida ninguno de los dos.
- Estados permitidos: `PUBLICADO` **y** `EN_REVISION_PERIODICA` (el documento sigue vigente durante la revisión periódica) — hoy solo `PUBLICADO`. `OBSOLETO` sigue sin descarga (RN-DOC-003): su único acceso de contenido es el visor, que ya aplica el sello "OBSOLETO — No usar".
- Mantiene sin cambios: la marca de agua (`GenerarControlado`, leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión" — **ya coincide** con la decisión D2 de Toño, no hace falta tocar el texto), el hash SHA-256, y el registro `DESCARGA`.

El modal de confirmación "pdf.previewTitle" existente en `DocumentActionPanel` (cosmético, D7 de `visor-documentos`) sigue disparando este mismo flujo — solo cambian las validaciones del handler y los estados permitidos, no el componente que lo invoca.

**Alternativa considerada:** mantener `archivo-distribucion` como alias que internamente llama al mismo código de `exportar-pdf-controlado`. Se descarta: dos rutas para la misma acción es superficie innecesaria, y el endpoint ya no tiene ningún consumidor real tras retirar el botón — mejor eliminarlo que mantenerlo muerto.

### D2 — Restricciones reales del PDF (RN-DOC-010): PdfSharpCore `SecuritySettings`, disuasorias
`GenerarControlado` (o el punto donde se genera el PDF final de la copia controlada) SHALL fijar `document.SecuritySettings`: `PermitExtractContent = false` (sin copia de texto, para cualquier rol) y `PermitPrint`/`PermitFullQualityPrint` en `true` solo cuando el actor resuelve `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`, `false` en caso contrario. Se documenta explícitamente (comentario en código + este design.md) que es una medida disuasoria: un lector de PDF puede ignorar `SecuritySettings`, la protección real es el control de acceso del endpoint (confidencialidad + `CanRead` + tenant, verificados en cada request) y el audit trail.

**Alternativa considerada:** aplicar las mismas restricciones también al PDF servido por el visor (`/visor`). Se descarta — el visor ya no permite copiar texto (`renderTextLayer={false}` en el frontend, `visor-documentos`) ni descargar; las restricciones de PdfSharpCore son específicas del archivo que sí sale del sistema (la copia controlada), que es el caso que `SecuritySettings` protege.

### D3 — Circuito de URL firmada (`archivo`/`stream`/`download-url`/`audit/access`/`DocumentoSignedUrlService`): se elimina completo
Confirmado que no tiene ningún consumidor real (ver tabla de Context) — se elimina `ObtenerArchivoEndpoint`/`Handler`, `StreamArchivoEndpoint`/`Handler`, `DocumentoSignedUrlService`, y en el frontend `useGetArchivoUrl`/`abrirArchivo` y el botón "Ver archivo" (`canVerArchivo`) de `DocumentActionPanel`. RN-DOC-009 ("la URL del archivo real nunca se expone directamente, con TTL") queda satisfecha por construcción: toda descarga/vista pasa por una petición autenticada con JWT por request (`archivo-original`, `visor`, `exportar-pdf`), sin ninguna URL intermedia que viva en el DOM o el historial del navegador — no hace falta un TTL porque no hay URL que expire.

**Hallazgo adicional confirmado durante la implementación**: `GET /:id/download-url` (`ObtenerDownloadUrlHandler`) y `POST /:id/audit/access` (`RegistrarAccesoAuditHandler`) son la misma familia de código muerto — el primero es un segundo punto de entrada al mismo `DocumentoSignedUrlService`/`/stream/{token}` (confirmado leyendo el handler: genera el mismo token y la misma URL `/api/documents/stream/{token}`); el segundo es el endpoint genérico de auditoría que `document-pdf-security` (mock-era) usaba, ya superado por el registro inline que hacen `archivo-original`/`visor`/`exportar-pdf` cada uno por su cuenta (mismo principio ya establecido en `visor-documentos` D5). Búsqueda confirmada: sus únicos consumidores en el frontend (`getDocumentDownloadUrl`/`registerDocumentAccess`, `useGetDownloadUrl`/`useRegisterAccess`) no tienen ningún componente real que los importe — mismo patrón exacto que `documentPdf.ts`. Se eliminan junto con el resto del circuito: `ObtenerDownloadUrlEndpoint`/`Handler`, `RegistrarAccesoAuditEndpoint`/`Handler`, y sus helpers/hooks de frontend.

`documento.archivoUrl`/`tipoArchivo` se eliminan del tipo `Documento` (frontend) y de cualquier DTO que los declare en el backend si existieran (verificado: el backend real nunca los puebla; son campos frontend-only ya muertos).

### D4 — Almacenamiento privado: raíz configurable, claves relativas, mismo servicio por dominio
Se agrega una sección de configuración `FileStorage` (ya existe `FileStorage:DocumentosRootPath` en `appsettings.Development.json`, sin ningún lector real — confirmado por búsqueda; se reemplaza por el esquema de abajo, consistente entre dominios):

```json
"FileStorage": {
  "RootPath": "storage"
}
```

`RootPath` relativo se resuelve contra `IWebHostEnvironment.ContentRootPath` (nunca `WebRootPath`); en desarrollo en Windows queda como una carpeta `storage/` junto al proyecto, fuera de `wwwroot` y agregada a `.gitignore`. Un valor absoluto (futuro, producción) se usa tal cual. Se agrega `IOptions<FileStorageOptions>` leído una sola vez, inyectado en los tres storage services.

Estructura por dominio bajo `RootPath` (mismas sub-rutas que hoy tenían bajo `wwwroot/uploads/`, para que la migración sea un simple `Directory.Move`):
- `documentos/{empresaId}/{documentoId}/original/{nombreArchivado}`
- `documentos/{empresaId}/{documentoId}/distribucion/{version}.pdf`
- `planos/{empresaId}/{nombreArchivo}`
- `incidentes/{empresaId}/{nombreArchivo}`

Los campos que hoy guardan `/uploads/...` (`ArchivoOriginalUrl`, `ArchivoDistribucionUrl`, `PlanoPngUrl`, `IncidenteEvidencia.Url`, `Incidente.InformeMedicoAdjunto`) **mantienen su nombre de columna** pero pasan a guardar la clave relativa sin el prefijo `/uploads/` (p.ej. `documentos/{empresaId}/{documentoId}/original/20260101-informe.docx`, en vez de `/uploads/documentos/{empresaId}/{documentoId}/original/20260101-informe.docx`). No se renombra la columna — evita una migración de esquema además de la migración de datos/archivos.

**Alternativa considerada:** una tabla/entidad `ArchivoAlmacenado` centralizada con metadatos. Se descarta por alcance — ningún dominio lo necesita hoy (cada uno ya resuelve su propio archivo con su propio servicio), y agregar una abstracción nueva no resuelve el problema real (la exposición estática).

### D5 — Migración idempotente de archivos existentes
Rutina de arranque, solo en `Development` (misma guarda que otras migraciones de datos del proyecto), ejecutada una vez al iniciar la app:
1. Para cada fila con un campo de archivo no nulo cuyo valor empiece con `/uploads/` (Documentos: `ArchivoOriginalUrl`/`ArchivoDistribucionUrl`; Locales: `PlanoPngUrl`; Incidentes: `IncidenteEvidencia.Url`/`Incidente.InformeMedicoAdjunto`):
   - Si el archivo físico existe bajo `wwwroot/{valorViejo}`, lo mueve a la ruta privada equivalente (mismo sub-path, sin el prefijo `/uploads/`) y actualiza la fila con la nueva clave.
   - Si el archivo físico NO existe (ya migrado, o referencia huérfana), no toca la fila — evita duplicar o romper una clave ya migrada (idempotencia).
2. Nunca borra el archivo origen hasta confirmar que la copia en destino existe y tiene el mismo tamaño; solo entonces borra el original de `wwwroot` (no es un `Directory.Move` atómico entre volúmenes distintos en todos los entornos — copia+verifica+borra es más seguro que mover a ciegas).
3. Al final, loguea cuántos archivos movió por dominio (Documentos/Locales/Incidentes) — information en vez de debug, para que quede visible en consola al levantar el backend.
4. Después de correr la migración, cualquier directorio restante bajo `wwwroot/uploads/` indica archivos huérfanos (fila eliminada o referencia rota) — se documentan, no se borran (mismo criterio de nunca destruir evidencia).

### D6 — Cierre de acceso estático
`app.UseStaticFiles()` se retira del todo si no sirve nada más que `/uploads/...` (a verificar en `Program.cs` durante la implementación: si sirve otros assets estáticos reales del propio sitio, se reemplaza por una configuración que excluya explícitamente `/uploads` en vez de quitar la línea completa). Se agrega un test de integración: `GET /uploads/documentos/{cualquier-ruta}` → `404`.

### D7 — Locales: nuevo endpoint autenticado para el plano
`GET /api/locales/{id}/plano`, `.RequireAuthorization()`, mismo patrón de aislamiento multi-tenant que el resto de Locales (404 si el `Local` no pertenece a la empresa activa del actor). Sin gate de rol adicional — ver un plano no es más sensible que ver el propio Local, que ya es accesible a cualquier rol autenticado de la empresa. Responde `Results.File(ruta, "image/png")`.

Frontend: `features/locations/api/locales.api.ts` agrega `getPlanoBlob(localId)` (`api.get(..., { responseType: 'blob' })`, mismo patrón que `getArchivoOriginalUrl`). `IncidentMapCanvas`/`IncidentMapView` dejan de recibir `planoPngUrl` como string para usarlo directo en `<img src>`; en su lugar, un hook nuevo (`usePlanoBlob(localId)`, TanStack Query) resuelve el blob y expone un object URL ya creado con `URL.createObjectURL`, revocado en el cleanup del `useEffect`... **corrección**: revocado vía el propio ciclo de vida de TanStack Query (`gcTime`/`onSettled` o un `useEffect` de limpieza en el componente que consume el hook, no en el fetcher) — no se usa `useEffect` para derivar el estado del blob en sí (eso sigue siendo responsabilidad de `useQuery`), solo para la revocación del object URL al desmontar, igual que ya hace `DocumentViewer` con el iframe de impresión.

### D8 — Incidentes: nuevo endpoint autenticado para evidencias (informe médico NO existe en el backend real — corrección)
`GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo`, `.RequireAuthorization()`, mismo aislamiento multi-tenant (404 si el `Incidente` no pertenece a la empresa activa). Sin gate de rol adicional — el detalle del incidente ya es visible a cualquier rol autenticado de la empresa (`incident-permissions` no restringe lectura por confidencialidad, a diferencia de Documentos). Resuelve `IncidenteEvidencia.Url` como clave privada (ya no como URL pública) y responde con el `Content-Type` ya guardado en `IncidenteEvidencia.Tipo`/inferido de la extensión.

**Corrección confirmada durante la implementación**: `Incidente.InformeMedicoAdjunto` **no existe en el backend real** — búsqueda exhaustiva en `ShcMvpEndPoint.Domain/Entities/Incidente.cs` y en todo el backend no encontró ninguna referencia a "Informe"/"InformeMedico". `incident.types.ts` (frontend) y el renderizado en `IncidentDetailPage.tsx` (`incident.informeMedicoAdjunto && (<a href={informeMedicoAdjunto}>...)`) son código muerto en producción — mismo patrón ya confirmado para `documento.archivoUrl` en D1/D3: un campo que el mock-era poblaba pero el backend real nunca implementó ni expone. **No hay ningún endpoint `GET /api/incidents/{id}/informe-medico` que crear** (nada que migrar, nada expuesto por `wwwroot` para este campo específico — el riesgo de seguridad de D6 no aplica aquí porque el dato nunca existió realmente). Retirar ese campo muerto del tipo `Incidente`/`IncidentDetailPage` es limpieza correcta pero fuera de alcance de este change (mismo criterio que D9 para `documentPdf.ts`) — queda como seguimiento sugerido.

Frontend: nuevo helper en `incident-api-client` (`getEvidenciaBlob(incidenteId, evidenciaId)`). `IncidentDetailPage`/`EvidenciasSubBlock` dejan de usar `<img src={ev.url}>`/`<a href={ev.url}>` directo; cada thumbnail/enlace resuelve su blob vía un hook (mismo patrón de object URL + revocación que D7) antes de mostrarse. El lightbox (que hoy recibe la URL cruda) recibe el object URL ya resuelto. El enlace de informe médico no se toca (sigue sin renderizarse nunca, por las mismas razones que nunca se renderizó).

**Riesgo de N+1 aceptado explícitamise**: una grilla de evidencias dispara una petición autenticada por thumbnail, en vez de una sola petición con URLs públicas precomputadas. Para el volumen esperado (evidencia de incidentes, no documentos masivos) es aceptable; no se opta por un endpoint de bundle/zip para no ampliar el alcance de este change.

### D9 — `document-pdf-security`/`documentPdf.ts`: confirmado muerto, y esta vez SÍ se retira (consecuencia forzada)
Mismo hallazgo que `visor-documentos` D8: cero imports reales de `requestDocumentPdf`/`requestDocumentView`. La intención original de este change era no tocarlo (igual que `visor-documentos`), pero `documentPdf.ts` referenciaba `documento.archivoUrl` — campo que D1/D3 retiran del tipo `Documento` (nunca lo envía el backend real). Dejar el campo solo para no romper código muerto no es una opción razonable; se retira `documentPdf.ts` completo (sin test asociado, sin otro import en todo el repo — confirmado por búsqueda) como consecuencia forzada de D1/D3, no como una limpieza independiente. La spec `document-pdf-security` queda igual de desactualizada que antes (describe ese archivo ya eliminado) — actualizarla/retirarla sigue fuera de alcance de este change, mismo criterio que `visor-documentos` D8.

## Risks / Trade-offs

- **R1 — Igual que el visor, las restricciones del PDF son disuasorias, no DRM real** (ver D2). → Mitigación: ninguna adicional; el control de acceso del endpoint y el audit trail son la protección real, documentado explícitamente para que nadie lo asuma distinto.
- **R2 — La migración de archivos (D5) corre en el arranque de la app en Development** — si hay muchos archivos, agrega latencia al primer arranque tras este change. → Mitigación: es una migración de un solo uso (idempotente, la segunda vez no encuentra nada que mover), y el volumen esperado en un entorno de desarrollo es bajo.
- **R3 — El N+1 de peticiones autenticadas por evidencia (D8)** podría notarse en un incidente con muchas fotos. → Mitigación: aceptado explícitamente, fuera de alcance optimizarlo aquí; revisar si en la práctica resulta lento.
- **R4 — Eliminar `archivo-distribucion` y el circuito de URL firmada es un cambio de contrato (BREAKING)**: cualquier consumidor externo no descubierto durante esta implementación que dependiera de esas rutas dejaría de funcionar. → Mitigación: se verificó exhaustivamente que el frontend real no tiene otro consumidor (ver Context); se documenta el `BREAKING` en el proposal.

## Migration Plan

1. Agregar `FileStorageOptions`/sección `FileStorage` y la migración idempotente de archivos (D4/D5) — correr y confirmar el conteo de archivos movidos antes de tocar ningún endpoint.
2. Cerrar `UseStaticFiles()` para `/uploads` (D6) y confirmar `404`.
3. Agregar los endpoints nuevos de Locales/Incidentes (D7/D8) y sus consumidores de frontend, antes de retirar nada — así nunca hay una ventana donde el plano/evidencia esté roto.
4. Endurecer `ExportarPdfControladoHandler` y ampliar sus estados (D1/D2).
5. Retirar `archivo-distribucion`, el circuito de URL firmada, y sus botones/hooks de frontend (D1/D3) — al final, una vez que "Descargar copia (PDF)" ya funciona como reemplazo.
6. Sin rollback automatizado: si algo falla, el fix es un revert del commit — la migración de archivos es aditiva (copia antes de borrar, D5), así que un revert de código deja los archivos ya migrados accesibles de nuevo bajo la ruta vieja solo si también se revierte la migración de datos (documentar este detalle en el commit si se llega a necesitar).

## Open Questions

- ¿El `GET /api/incidents/{id}/informe-medico` necesita algún gate adicional más allá de tenant (p.ej. solo roles con acceso a información médica)? El PRD de Incidentes no define una regla de confidencialidad explícita para este campo — se mantiene el mismo acceso que el resto del detalle del incidente (cualquier rol autenticado de la empresa) por consistencia, pero se señala para que Toño confirme si debería ser más restrictivo.
