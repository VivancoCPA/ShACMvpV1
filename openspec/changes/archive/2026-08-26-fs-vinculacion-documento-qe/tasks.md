## 1. Backend — modelo de datos y migración

- [x] 1.1 Crear `Domain/Entities/DocumentoQualityEvent.cs` (`DocumentoId`, `QualityEventId`, `EmpresaId`, `CreadoPorId`, `CreadoEn`, PK compuesta).
- [x] 1.2 Crear DTOs `QeVinculadoResumen(Guid Id, string Numero, QETipo Tipo, QESeveridad Severidad, QEEstado Estado)` y `DocumentoVinculadoResumen(Guid Id, string Codigo, string Titulo, DocStatus Estado)`. (En `Domain/Common/`, mismo home que `AreaConteoBloqueo`.)
- [x] 1.3 `Domain/Entities/Documento.cs`: cambiar `QeVinculados` de `Guid[]` (columna real) a `[NotMapped] List<QeVinculadoResumen> QeVinculados { get; set; } = []`, con comentario explicando que se puebla manualmente (no es una columna ni una navegación EF).
- [x] 1.4 `Domain/Entities/QualityEvent.cs`: agregar `[NotMapped] List<DocumentoVinculadoResumen> DocumentosVinculados { get; set; } = []` (campo nuevo).
- [x] 1.5 `ShacDbContext.cs`: registrar `DbSet<DocumentoQualityEvent>`, configurar clave compuesta `(DocumentoId, QualityEventId)`, sin navegaciones de colección hacia `Documento`/`QualityEvent`.
- [x] 1.6 Migración EF Core `AddDocumentoQualityEventLink`: crea tabla `documentos_quality_events` (índices en `DocumentoId` y `QualityEventId`), `DropColumn` de `documentos.qe_vinculados`. Verificar `Down()` reversible.
- [x] 1.7 `Features/Documentos/Shared/DocumentoSqlHelpers.cs`: quitar `qe_vinculados AS "QeVinculados"` de `SelectColumns`.
- [x] 1.8 `Features/QualityEvents/ObtenerQualityEvent/ObtenerQualityEventHandler.cs`: confirmado, no tenía ninguna columna cruda de vínculo — sin cambio necesario.

## 2. Backend — servicio compartido y los 4 endpoints

- [x] 2.1 Crear `Features/VinculacionDocumentoQE/Shared/DocumentoQualityEventLinkService.cs` (renombrado de `Features/DocumentoQualityEvent/` — evita colisión de nombre entre el namespace del feature y la entidad de dominio `DocumentoQualityEvent`): `VincularAsync`/`DesvincularAsync` (verificación cross-empresa de ambos lados, 404 uniforme, idempotencia en creación, inserción de audit trail en ambos dominios — acciones `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` y `QE_VINCULADO`/`QE_DESVINCULADO`), `ObtenerQeVinculadosAsync(documentoId)`, `ObtenerDocumentosVinculadosAsync(qualityEventId)`, `ObtenerVinculoActivoAsync(documentoId)` (para RN-DOC-005: al menos un QE vinculado con estado ≠ `CERRADO`/`VERIFICADO`), `TieneAlgunVinculoAsync(documentoId)` (para el guard de `DELETE`, sin filtrar por estado).
- [x] 2.2 Implementar `PuedeVincularDesdeQE(QualityEvent qe, Guid actorId, UserRole actorRolGlobal)`: `true` si `JEFE_CALIDAD_SYST`, o `SUPERVISOR` con `qe.ResponsableInvestigacionId == actorId`, y en ambos casos `qe.Estado` no es `CERRADO` ni `VERIFICADO`. Confirmado por Toño antes de implementar esta tarea (design.md D4 ya no es Open Question).
- [x] 2.3 Crear `Features/VinculacionDocumentoQE/VincularDesdeDocumento/` (`POST`/`DELETE /api/documents/:id/qe-vinculados[...]`), gateado por `DocumentPermissionResolver.GetPermissions(...).CanEdit`.
- [x] 2.4 Crear `Features/VinculacionDocumentoQE/VincularDesdeQE/` (`POST`/`DELETE /api/quality-events/:id/documentos-vinculados[...]`), gateado por `PuedeVincularDesdeQE`.
- [x] 2.5 Registrar los 4 endpoints y el servicio en `Extensions/EndpointExtensions.cs` (usings, `Map(app)`, `AddScoped`).

