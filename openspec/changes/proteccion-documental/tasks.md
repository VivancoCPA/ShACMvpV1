## 0. Pre-requisito de secuenciación

- [x] 0.1 Confirmar que `visor-documentos` (incluida la sección 10, `autor-lectura-publicado`) está archivado, o que sus tests pendientes (sección 4, 10.6-10.9, 9.2-9.10) ya se resolvieron — este change depende de él (usa el visor y la matriz de permisos ya corregida). Si no, pausar y retomar cuando se archive. **Decisión explícita del usuario (2026-10-09): proceder sin esperar el archivado formal** — se verificaron y corrigieron las secciones 1.4/2.4/4/10.6 (3 fallos reales encontrados y corregidos, 15/15 tests de `DocumentosVisorEndpointTests` en verde), quedando solo la verificación manual (9.3-9.10, 10.8) y una corrida 100% limpia de la suite completa (9.2/10.7, bloqueada por restricciones de recursos del entorno, no por el código) sin resolver. El usuario decidió avanzar con `proteccion-documental` en paralelo.

## 1. Backend — Almacenamiento privado (config + servicios)

- [x] 1.1 Agregar `FileStorageOptions` (`RootPath`) y registrar `IOptions<FileStorageOptions>`; reemplazar/limpiar el valor sin uso `FileStorage:DocumentosRootPath` en `appsettings.Development.json` por `FileStorage:RootPath` (p.ej. `storage`), resuelto contra `ContentRootPath`. Agregar la carpeta resultante a `.gitignore`. (`Shared/FileStorageOptions.cs`, `Shared/FileStorageRoot.cs`.)
- [x] 1.2 `DocumentoStorageService`: cambiar `GuardarOriginalAsync`/`GuardarDistribucionAsync`/`CopiarOriginalAsync`/`ResolveDiskPath` para usar la raíz privada (`FileStorageOptions.RootPath` vía `ContentRootPath`) en vez de `env.WebRootPath`, y guardar/leer la clave sin el prefijo `/uploads/`.
- [x] 1.3 `PlanoStorageService.GuardarAsync`: mismo cambio de raíz y formato de clave.
- [x] 1.4 `IncidenteEvidenciaStorageService.GuardarAsync`: mismo cambio de raíz y formato de clave.
- [x] 1.5 Agregar un método `ResolveDiskPath`/equivalente a `PlanoStorageService` e `IncidenteEvidenciaStorageService` (hoy solo `DocumentoStorageService` lo tiene), siguiendo el mismo patrón (clave relativa → ruta física, `null`/archivo inexistente → `null`).

## 2. Backend — Migración idempotente de archivos existentes

- [x] 2.1 Crear una rutina de migración (ejecutada al arrancar en `Development`, mismo patrón que otras migraciones de datos del proyecto) que recorra `Documentos` (`ArchivoOriginalUrl`, `ArchivoDistribucionUrl`), `Locales` (`PlanoPngUrl`), e `IncidenteEvidencia` (`Url`) buscando valores con prefijo `/uploads/`. (`Incidente.InformeMedicoAdjunto` no existe en el backend real — ver design.md D8 — no hay nada que migrar ahí.) (`Shared/FileStorageMigration.cs`.)
- [x] 2.2 Para cada fila encontrada: si el archivo existe bajo `wwwroot/{valor}`, copiarlo a la ruta privada equivalente, verificar tamaño igual, actualizar la fila con la clave nueva, y solo entonces borrar el archivo de `wwwroot`. Si no existe, no tocar la fila (idempotencia).
- [x] 2.3 Loguear a nivel `Information` cuántos archivos se migraron por dominio (Documentos/Locales/Incidentes).
- [x] 2.4 Tests: la migración mueve archivos existentes y actualiza las filas; correrla una segunda vez no falla ni duplica nada; una fila con archivo físico inexistente no rompe la rutina. (`FileStorageMigrationTests.cs`, 3/3 — encontraron y corrigieron un bug real: `MigrarCampoAsync` no incluía el segmento `uploads/` al buscar el archivo físico viejo, solo lo tenía en cuenta para la clave nueva.)

