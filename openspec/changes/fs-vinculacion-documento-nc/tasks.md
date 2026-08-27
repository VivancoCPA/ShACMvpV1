## 1. Backend — modelo de datos y migración

- [x] 1.1 Crear `Domain/Entities/DocumentoNoConformidad.cs` (`DocumentoId`, `NoConformidadId`, `EmpresaId`, `CreadoPorId`, `CreadoEn`, PK compuesta).
- [x] 1.2 Crear DTO `NcVinculadoResumen(Guid Id, string Numero, NCTipo Tipo, NCSeveridad Severidad, NCEstado Estado)` en `Domain/Common/`. Reutilizar `DocumentoVinculadoResumen` ya existente (`Domain/Common/DocumentoVinculadoResumen.cs`) para `NoConformidad.DocumentosVinculados` — no crear un DTO duplicado.
- [x] 1.3 `Domain/Entities/Documento.cs`: agregar `[NotMapped] List<NcVinculadoResumen> NcVinculados { get; set; } = []` (campo nuevo), con comentario explicando que se puebla manualmente, mismo criterio que `QeVinculados`.
- [x] 1.4 `Domain/Entities/NoConformidad.cs`: agregar `[NotMapped] List<DocumentoVinculadoResumen> DocumentosVinculados { get; set; } = []` (campo nuevo, hoy no existe en absoluto).
- [x] 1.5 `ShacDbContext.cs`: registrar `DbSet<DocumentoNoConformidad> DocumentosNoConformidades`, configurar clave compuesta `(DocumentoId, NoConformidadId)` + índices en ambas columnas, sin navegaciones de colección.
- [x] 1.6 Migración EF Core `AddDocumentoNoConformidadLink`: crea tabla `documentos_no_conformidades` (índices en `DocumentoId` y `NoConformidadId`). Sin `DropColumn` — no hay columna previa que eliminar. Verificar `Down()` reversible.

## 2. Backend — servicio compartido y los 4 endpoints

- [x] 2.1 Crear `Features/VinculacionDocumentoNC/Shared/DocumentoNoConformidadLinkService.cs`, replicando método por método `DocumentoQualityEventLinkService` (`Features/VinculacionDocumentoQE/Shared/`): `VincularAsync`/`VincularDesdeNCAsync`/`DesvincularAsync`/`DesvincularDesdeNCAsync` (verificación cross-empresa de ambos lados, 404 uniforme, idempotencia en creación, inserción de audit trail en ambos dominios — acciones `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` y `NC_VINCULADO`/`NC_DESVINCULADO`), `ObtenerNcVinculadosAsync(documentoId)`, `ObtenerDocumentosVinculadosAsync(noConformidadId)`, `TieneAlgunVinculoAsync(documentoId)` (para el guard de `DELETE` de Documento, sin filtrar por estado).
- [x] 2.2 Implementar `PuedeVincularDesdeNC(NoConformidad nc, UserRole actorRolGlobal)`: `true` si `actorRolGlobal` es `SUPERVISOR` o `JEFE_CALIDAD_SYST`, y `nc.Estado` no es `CERRADA` ni `ANULADA` — sin restricción por responsable de investigación (confirmado por Toño, design.md D3, ya no es Open Question).
- [x] 2.3 Crear `Features/VinculacionDocumentoNC/VincularDesdeDocumento/` (`POST`/`DELETE /api/documents/:id/nc-vinculadas[...]`), gateado por `DocumentPermissionResolver.GetPermissions(...).CanEdit` (reutilizado tal cual, sin cambios).
- [x] 2.4 Crear `Features/VinculacionDocumentoNC/VincularDesdeNC/` (`POST`/`DELETE /api/nonconformities/:id/documentos-vinculados[...]`), gateado por `PuedeVincularDesdeNC`.
- [x] 2.5 Registrar los 4 endpoints y el servicio en `Extensions/EndpointExtensions.cs` (usings, `Map(app)`, `AddScoped`).

## 3. Backend — integración con handlers existentes

- [x] 3.1 `Features/Documentos/EliminarDocumento/EliminarDocumentoHandler.cs`: extender el guard existente para bloquear también si `DocumentoNoConformidadLinkService.TieneAlgunVinculoAsync(documento.Id)` es `true` (además del check ya existente contra `DocumentoQualityEventLinkService`) — mismo criterio "cualquier vínculo bloquea, sin distinguir estado" (design.md D4). Inyectar el nuevo servicio junto al existente.
- [x] 3.2 `Features/Documentos/ObtenerDocumento/ObtenerDocumentoHandler.cs`: puebla `documento.NcVinculados` vía `ObtenerNcVinculadosAsync`, además del ya existente `documento.QeVinculados`.
- [x] 3.3 `Features/NoConformidades/ObtenerNoConformidad/ObtenerNoConformidadHandler.cs`: puebla `nc.DocumentosVinculados` vía `ObtenerDocumentosVinculadosAsync` antes de retornar (mismo patrón que `nc.AccionesCorrectivas`).

## 4. Backend — tests