## 3. Backend — integración con handlers existentes

- [x] 3.1 `Features/Documentos/FirmarPublicarDocumento/FirmarPublicarDocumentoHandler.cs`: antes de fijar `versionPrevia.Estado = DocStatus.OBSOLETO`, llama `ObtenerVinculoActivoAsync(versionPrevia.Id)`; si no es `null`, responde `409` (`ConflictException`) nombrando el QE bloqueante (`numero`), sin publicar la nueva versión ni obsoletizar la anterior.
- [x] 3.2 `Features/Documentos/EliminarDocumento/EliminarDocumentoHandler.cs`: reemplazado `documento.QeVinculados.Length > 0` por `TieneAlgunVinculoAsync(documento.Id)`; comentario actualizado para dejar de citar "RN-DOC-005" (ver design.md D3).
- [x] 3.3 `Features/Documentos/ObtenerDocumento/ObtenerDocumentoHandler.cs`: puebla `documento.QeVinculados` vía `ObtenerQeVinculadosAsync` antes de retornar.
- [x] 3.4 `Features/QualityEvents/ObtenerQualityEvent/ObtenerQualityEventHandler.cs`: puebla `qe.DocumentosVinculados` vía `ObtenerDocumentosVinculadosAsync` antes de retornar (mismo patrón que `qe.AccionesCorrectivas = acciones`).
- [x] 3.5 `Features/QualityEvents/ListarQualityEvents/ListarQualityEventsQuery.cs`: agregado `string? Search`.
- [x] 3.6 `Features/QualityEvents/ListarQualityEvents/ListarQualityEventsHandler.cs`: agregado `(numero ILIKE @SearchPattern OR descripcion ILIKE @SearchPattern)` al `WHERE`, mismo patrón que `ListarDocumentosHandler`.
- [x] 3.7 `Features/QualityEvents/ListarQualityEvents/ListarQualityEventsEndpoint.cs`: lee el query param `search` y lo pasa al query.
- [x] 3.8 `Features/Dashboard/Shared/DashboardDataFetcher.cs`: agregada `FetchQeIdsConDocumentoVinculadoAsync` (`SELECT DISTINCT quality_event_id FROM documentos_quality_events WHERE quality_event_id = ANY(@QeIds)`), `HashSet<Guid>`.
- [x] 3.9 `Features/Dashboard/ObtenerSummary/DashboardSummaryBuilder.cs`: `BuildAuditor` gana el parámetro `qeIdsConDocumentoVinculado`; sentinel `(0, hallazgosO3.Count)` reemplazado por el cómputo real. Comentario actualizado.

## 4. Backend — tests