## 3. Backend — Cierre de acceso estático

- [x] 3.1 En `Program.cs`, revisar si `app.UseStaticFiles()` sirve algo más que `/uploads/...`. Si no, quitar la línea; si sí, excluir explícitamente `/uploads` (o mover esos otros assets a una ruta distinta) para que ningún archivo de usuario quede accesible estáticamente. (Confirmado: `wwwroot` solo tenía `uploads/` — línea retirada.)
- [x] 3.2 Test de integración: `GET /uploads/documentos/{cualquier-ruta}` (y `/uploads/planos/...`, `/uploads/incidentes/...`) responde `404` sin ningún token. (`AccesoEstaticoRetiradoTests.cs`.)

## 4. Backend — Endpoint de plano de Locales

- [x] 4.1 Crear feature slice `Features/Locales/ObtenerPlano/` (`ObtenerPlanoEndpoint.cs`, `ObtenerPlanoHandler.cs`): `GET /api/locales/{id}/plano`, `.RequireAuthorization()`, aislamiento multi-tenant (404 si el Local no pertenece a la empresa activa), 404 si `PlanoPngUrl` es `null` o el archivo no existe. Responde `Results.File(ruta, "image/png")`.
- [x] 4.2 Registrar el endpoint en `Program.cs`/mapeo de endpoints de Locales.
- [x] 4.3 Tests de integración: usuario autenticado de la empresa obtiene el plano (200); Local de otra empresa (404); Local sin plano (404). (`ObtenerPlanoEndpointTests.cs`.)

## 5. Backend — Endpoint de evidencias de Incidentes

**Corrección (confirmada leyendo el código real):** `Incidente.InformeMedicoAdjunto` no existe en el backend — es un campo frontend-only, nunca implementado, código muerto en producción (ver design.md D8). Se elimina del alcance el endpoint `GET /api/incidents/{id}/informe-medico` y su migración — no hay nada real que exponer ni migrar para ese campo.

- [x] 5.1 Crear feature slice para `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo`: `.RequireAuthorization()`, aislamiento multi-tenant (404 si el Incidente no pertenece a la empresa activa o la evidencia no pertenece al incidente), resuelve la clave vía `IncidenteEvidenciaStorageService`, responde con el `Content-Type` inferido del campo `Tipo`/extensión.
- [x] 5.3 Registrar el endpoint en `Program.cs`/mapeo de endpoints de Incidentes.
- [x] 5.4 Tests de integración: evidencia de la propia empresa (200); de otra empresa (404); incidente/evidencia inexistente (404). (`ObtenerEvidenciaEndpointTests.cs`.)

## 6. Backend — Copia controlada como única descarga (D1/D2)