- [x] 4.1 `ShcMvpEndPoint.Tests/Features/VinculacionDocumentoNC/VinculacionDocumentoNCEndpointTests.cs`: creación desde ambos lados, idempotencia, `404` cross-empresa en ambos ids, `404` en desvinculación de un par no vinculado, permisos (`403`) en ambos lados (`PuedeVincularDesdeNC`: `SUPERVISOR`/`JEFE_CALIDAD_SYST` en NC activa vinculan; `OPERARIO`/`AUDITOR_INTERNO`/etc. y NC `CERRADA`/`ANULADA` son rechazados).
- [x] 4.2 Mismo archivo (o test dedicado en `DocumentosEliminarRestaurarEndpointTests.cs`): `Eliminar_ConNcVinculada_Rechazado` — actualizar/agregar el test de `EliminarDocumentoHandler` para cubrir el bloqueo por vínculo de NC (no solo QE), confirmando que un documento sin QE vinculado pero con NC vinculada también responde `409`.
- [x] 4.3 `VincularDesdeDocumento_PrimeraVez_CreaVinculoYEsVisibleDesdeAmbosLados` (resumen poblado en ambos `GET :id`) + confirmar que `ListarNoConformidades`/`ListarDocumentos` no populan el resumen en listados paginados.
- [x] 4.4 `dotnet test` completo (Toño corre y reporta — Cowork no tiene SDK .NET en este entorno): confirmar 0 regresiones sobre el baseline actual.

## 5. Frontend — tipos

- [x] 5.1 `src/types/documents.types.ts`: agregar interfaz `NcVinculadoResumen` (`{ id, numero, tipo: NCTipo, severidad: NCSeveridad, estado: NCStatus }`); `Documento` gana `ncVinculados: NcVinculadoResumen[]` (campo nuevo).
- [x] 5.2 `src/features/nonconformities/types/nonconformity.types.ts`: agregar interfaz local `DocumentoVinculadoResumen` (`{ id, codigo, titulo, estado: DocStatus }`, mismo patrón de declaración local ya usado en `qualityEvent.types.ts`); `NoConformidad.documentosVinculados` cambia de `string[]` a `DocumentoVinculadoResumen[]`.

## 6. Frontend — API client y hooks

- [x] 6.1 `src/api/endpoints/documents.api.ts`: agregar `vincularNC(documentId, noConformidadId)` y `desvincularNC(documentId, noConformidadId)`.
- [x] 6.2 `src/features/nonconformities/api/nonconformities.api.ts`: agregar `vincularDocumento(ncId, documentoId)` y `desvincularDocumento(ncId, documentoId)`.
- [x] 6.3 `useVincularNC(documentId)`/`useDesvincularNC(documentId)` agregados a `useDocumentActions.ts` (mismo archivo que ya tiene `useVincularQE`/`useDesvincularQE`).
- [x] 6.4 `useVincularDocumento(ncId)`/`useDesvincularDocumento(ncId)` agregados a `useNonconformities.ts`, invalidando `QUERY_KEYS.nonconformities.detail(ncId)` en éxito, sin toast de éxito (mismo criterio que el lado QE — vincular es una acción liviana, ya visible en la UI).
- [x] 6.5 `useNonconformities(filters?, enabled = true)`: agregar el segundo parámetro `enabled`, pasado directo a `useQuery` (mismo patrón que `useDocuments`/`useQualityEvents`) — gap necesario para que el combobox nuevo controle cuándo dispara la búsqueda.

## 7. Frontend — componente combobox

- [x] 7.1 Crear `src/components/shared/DocumentoNCCombobox.tsx`, copiando la mecánica de `DocumentoQECombobox.tsx` (debounce 300ms, `role="combobox"`/`role="listbox"`, cierre por `mousedown` afuera, excluye `linkedIds` de los resultados) con `mode: 'document-search-nc' | 'nc-search-document'`, usando `useDocuments`/`useNonconformities` (ambos con `enabled`).
- [x] 7.2 Mismas props que `DocumentoQECombobox`: `mode`, `linkedIds`, `onSelect`, `ariaLabel` — sin `onRemove` (los ítems ya-vinculados y su botón de quitar los renderiza cada sección contenedora, igual que el precedente de QE).
- [x] 7.3 `DocumentoNCCombobox.test.tsx`: filtra con debounce contra MSW real, selecciona dispara `onSelect` y limpia el input, excluye ids ya vinculados, cubre ambos `mode`.

## 8. Frontend — secciones nuevas en cada detalle

- [x] 8.1 `DocumentDetailPage.tsx`: nueva sección colapsable "NC vinculadas" inmediatamente después de la sección "QE vinculados" existente y antes de "Audit trail", vía un componente `DocumentNCVinculadasList` (lista + combobox, gateado por `perms.canEdit`, mismo componente que ya existe `DocumentQEVinculadosList` como referencia estructural).
- [x] 8.2 Crear `NCDocumentosVinculadosSection.tsx` en `features/nonconformities/components/`, gateado por `getNCPermissions(nc, userRole).canEdit` (reutilizado tal cual — sin nueva función de permiso frontend, a diferencia del lado QE que sí necesitó `puedeVincularDocumentos`).
- [x] 8.3 `NonconformityDetailPage.tsx`: `NCDocumentosVinculadosSection` renderizada entre la sección "Acciones Correctivas" y la sección colapsable "Audit Trail".