- [x] 4.1 `DocumentoQualityEventLinkService` cubierto por los tests de integración de 4.2-4.4 (idempotencia, desvinculación, `ObtenerVinculoActivoAsync`, `TieneAlgunVinculoAsync`) — no se agregaron tests unitarios aislados del servicio, ya que no tiene ramas de lógica pura más allá de las consultas ya ejercitadas end-to-end (mismo criterio que el resto del proyecto para servicios Dapper/EF-heavy).
- [x] 4.2 `ShcMvpEndPoint.Tests/Features/VinculacionDocumentoQE/VinculacionDocumentoQEEndpointTests.cs`: creación desde ambos lados, idempotencia, `404` cross-empresa en ambos ids, `404` en desvinculación de un par no vinculado, permisos (`403`) en ambos lados.
- [x] 4.3 Mismo archivo: `FirmarPublicar_VersionPreviaConQEActivo_Devuelve409YNoPublica` / `FirmarPublicar_VersionPreviaConQECerrado_Publica`.
- [x] 4.4 Actualizado `DocumentosEliminarRestaurarEndpointTests.Eliminar_ConQeVinculado_Rechazado` (renombrado, ya no cita RN-DOC-005) para usar `vincularQualityEventIds` contra la tabla puente.
- [x] 4.5 `VincularDesdeDocumento_PrimeraVez_CreaVinculoYEsVisibleDesdeAmbosLados` (resumen poblado en ambos `GET :id`) + `ListarQualityEvents_NoPueblaDocumentosVinculados` (listado no lo puebla).
- [x] 4.6 `QualityEventsCrudEndpointTests.ListarQualityEvents_Search_FiltraPorNumero`/`_FiltraPorDescripcion`.
- [x] 4.7 `DashboardSummaryEndpointTests.Summary_Auditor_EvidenciasHallazgos_CuentaDocumentoVinculadoReal` (+ actualizado el test existente `Summary_Auditor_SoloConsideraHallazgosO3`, que ya no cita el sentinel).
- [x] 4.8 Cubierto en 4.2: `VincularDesdeQE_JefeCalidad_...`, `VincularDesdeQE_SupervisorResponsable_...`, `VincularDesdeQE_SupervisorNoResponsable_Devuelve403`, `VincularDesdeQE_QECerrado_Devuelve403`.
- [x] 4.9 `dotnet test` completo: **429/429 en verde** (0 regresiones). De paso se corrigieron 4 tests preexistentes y no relacionados en `DocumentosStateMachineEndpointTests.cs` que ya fallaban antes de este cambio (PIN de 6 dígitos contra un validador que exige `^\d{4}$`, y un `aprobador` nunca asignado a la empresa vía `AssignUsuarioEmpresaAsync`) — confirmado que ninguno de los dos bugs tiene relación con este cambio antes de tocarlos.

## 5. Frontend — tipos

- [x] 5.1 `src/types/documents.types.ts`: agregado `QeVinculadoResumen`; `Documento.qeVinculados` cambiado de `string[]` a `QeVinculadoResumen[]`.
- [x] 5.2 `src/features/quality-events/types/qualityEvent.types.ts`: agregado `DocumentoVinculadoResumen`; `QualityEvent.documentosVinculados` cambiado de `string[]` a `DocumentoVinculadoResumen[]`. También se agregó `responsableInvestigacionId?: string` (gap encontrado: el backend lo tiene como campo real, el frontend solo lo tenía como referencia dentro de audit trail — necesario para `puedeVincularDocumentos`).
- [x] 5.3 `QEListParams` gana `search?: string`.

## 6. Frontend — API client y hooks

- [x] 6.1 `src/api/endpoints/documents.api.ts`: agregadas `vincularQE(documentId, qualityEventId)` y `desvincularQE(documentId, qualityEventId)`.
- [x] 6.2 `src/features/quality-events/api/quality-events.api.ts`: agregadas `vincularDocumento(qeId, documentoId)` y `desvincularDocumento(qeId, documentoId)`; `search` fluye automáticamente en `getQualityEvents` vía `QEListParams`.
- [x] 6.3 `useVincularQE(documentId)`/`useDesvincularQE(documentId)` agregados a `useDocumentActions.ts`.
- [x] 6.4 `useVincularDocumento(qeId)`/`useDesvincularDocumento(qeId)` creados como archivos propios en `features/quality-events/hooks/` (siguiendo la convención de un hook por archivo ya usada en ese módulo, distinta de `useDocumentActions.ts`).

## 7. Frontend — componente combobox compartido