- [x] 6.1 `ExportarPdfControladoHandler`: agregar `CanAccessByConfidencialidad` (404 si falla) y `DocumentPermissionResolver.GetPermissions(estado, docRole).CanRead` (403 si falla), evaluados antes de la validación de estado existente.
- [x] 6.2 Ampliar la validación de estado de `estado === PUBLICADO` a `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}`.
- [x] 6.3 Aplicar `SecuritySettings` de PdfSharpCore al PDF generado (`GenerarControlado` o el punto de ensamblado final): `PermitExtractContent = false` siempre; `PermitPrint`/`PermitFullQualityPrint = true` solo si el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`, `false` en caso contrario. Documentar en comentario que es disuasorio, no DRM real (mismo criterio que design.md R1). (Se fija además `OwnerPassword` — sin eso la mayoría de lectores ignora los bits de permiso.)
- [x] 6.4 Eliminar `ArchivoDistribucionEndpoint.cs`/`ArchivoDistribucionHandler.cs` y su registro en `Program.cs`.
- [x] 6.5 Tests de integración de `exportar-pdf`: CONFIDENCIAL sin rol habilitado → 404; sin `CanRead` → 403; `EN_REVISION_PERIODICA` → 200; `OBSOLETO` → error de negocio (422, `BusinessRuleException`), sin generar PDF; `PermitExtractContent=false` siempre; `PermitPrint=true` solo para JEFE_CONTROL_DOCUMENTARIO/ALTA_DIRECCION. (`ExportarPdfControladoValidacionesTests.cs`.)
- [x] 6.6 Test de integración: `GET /:id/archivo-distribucion` responde 404 (ruta ya no registrada). (Incluido en `ExportarPdfControladoValidacionesTests.cs`.)

## 7. Backend — Retiro del circuito de URL firmada

**Hallazgo adicional (confirmado leyendo el código real):** `ObtenerDownloadUrlHandler` (`GET /:id/download-url`) es un segundo punto de entrada al mismo `DocumentoSignedUrlService`/`/stream/{token}`, y `RegistrarAccesoAuditHandler` (`POST /:id/audit/access`) es el endpoint genérico de auditoría del flujo mock-era, ya superado por el registro inline de `archivo-original`/`visor`/`exportar-pdf`. Ninguno tiene consumidor real (ver design.md D3) — se amplía el alcance de esta sección para retirarlos también. También se retiró `DocumentoArchivoVigenteResolver` (sin otro consumidor que los handlers eliminados).

- [x] 7.1 Eliminar `ObtenerArchivoEndpoint.cs`/`ObtenerArchivoHandler.cs`, `StreamArchivoEndpoint.cs`/`StreamArchivoHandler.cs`, `ObtenerDownloadUrlEndpoint.cs`/`ObtenerDownloadUrlHandler.cs`, `RegistrarAccesoAuditEndpoint.cs`/`RegistrarAccesoAuditHandler.cs`, `DocumentoSignedUrlService.cs`, y sus registros en `Program.cs`/DI.
- [x] 7.2 Verificar que ningún otro handler del backend dependa de `DocumentoSignedUrlService` antes de eliminarlo (búsqueda de referencias).
- [x] 7.3 Tests de integración: `GET /:id/archivo`, `GET /api/documents/stream/{token}`, `GET /:id/download-url`, `POST /:id/audit/access` responden 404 (rutas no registradas). (`CircuitoUrlFirmadaRetiradoTests.cs`.)

## 8. Frontend — Almacenamiento privado (Locales + Incidentes)

- [x] 8.1 `features/locations/api/locales.api.ts` y `api/endpoints/locales.api.ts` (dos clientes API de Locales distintos en el código real; se agregó en ambos): `getPlanoBlob(localId)` (`api.get('/api/locales/:id/plano', { responseType: 'blob' })`).
- [x] 8.2 Nuevo hook `usePlanoBlob(localId)` (TanStack Query, en `features/locations/hooks/useLocales.ts` y `features/incidents/hooks/useLocales.ts`) que resuelve el blob y expone un object URL, revocándolo en el cleanup al desmontar/cambiar de local.
- [x] 8.3 Dejar de pasar `local.planoPngUrl` como string estático a `<img src>`; usar el object URL de `usePlanoBlob`. **Ampliado tras encontrar más consumidores reales de los previstos**: `IncidentMapView`→`IncidentMapCanvas`, `HeatmapIncidentesWidget`→`IncidentMapCanvas` (dashboard), `IncidentForm` (plano interactivo para marcar ubicación), `IncidentDetailPage` (marcador sobre el plano), y `LocalForm`→`PlanoUploadField` (preview del plano ya guardado al editar un Local). `IncidentMapCanvas` en sí no necesitó cambios — ya solo renderiza el string que recibe. Estado vacío (`onError`/404) existente sin cambios.
- [x] 8.4 Nuevo helper en el cliente API de incidentes: `getEvidenciaBlob(incidenteId, evidenciaId)` (`responseType: 'blob'`). (Sin `getInformeMedicoBlob` — `informeMedicoAdjunto` no existe en el backend real, ver design.md D8; no se toca.)
- [x] 8.5 Cada thumbnail/enlace de evidencia resuelve su blob vía `useEvidenciaBlob` antes de mostrarse (object URL + revocación), en un componente dedicado por evidencia (reglas de hooks). **Ampliado tras encontrar más consumidores reales**: `IncidentDetailPage`/`EvidenciasSubBlock` (galería + lightbox) y, dentro de `IncidentForm.tsx`, tanto `EvidenciasZona` (thumbnails de evidencias existentes al editar) como el bloque separado de "evidencias existentes" más abajo en el mismo formulario (lightbox).
- [ ] 8.7 Tests de componente dedicados a `IncidentMapCanvas`/`EvidenciasSubBlock` — **pendiente**: no se escribieron archivos de test nuevos para estos componentes específicos (no existían antes de este change tampoco). El comportamiento queda cubierto indirectamente y en verde por los tests existentes ya corregidos (`HeatmapIncidentesWidget.test.tsx` 7/7 — ejercita `IncidentMapCanvas` vía `usePlanoBlob`; `IncidentDetailPage.test.tsx`/`IncidentForm.test.tsx` — ejercitan los thumbnails de evidencia vía `useEvidenciaBlob`), pero no hay un test aislado que verifique el estado vacío en 404 específicamente para estos dos componentes.

## 9. Frontend — Copia controlada como única descarga (D1)

- [x] 9.1 `DocumentActionPanel.tsx`: eliminar el botón "Ver archivo" (`canVerArchivo`) y el import/uso de `useGetArchivoUrl`.
- [x] 9.2 Corregir `canExportarPdf` (renombrado `canDescargarCopia`): `documento.estado ∈ ['PUBLICADO', 'EN_REVISION_PERIODICA'] && hasFileAccess && perms.canRead` (sin depender de `documento.archivoUrl`). Renombrada la etiqueta visible a "Descargar copia (PDF)" (clave i18n `actions.descargarCopia`) y agregado el texto de ayuda `actions.descargarCopiaAyuda`.
- [x] 9.3 `DocumentDetailPage.tsx`: eliminado el botón "Descargar PDF de distribución" (`useGetArchivoDistribucionUrl`/`descargarArchivoDistribucion`) y el bloque `perms.canViewArchivoDistribucion && distUrl` — reemplazado por el botón de `DocumentActionPanel`. `showArchivoSection` ya no depende de `canViewArchivoDistribucion`.
- [x] 9.4 `useDocumentActions.ts`/`documents.api.ts`: eliminados `useGetArchivoUrl`, `getArchivoUrl`, `useGetArchivoDistribucionUrl`, `getArchivoDistribucionBlob`, `useGetDownloadUrl`, `getDocumentDownloadUrl`, `useRegisterAccess`, `registerDocumentAccess` (ya sin consumidores — ver design.md D3, hallazgo adicional).
- [x] 9.5 `documents.types.ts`: eliminados `archivoUrl`/`tipoArchivo` del tipo `Documento`. **Hallazgo adicional**: `utils/documentPdf.ts` (ya confirmado código muerto en `visor-documentos` D8) referenciaba `documento.archivoUrl` directamente — al quitar el campo del tipo, dejaba de compilar. Se eliminó el archivo completo (sin test asociado, cero otros imports en el repo — ver design.md D9) como consecuencia forzada, no como limpieza independiente. También se eliminó el consumidor muerto `getFileTypeInfo(documento.archivoUrl, documento.tipoArchivo)` en `DocumentDetailPage.tsx` (siempre `null` en producción). `tsc --noEmit` limpio tras estos cambios.
- [x] 9.6 Tests: `DocumentActionPanel` — "Ver archivo" ya no existe; "Descargar copia (PDF)" visible en `PUBLICADO`/`EN_REVISION_PERIODICA` con acceso, ausente en `BORRADOR`/`EN_REVISION`/`EN_APROBACION`/`OBSOLETO` (33/33 en `DocumentActionPanel.test.tsx`, incluye los fixes a tests existentes rotos por el cambio). `DocumentDetailPage` no tiene test file dedicado (no existía antes de este change tampoco) — el botón de distribución retirado se verificó manualmente por lectura de código, no por test automatizado.

## 10. MSW

- [x] 10.1 `documents.handlers.ts`: eliminados los handlers de `GET /:id/archivo-distribucion`, `GET /:id/archivo`, `GET /:id/download-url`, `POST /:id/audit/access` (nunca hubo handler de `stream/:token` en MSW — no aplica). Ampliado el handler de `POST /:id/exportar-pdf` para validar confidencialidad/`canRead` y permitir `EN_REVISION_PERIODICA` además de `PUBLICADO`, replicando las mismas reglas del backend real.
- [x] 10.2 `locales.handlers.ts`: agregado handler `GET /api/locales/:id/plano` devolviendo un PNG real mínimo (`mocks/utils/minimalPng.ts`, blob), con el mismo gate de tenant que el resto de Locales.
- [x] 10.3 `incidents.handlers.ts`: agregado handler `GET /api/incidents/:incidenteId/evidencias/:evidenciaId/archivo`, devolviendo bytes reales (PNG mínimo para imágenes, PDF real vía jsPDF para el resto) con el mismo gate de tenant. (Sin handler de informe médico — ver nota de la sección 5. Nota: no existía ningún handler MSW para `POST /api/incidents/evidencias`, el endpoint de subida — gap preexistente, no introducido por este change, fuera de alcance corregirlo aquí.)
- [x] 10.4 Confirmado: `planoPngUrl`/`evidencias[].url` en los fixtures (placeholders externos `placehold.co`/`/mock/plano-placeholder.png`) ya no se usan como `src`/`href` directos en ningún componente real tras la sección 8 — el nuevo gate de los handlers de arriba solo verifica verdad/falsedad y pertenencia, nunca el valor literal. `archivoOriginalUrl`/`archivoDistribucionUrl` en `documents.handlers.ts` no se tocan (MSW ya los trataba como claves resueltas por `archivo-original`/`visor`/`exportar-pdf`, nunca como URL pública).

## 11. Verificación final

- [ ] 11.1 Correr la suite completa del frontend (`vitest`) y `tsc --noEmit`.
- [ ] 11.2 Correr los tests del backend (.NET).
- [ ] 11.3 Detener el backend, ejecutar `dotnet build`, levantar de nuevo con MSW apagado (`VITE_ENABLE_MSW=false`).
- [ ] 11.4 Prueba manual: copiar en el navegador una URL antigua `/uploads/documentos/...` sin iniciar sesión → debe fallar (404).
- [ ] 11.5 Prueba manual: como OPERARIO, descargar la copia de un documento `PUBLICADO` → el PDF tiene su nombre, la fecha, "COPIA NO CONTROLADA", no permite copiar texto ni imprimir, y la descarga aparece en el audit trail.
- [ ] 11.6 Prueba manual: como `JEFE_CONTROL_DOCUMENTARIO`, la misma copia sí permite imprimir.
- [ ] 11.7 Prueba manual: en un documento `OBSOLETO` no aparece ninguna acción de descarga, solo "Ver documento".
- [ ] 11.8 Prueba manual: en un documento `EN_REVISION_PERIODICA`, "Descargar copia (PDF)" funciona.
- [ ] 11.9 Prueba manual: los planos de Locales se siguen viendo (mapa de incidentes) tras la migración.
- [ ] 11.10 Prueba manual: las evidencias de un incidente existente (pre-migración) se siguen viendo/descargando tras la migración.
- [ ] 11.11 Prueba manual: correr la app una segunda vez (reiniciar backend) y confirmar que la migración no vuelve a mover nada ni rompe lo ya migrado.
- [ ] 11.12 Releer el código real implementado y actualizar `design.md`/specs si algo divergió durante la implementación, antes de avisar "listo".