## 9. Frontend — i18n

- [x] 9.1 Claves agregadas a `es-PE.json`/`en-US.json`: `documents.detail.sections.ncVinculados`, `documents.ncVinculados.*` (vacio, quitar, combobox.placeholder, combobox.ariaLabel), `nonconformities.documentosVinculados.*` (mismo shape que `qualityEvents.documentosVinculados.*`).

## 10. MSW — handlers y fixtures

- [x] 10.1 `documents.handlers.ts`: `POST`/`DELETE /api/documents/:id/nc-vinculadas[...]` agregados, mutando `getDocumentsStore()`/`getNonconformitiesStore()` simétricamente (import cruzado desde `nonconformities.handlers.ts`), gateados por `getDocumentPermissions(...).canEdit`.
- [x] 10.2 `nonconformities.handlers.ts`: `POST`/`DELETE /api/nonconformities/:id/documentos-vinculados[...]` agregados, gateados por el equivalente MSW de `PuedeVincularDesdeNC` (`SUPERVISOR`/`JEFE_CALIDAD_SYST`, NC no `CERRADA`/`ANULADA`).
- [x] 10.3 `EliminarDocumentoHandler` del mock (`documents.handlers.ts`, ruta `DELETE /api/documents/:id`): confirmar si ya replica el guard "cualquier vínculo bloquea" contra `qeVinculados`; si es así, extenderlo para incluir `ncVinculados` con el mismo criterio (paridad con el backend real, tarea 3.1).
- [x] 10.4 `documents.fixtures.ts`: agregar `ncVinculados: []` (o precargado) como campo nuevo en cada fixture; al menos un documento con vínculo real a una NC fixture existente, bidireccional.
- [x] 10.5 `nonconformities.fixtures.ts`: `documentosVinculados` migrado de `string[]` a objetos `DocumentoVinculadoResumen[]`; al menos una NC con vínculo real a un documento fixture existente, bidireccional.
- [x] 10.6 Confirmar registro en `index.ts` — sin cambios adicionales esperados (los handlers nuevos se agregan a los arrays ya exportados).

## 11. Frontend — tests

- [x] 11.1 Buscar cualquier test que asuma `documentosVinculados`/`ncVinculados` como `string[]` (incluyendo `nonconformity.types.test.ts` si existe) y actualizarlo a la forma de objeto.
- [x] 11.2 Tests nuevos en `documents.handlers.test.ts` (vincular/desvincular desde el lado documento, idempotencia, 404 cross-empresa, 403 sin `canEdit`) y `nonconformities.handlers.test.ts` (mismo set desde el lado NC, incluyendo 403 para `OPERARIO`/NC `CERRADA`).
- [x] 11.3 `DocumentNCVinculadasList.test.tsx`/`NCDocumentosVinculadosSection.test.tsx` (nuevos): lista, estado vacío, combobox oculto sin permiso.
- [x] 11.4 Verificación: `npx tsc -b` limpio y `npx vitest run` sobre los archivos nuevos/modificados, sin regresiones.

## 12. Verificación manual en navegador

- [x] 12.1 Dev server con MSW activo (`npm run dev`). Vincular una NC desde el combobox de `DocumentDetailPage` (logueado como autor de un documento en `BORRADOR`) — confirmar toast, ítem en la lista, entrada `DOCUMENTO_VINCULADO` en el audit trail.
- [x] 12.2 Navegar (client-side) al detalle de esa NC y confirmar el reflejo simétrico: sección de documentos vinculados muestra el documento, entrada `NC_VINCULADO` en su propio audit trail.
- [x] 12.3 Desvincular desde cualquiera de los dos lados — confirmar toast, estado vacío restaurado, entrada `_DESVINCULADO` en ambos audit trails.
- [x] 12.4 Confirmar que el combobox de agregar está oculto para un rol sin permiso de vinculación en cada lado (documento `PUBLICADO`; NC `CERRADA`/`ANULADA`, o rol `OPERARIO`), con la lista de solo-lectura igual visible.
- [x] 12.5 Intentar `DELETE` sobre un documento con una NC vinculada (sin QE vinculado) y confirmar el `409` — verifica la extensión del guard de la tarea 3.1/10.3.
- [x] 12.6 Sin errores en consola del navegador durante todo el flujo.

## 13. Cierre

- [x] 13.1 Confirmar que no hace falta ningún cambio de numeración RN — este cambio no introduce ninguna regla de negocio nueva (confirmado en proposal.md/design.md).
- [x] 13.2 Sincronizar las 14 delta specs a `openspec/specs/` (1 nueva: `documento-nc-vinculacion`; 13 modificadas) y correr `openspec validate --specs --strict` antes de archivar.