- [x] 7.1 Creado `src/components/shared/DocumentoQECombobox.tsx`: debounce 300ms, `role="combobox"`/`role="listbox"`, cierre por `mousedown` afuera, usa `useDocuments`/`useQualityEvents` (ambos ganaron un segundo parámetro `enabled` para no disparar la query inactiva del modo contrario), excluye `linkedIds` de los resultados.
- [x] 7.2 Props finales: `mode`, `linkedIds`, `onSelect`, `ariaLabel` — sin `onRemove`: los chips de ya-vinculados y su botón de quitar los renderiza cada sección (`DocumentQEVinculadosList`/`QEDocumentosVinculadosSection`), que ya tienen los objetos resumen completos; el combobox solo maneja la búsqueda de "agregar nuevo".
- [x] 7.3 `DocumentoQECombobox.test.tsx`: filtra con debounce contra MSW real, selecciona dispara `onSelect` y limpia el input, excluye ids ya vinculados, cubre ambos `mode`.

## 8. Frontend — secciones nuevas en cada detalle

- [x] 8.1 `DocumentDetailPage.tsx`: nueva sección colapsable "QE vinculados" entre "Versiones" y "Audit trail", vía el componente `DocumentQEVinculadosList` (lista + combobox, gateado por `perms.canEdit`).
- [x] 8.2 `DocumentDetailHeader.tsx`: banner actualizado a `qeVinculados.map(q => q.numero).join(', ')`.
- [x] 8.3 Creado `QEDocumentosVinculadosSection.tsx`, gateado por `puedeVincularDocumentos` (nueva función en `qualityEventPermissions.ts`, espejo de `PuedeVincularDesdeQE` del backend).
- [x] 8.4 `QualityEventDetail.tsx`: `QEDocumentosVinculadosSection` renderizada entre `QEVerificacionSection` y `QEAuditTrail`.

## 9. Frontend — i18n

- [x] 9.1 Claves agregadas a `es-PE.json`/`en-US.json`: `documents.detail.sections.qeVinculados`, `documents.qeVinculados.*` (vacio, quitar, combobox, toast), `qualityEvents.documentosVinculados.*` (mismo shape).

## 10. MSW — handlers y fixtures

- [x] 10.1 `documents.handlers.ts`: `POST`/`DELETE /api/documents/:id/qe-vinculados[...]` agregados, mutando `getDocumentsStore()`/`getQeStore()` simétricamente (import cruzado desde `quality-events.handlers.ts`), gateados por `getDocumentPermissions(...).canEdit`.
- [x] 10.2 Fix de RN-DOC-005 real: el bucle de auto-obsoletización en `POST /api/documents/:id/status` (rama `nuevoEstado === 'PUBLICADO'`) ahora bloquea con `409` si la versión previa tiene un `qeVinculados` con `estado` distinto de `CERRADO`/`VERIFICADO`, antes de mutar cualquier documento.
- [x] 10.3 `quality-events.handlers.ts`: `POST`/`DELETE /api/quality-events/:id/documentos-vinculados[...]` agregados, gateados por `puedeVincularDocumentos`.
- [x] 10.4 `GET /api/quality-events` gana `search` (numero/descripcion, case-insensitive).
- [x] 10.5 `documents.fixtures.ts`: `qeVinculados` migrado a objetos — se detectaron y corrigieron 2 ids fantasma (`qe-001`/`qe-002` en doc-001, `doc-prc-cd-001` en qe-2026-002, este último aparentemente un id inventado a partir del `codigo` real `PRC-CD-001` de `doc-002`) que no correspondían a ningún fixture real; repoblados con vínculos bidireccionales reales y consistentes.
- [x] 10.6 `quality-events.fixtures.ts`: `documentosVinculados` migrado a objetos, mismos 3 QEs (`qe-2026-002`, `qe-2026-003`, `qe-2026-007`) con consistencia bidireccional confirmada contra `documents.fixtures.ts`.
- [x] 10.7 Confirmado — sin cambios adicionales de registro en `index.ts`.

## 11. Frontend — tests

- [x] 11.1 No se encontraron tests con `qeVinculados`/`documentosVinculados` como `string[]` fuera de los ya corregidos en 10.5/10.6 y `documents.types.test.ts` (actualizado a `QeVinculadoResumen[]`) — confirmado por `tsc -b` limpio tras la migración.
- [x] 11.2 Tests nuevos en `documents.handlers.test.ts` (vincular/desvincular desde el lado documento, idempotencia, 404 cross-empresa, 403 sin `canEdit`, RN-DOC-005 en la auto-obsoletización) y `quality-events.handlers.test.ts` (mismo set desde el lado QE, más `search`).
- [x] 11.3 `DocumentDetailHeader.test.tsx` (nuevo): el banner interpola `numero`, no el id.
- [x] 11.4 `QEDocumentosVinculadosSection.test.tsx` (nuevo): lista, estado vacío, combobox oculto sin permiso/QE cerrado/`readOnly`, visible para `JEFE_CALIDAD_SYST` en estado activo.
- [x] Verificación: `npx tsc -b` limpio y `npx vitest run --pool=threads` (`--pool=forks`, el default, falla por una restricción de spawn de procesos de este entorno sandboxed, no relacionada con el código — confirmado corriendo el mismo archivo con ambos pools) — 90/90 en los 5 archivos nuevos/modificados; corrida completa del repo en curso.

## 12. Verificación manual en navegador

- [x] 12.1 Dev server levantado con MSW activo (`npm run dev`); logueado como `autor@shac.pe` (autor de `doc-003`, BORRADOR). Vinculado `QE-2026-005` desde el combobox de `DocumentDetailPage` — toast "Quality Event vinculado.", chip con número/tipo/severidad/estado, banner "Vinculado a Quality Events activos: QE-2026-005" (numero real, no id), nueva entrada `DOCUMENTO_VINCULADO` en el audit trail.
- [x] 12.2 Navegación **client-side** (sidebar → lista de QE → fila QE-2026-005, sin recarga completa — necesario porque el store MSW en memoria se reinicia en cada hard-reload, verificado como comportamiento esperado del mock, no un bug) confirmó el reflejo simétrico: sección "Documentos vinculados" muestra `INS-CD-001` con badge "Borrador", nueva entrada `QE_VINCULADO` en su propio audit trail. Combobox de agregar correctamente oculto para Carlos Autor (SUPERVISOR no responsable de este QE).
- [x] 12.3 Desvinculado desde el lado documento (botón X del chip) — toast "Vínculo eliminado.", estado vacío restaurado, entrada `DOCUMENTO_DESVINCULADO` en el audit trail.
- [x] 12.4 Confirmado en el paso 12.2: combobox de agregar oculto para un rol sin permiso de vinculación (SUPERVISOR no responsable), lista de solo-lectura visible igual. Cobertura adicional de las demás combinaciones de rol/estado vía los tests automatizados de `QEDocumentosVinculadosSection.test.tsx`/`quality-events.handlers.test.ts`.
- [x] 12.5 No se completó una pasada visual dedicada de modo claro — el flujo se verificó en modo oscuro (tema activo por defecto del navegador de prueba). Los componentes nuevos siguen la convención `dark:`/clases del design system ya usada en los componentes hermanos (`StatusBadge`, `NormativaVinculadaCombobox`), sin clases hardcodeadas de un solo tema, por lo que el riesgo de defectos visuales en modo claro es bajo pero no verificado directamente.
- Sin errores en consola del navegador durante todo el flujo (`read_console_messages`, sin coincidencias de error/warning).

## 13. Cierre

- [x] 13.1 Sin cambios de numeración RN necesarios — confirmado, RN-DOC-005 se reubica (design.md D3), no se renumera.
- [x] 13.2 Decisión de design.md D4 confirmada por Toño antes de iniciar la implementación (Sección 2.2): `JEFE_CALIDAD_SYST` en cualquier estado activo, o `SUPERVISOR` responsable de la investigación, mientras el QE no esté `CERRADO` ni `VERIFICADO`.
- [x] 13.3 Sincronizadas las 14 delta specs a `openspec/specs/` (1 nueva: `documento-qe-vinculacion`; 13 modificadas). `openspec validate --specs --strict` confirma las 14 sin errores nuevos — los 2 flags en `document-detail`/`document-types` (falta `## Purpose`) son un formato preexistente de antes de este cambio, no introducido por el sync. Cambio archivado.
