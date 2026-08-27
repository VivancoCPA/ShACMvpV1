## Context

Verificado contra el código real de `ShcMvpEndPoint` (.NET 10, EF Core para escrituras + Dapper para lecturas, patrón vertical-slice `Features/<Modulo>/<Accion>/`) y `shc-controldoc` (React, MSW):

- `Documento.QeVinculados` es hoy `Guid[]` mapeado a una columna real (`qe_vinculados`, `DocumentoSqlHelpers.SelectColumns`), pero **nada la escribe nunca** salvo el seeder de tests. La única condición que la lee es `EliminarDocumentoHandler.cs:25`, rotulada como "RN-DOC-005" en su comentario — pero esa regla, tanto en `CLAUDE.md` como en el mock (`documents.handlers.ts:437-443,596-601`), gobierna bloquear la transición a `OBSOLETO`, no `DELETE`.
- El backend **no tiene ningún endpoint que transicione manualmente a `OBSOLETO`**. La única vía real es automática: `FirmarPublicarDocumentoHandler.cs:44-62` obsoletiza la versión `PUBLICADO` previa del mismo código al publicar una nueva versión — sin ninguna validación de vínculos hoy.
- `QualityEvent` (`Domain/Entities/QualityEvent.cs`) **no tiene ningún campo** `DocumentosVinculados` — nunca se portó desde el mock a `be-quality-events`.
- `DashboardSummaryBuilder.BuildAuditor` (`DashboardSummaryBuilder.cs:353-394`) es una función pura sobre `IReadOnlyList<QualityEvent>` — no recibe ni tiene forma de recibir datos de Documentos hoy. `evidenciasHallazgos` es el sentinel `(0, hallazgosO3.Count)`.
- Ninguno de los cambios de backend anteriores (`be-documentos`, `be-quality-events`, `be-dashboards`) conectó el frontend real a estas APIs — `shc-controldoc` sigue corriendo 100% contra MSW en desarrollo. Los tipos frontend (`Documento.qeVinculados: string[]`, `QualityEvent.documentosVinculados: string[]`) y sus fixtures reflejan el modelo del mock, no el de estos backends nuevos.
- `GET /api/quality-events` (`ListarQualityEventsQuery`/`ListarQualityEventsHandler`) **no soporta `search`** hoy (a diferencia de `GET /api/documents`, que sí lo tiene vía `ListarDocumentosQuery.Search` + `ILIKE` sobre `titulo`/`codigo`). El combobox nuevo, del lado QE, necesita poder buscar por `numero`/`descripcion` — esto es un gap que este cambio también cierra, no algo ya disponible como asumía la instrucción original.
- No existe ningún resolver de permisos por-QE análogo a `DocumentPermissionResolver` — `PATCH /api/quality-events/:id` (edición genérica) solo exige `RequireAuthorization()`, sin gate de rol alguno en el handler. El único control de "quién puede editar qué campo de un QE" vive hoy solo en el frontend (`qualityEventPermissions.ts`, `puedeEditarCabecera` — verdadero para `JEFE_CALIDAD_SYST` únicamente en estado `ABIERTO`, o `SUPERVISOR` responsable en `ABIERTO`), y no está pensado para una acción auxiliar como "vincular evidencia", que naturalmente necesita seguir disponible durante toda la investigación, no solo en `ABIERTO`.

## Goals / Non-Goals

**Goals:**
- Tabla puente real `DocumentoQualityEvent` + 4 endpoints simétricos, reemplazando `Documento.QeVinculados: Guid[]` sin dejarla en paralelo.
- RN-DOC-005 evaluada en el punto real donde un documento pasa a `OBSOLETO` (`FirmarPublicarDocumentoHandler`), no en `DELETE`.
- `GET /api/documents/:id` y `GET /api/quality-events/:id` devuelven el vínculo poblado con resumen suficiente para renderizar sin una segunda llamada.
- `evidenciasHallazgos` calculado contra datos reales.
- UI nueva (combobox + sección de solo-lectura) en `DocumentDetailPage` y `QualityEventDetail`, más los 4 handlers MSW equivalentes para que la UI sea usable/verificable en el navegador hoy (el frontend no está conectado al backend real).

**Non-Goals:**
- Vínculo Documento↔NoConformidad (mismo patrón fantasma, tercer par independiente — ver proposal.md).
- Conectar el frontend real a `ShcMvpEndPoint` (cutover de MSW a backend real) — sigue pendiente como un cambio transversal futuro, fuera de alcance aquí.
- Cualquier UI o endpoint de "obsoletizar manualmente" un documento — no existe hoy y este cambio no lo introduce; RN-DOC-005 se evalúa donde la obsoletización real ocurre (automática, al publicar).
- Historial de auditoría específico de vínculos más allá de una entrada `DOCUMENTO_AUDIT_TRAIL`/`QUALITY_EVENT_AUDIT_TRAIL` por acción (sin UI dedicada de "quién vinculó qué y cuándo" más allá del audit trail genérico ya existente en cada detalle).

## Decisions

### D1 — Tabla puente con clave compuesta, columna `QeVinculados`/`DocumentosVinculados` pasa a `[NotMapped]`
```csharp
// Domain/Entities/DocumentoQualityEvent.cs
public class DocumentoQualityEvent
{
    public Guid DocumentoId { get; set; }
    public Guid QualityEventId { get; set; }
    public required Guid EmpresaId { get; set; }
    public required Guid CreadoPorId { get; set; }
    public DateTime CreadoEn { get; set; }
}
```
`ShacDbContext`: `HasKey(x => new { x.DocumentoId, x.QualityEventId })`, sin navegaciones de colección hacia `Documento`/`QualityEvent` (no hace falta cargar el grafo completo por EF; los 4 endpoints y las lecturas resuelven vía Dapper/consultas directas, mismo patrón que el resto del proyecto).

`Documento.QeVinculados` cambia de `Guid[]` (columna real) a `[NotMapped] public List<QeVinculadoResumen> QeVinculados { get; set; } = [];` — ya no es una columna, es un campo poblado manualmente por el handler de lectura, igual que `QualityEvent.AccionesCorrectivas`/`AuditTrail` se pueblan hoy (la diferencia es que esos SÍ son FKs reales con navegación EF configurada; este campo no puede serlo porque el resumen mezcla columnas de la tabla puente con columnas de `quality_events`, no es una colección 1:1 de una sola tabla). Mismo tratamiento simétrico para `QualityEvent.DocumentosVinculados` (campo nuevo, no existía). `DocumentoSqlHelpers.SelectColumns`/el equivalente de `ObtenerQualityEventHandler` dejan de seleccionar la columna eliminada.

**Alternativa descartada**: mantener `Guid[]` y resolver el resumen en el frontend con una llamada adicional por cada id — descartada porque la instrucción original y el criterio ya usado por `AccionesCorrectivas` piden resumen poblado en un solo `GET`, evitando N+1 llamadas desde la UI del combobox/sección de solo-lectura.

### D2 — Nuevo módulo `Features/DocumentoQualityEvent/` (no vive dentro de Documentos ni de QualityEvents)
Es la primera tabla puente verdaderamente bidireccional del proyecto (a diferencia de `AccionCorrectivaQE`/`Incidente.qeId`, que son FKs simples con un dueño claro). Ponerla dentro de `Features/Documentos/` o `Features/QualityEvents/` obligaría a que un módulo importe código "ajeno" del otro para exponer su mitad de los 4 endpoints. Se crea:
```
Features/DocumentoQualityEvent/
  Shared/DocumentoQualityEventLinkService.cs   // Vincular/Desvincular/ObtenerResumenes, usado por ambos lados
  VincularDesdeDocumento/   // POST+DELETE /api/documents/:id/qe-vinculados[...]
  VincularDesdeQE/          // POST+DELETE /api/quality-events/:id/documentos-vinculados[...]
```
`DocumentoQualityEventLinkService` centraliza: verificación cross-empresa de ambos lados (404 uniforme), idempotencia de la creación, inserción del audit trail en ambos dominios (`DocumentoAuditTrail`/`QualityEventAuditTrail`, acción `QE_VINCULADO`/`QE_DESVINCULADO` y `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` respectivamente — mutación registrada, CLAUDE.md regla 12), y las dos consultas de resumen (`ObtenerQeVinculadosAsync(documentoId)`, `ObtenerDocumentosVinculadosAsync(qualityEventId)`) reutilizadas por `ObtenerDocumentoHandler`/`ObtenerQualityEventHandler`, por `FirmarPublicarDocumentoHandler` (RN-DOC-005) y por `DashboardDataFetcher` (evidenciasHallazgos).

**Alternativa descartada**: duplicar la lógica de vinculación en `Features/Documentos/VincularQE/` y `Features/QualityEvents/VincularDocumento/` sin servicio compartido — descartada porque la idempotencia + el 404 cross-empresa + el doble audit-trail son exactamente la misma lógica vista desde cualquiera de los dos lados; duplicarla arriesga que diverja (p.ej. que un lado sea idempotente y el otro no).

### D3 — RN-DOC-005 real: se evalúa en `FirmarPublicarDocumentoHandler`, no en un endpoint que no existe
Antes de fijar `versionPrevia.Estado = DocStatus.OBSOLETO` (línea 48 hoy), se consulta `DocumentoQualityEventLinkService.TieneVinculoActivoAsync(versionPrevia.Id)`: existe un vínculo a un QE cuyo `Estado` no es `CERRADO` ni `VERIFICADO`. Si es así, `FirmarPublicarDocumentoHandler` responde `409` (`ConflictException`) — **la publicación de la nueva versión completa se cancela**, no solo la obsoletización de la anterior (no hay un estado intermedio consistente donde la v2 esté `PUBLICADO` y la v1 siga `PUBLICADO` también, violaría RN-DOC-001).

`EliminarDocumentoHandler` conserva su guard existente (bloquea `DELETE` si el documento tiene cualquier vínculo, sin distinguir estado del QE — mismo criterio simplificado que tenía), pero:
- Dejar de citarlo como "RN-DOC-005" en el comentario (esa regla no es esta) — se documenta como una protección de integridad propia del endpoint de borrado, sin ID de regla de negocio asociado (no hay ninguna RN-DOC-XXX del PRD que gobierne esto; inventar un ID nuevo sin respaldo en el PRD/addenda viola la regla de numeración de este proyecto — ver `openspec/config.yaml`).
- Migra su fuente de datos de `documento.QeVinculados.Length > 0` a `DocumentoQualityEventLinkService.TieneAlgunVinculoAsync(documento.Id)` (tabla puente).

`be-documentos-api` spec (delta): el requirement "Eliminación y restauración" deja de citar "(RN-DOC-005...)" en su texto; se agrega un nuevo requirement/escenario para RN-DOC-005 real bajo la obsoletización automática de `FirmarPublicarDocumentoHandler`.

**Hallazgo adicional verificado en el mock**: `documents.handlers.ts` tiene el mismo bug latente que el backend real, por una razón distinta. Su handler `POST /api/documents/:id/status` sí evalúa `nuevoEstado === 'OBSOLETO' && doc.qeVinculados.length > 0` (línea ~437) — pero esa rama cubre únicamente una transición manual directa a `OBSOLETO` que `DOC_STATUS_TRANSITIONS` permite en el mapa pero que **ninguna UI dispara hoy** (`DocumentActionPanel.tsx` no tiene ningún botón "obsoletizar"). El bucle de auto-obsoletización real (líneas 447-464, disparado cuando *otro* documento del mismo `codigo` pasa a `PUBLICADO` — el análogo exacto de `FirmarPublicarDocumentoHandler` en el backend) **no tiene ningún check de `qeVinculados`** sobre el documento que está a punto de volverse `OBSOLETO`. Este cambio corrige también ese bucle en el mock, no solo el backend real — ver `document-msw-handlers` delta.

**Alternativa considerada**: aplicar RN-DOC-005 también al guard de `DELETE` (un documento en `BORRADOR`/`EN_REVISION` con vínculos a QEs todos `CERRADO`/`VERIFICADO` sí podría eliminarse). Descartada por alcance — no hay ningún caso de uso real que lo pida (un documento en `BORRADOR` nunca fue publicado, así que nunca fue la "evidencia" formal de un QE cerrado en el sentido que le da RN-DOC-005); se documenta como posible ajuste futuro si Toño lo pide, no se resuelve aquí.

### D4 — Permiso para vincular/desvincular: reutilizar `DocumentPermissionResolver.CanEdit` del lado Documento; **decisión abierta** del lado QE
**Lado Documento** (sin ambigüedad, mismo gate ya existente): `POST`/`DELETE /api/documents/:id/qe-vinculados[...]` exige `DocumentPermissionResolver.GetPermissions(documento.Estado, docRole).CanEdit` — verdadero para `AUTOR`/`JEFE_CALIDAD` en `BORRADOR`/`EN_REVISION`. Esto implica que un documento solo puede ganar (o perder) vínculos mientras es editable; una vez `PUBLICADO`, sus vínculos quedan fijos hasta que exista una nueva versión en `BORRADOR`. Coherente con RN-DOC-005: el vínculo se establece en algún punto anterior a la publicación, y sigue existiendo cuando, mucho después, esa versión eventualmente se obsoletiza.

**Lado QE** (sin gate real existente que replicar — decisión de producto menor, marcada como Open Question): no hay un `QEPermissionResolver` en el backend, y el único candidato del frontend (`puedeEditarCabecera`) es demasiado angosto (`JEFE_CALIDAD_SYST` solo en `ABIERTO`; `SUPERVISOR` responsable solo en `ABIERTO`) para una acción que tiene sentido durante toda la investigación (vincular evidencia normativa mientras se avanza de `EN_INVESTIGACION` a `PENDIENTE_CIERRE`). Propuesta: permitir vincular/desvincular a `JEFE_CALIDAD_SYST` (cualquier estado) o `SUPERVISOR` responsable de la investigación (`qe.ResponsableInvestigacionId == actorId`), mientras `qe.Estado` no sea `CERRADO` ni `VERIFICADO` — mismo criterio de "activo" que ya usa RN-DOC-005. Implementado en un nuevo `DocumentoQualityEventLinkService.PuedeVincularDesdeQE(qe, actorId, actorRolGlobal)`, aislado para poder ajustarse sin tocar el resto del servicio. **Requiere confirmación explícita de Toño antes de `/opsx:apply`** (ver Open Questions) — si no cierra, la alternativa más simple es replicar literalmente `puedeEditarCabecera` (solo `ABIERTO`), aceptando que la funcionalidad quede menos útil en la práctica.

### D5 — `evidenciasHallazgos` real: `DashboardDataFetcher` gana un `HashSet<Guid>` de QEs O3 con vínculo
`DashboardSummaryBuilder.BuildAuditor` sigue siendo una función pura (mismo criterio D1 de `be-dashboards`, testeable sin base de datos): gana un segundo parámetro `IReadOnlySet<Guid> qeIdsConDocumentoVinculado`. `DashboardDataFetcher` lo puebla con una sola consulta (`SELECT DISTINCT quality_event_id FROM documentos_quality_events WHERE quality_event_id = ANY(@HallazgoIds)`) antes de invocar al builder. `ConEvidencia` = hallazgos O3 cuyo id está en el set; `SinEvidencia` = el resto.

### D6 — Endpoints de lectura devuelven resumen, no solo el id — dos DTOs nuevos, mismo patrón que `AccionCorrectivaResumen`
```csharp
public sealed record QeVinculadoResumen(Guid Id, string Numero, QETipo Tipo, QESeveridad Severidad, QEEstado Estado);
public sealed record DocumentoVinculadoResumen(Guid Id, string Codigo, string Titulo, DocStatus Estado);
```
`ObtenerDocumentoHandler`/`ObtenerQualityEventHandler` ejecutan una consulta Dapper adicional (join `documentos_quality_events` → `quality_events`/`documentos`) y asignan el resultado a `documento.QeVinculados`/`qe.DocumentosVinculados` antes de retornar — mismo patrón exacto que `qe.AccionesCorrectivas = acciones` en `ObtenerQualityEventHandler.cs:79`. `ListarDocumentosHandler`/`ListarQualityEventsHandler` (listados) **no** incluyen el resumen poblado (evita N+1 en listas paginadas) — el campo queda `[]` ahí, igual que `AccionesCorrectivas` no se puebla en `ListarQualityEventsHandler` hoy.

### D7 — `GET /api/quality-events` gana `search` (gap no anticipado por la instrucción original)
`ListarQualityEventsQuery` gana `string? Search`; `ListarQualityEventsHandler` agrega `(numero ILIKE @SearchPattern OR descripcion ILIKE @SearchPattern)` al `WHERE`, mismo patrón exacto que `ListarDocumentosHandler.cs:28-29,50`. Frontend: `QEListParams` gana `search?: string`; `getQualityEvents` lo pasa como query param. Sin este campo, el combobox del lado "buscar QE para vincular desde un Documento" no tiene forma de filtrar.

### D8 — Combobox compartido: componente nuevo en `components/shared/`, no en `features/quality-events/`
`NormativaVinculadaCombobox` (referencia de estilo pedida por la instrucción) vive en `features/quality-events/components/` porque solo lo consume ese módulo. El componente nuevo (`DocumentoQECombobox`) lo consumen *ambos* módulos (`DocumentDetailPage` y `QualityEventDetail`), así que vive en `src/components/shared/DocumentoQECombobox.tsx`, siguiendo la convención de carpetas de `CLAUDE.md` (`components/shared/` para piezas cross-feature como `StatusBadge`/`SeverityTag`). Reutiliza el lenguaje visual de accesibilidad de `NormativaVinculadaCombobox` (`role="combobox"`/`role="listbox"`, cierre por `mousedown` afuera, clases del design system) pero la mecánica de datos es genuinamente distinta: contra un endpoint paginado del servidor con `useDebounce` (300ms, mismo valor que `DocumentListFilters.tsx`), selección múltiple con chips, mutación inmediata (sin botón "Guardar"), en vez de un catálogo local de un solo valor.

Props: `mode: 'document-search-qe' | 'qe-search-document'`, `linkedIds: string[]` (para excluir ya-vinculados de los resultados), `onSelect(id: string)`, `onRemove(id: string)`. No conoce las mutaciones ni las queries — esas viven en hooks específicos de cada feature (`useVincularQE(documentId)`/`useVincularDocumento(qeId)`), que sí conocen su propio `QUERY_KEYS` e invalidan su propio detail query en éxito (mismo patrón que `useDocumentActions.ts`).

### D9 — Placement en cada detalle
- `DocumentDetailPage.tsx`: nueva sección colapsable (mismo patrón `useState`+`ChevronDown`/`ChevronUp` que las secciones "Historial"/"Audit trail" ya existentes) entre "Versiones" y "Audit trail". `DocumentDetailHeader.tsx` banner (línea 40-44) cambia `documento.qeVinculados.join(', ')` (ids crudos) por `documento.qeVinculados.map(q => q.numero).join(', ')` (ahora que es `QeVinculadoResumen[]`).
- `QualityEventDetail.tsx`: nueva sección `QEDocumentosVinculadosSection` entre `QEVerificacionSection` y `QEAuditTrail`.

### D10 — Frontend + MSW en paralelo, mismo contrato — no es opcional
Ningún cambio de backend anterior conectó el frontend real; toda la UI hoy corre contra MSW. Este cambio es el primero que introduce un consumidor de UI genuinamente nuevo, así que construir solo el backend dejaría la UI nueva invisible/no verificable en el navegador — violaría el criterio de aceptación global "probar el golden path en el navegador antes de reportar completo" y "Handler MSW presente para cada endpoint consumido" (CLAUDE.md). Los 4 handlers MSW nuevos reutilizan el patrón de store cross-dominio ya establecido (`getDocumentsStore()`/`getQeStore()`, `mocks/handlers/documents.handlers.ts`/`quality-events.handlers.ts`) — el "vínculo" en el mock es simplemente mutar `doc.qeVinculados`/`qe.documentosVinculados` en memoria en ambos stores a la vez (no hay tabla puente real en MSW, es innecesaria ahí). `documents.fixtures.ts`/`quality-events.fixtures.ts` migran sus pocos vínculos precargados existentes de `string[]` a la forma de objeto enriquecido.

## Risks / Trade-offs

- [Riesgo] Bloquear la publicación completa de una nueva versión (D3) cuando la única vinculación "problemática" es la de la versión *anterior* puede sorprender al usuario (el error aparece al firmar la v2, no al vincular el QE a la v1) → Mitigación: el mensaje de error `409` debe nombrar explícitamente el QE bloqueante (`numero`) y sugerir desvincularlo o esperar su cierre; se cubre con un test de integración específico.
- [Riesgo] D4 (permiso del lado QE) es una decisión de producto sin precedente real que replicar — si Toño no confirma antes de `/opsx:apply`, el criterio propuesto podría no coincidir con su intención → Mitigación: marcado como Open Question explícita, aislado en una única función fácil de ajustar después.
- [Riesgo] `[NotMapped]` en `Documento.QeVinculados`/`QualityEvent.DocumentosVinculados` significa que si algún código nuevo intenta `db.Documentos.Include(d => d.QeVinculados)` (patrón EF habitual), fallará en tiempo de compilación/ejecución de forma no obvia → Mitigación: comentario explícito en la propiedad explicando que se puebla manualmente vía `DocumentoQualityEventLinkService`, mismo criterio que ya se documentaría si se buscara ese patrón en `AccionesCorrectivas` (que sí es mapeado, a diferencia de este caso — la asimetría se anota).
- [Riesgo, no bloqueante] La migración EF `DropColumn(QeVinculados)` sobre `documentos` no tiene datos de producción que perder (no hay producción todavía) → Sin mitigación necesaria, mencionado solo por completitud del Migration Plan.

## Migration Plan

1. Migración EF Core `AddDocumentoQualityEventLink`: crea tabla `documentos_quality_events` (PK compuesta, índices en `DocumentoId` y `QualityEventId` para las consultas de resumen en ambos sentidos), `DropColumn` de `documentos.qe_vinculados`. Reversible (`Down()` recrea la columna vacía + dropea la tabla).
2. `Domain/Entities/DocumentoQualityEvent.cs`, DTOs `QeVinculadoResumen`/`DocumentoVinculadoResumen`, `Features/DocumentoQualityEvent/Shared/DocumentoQualityEventLinkService.cs`.
3. Los 4 endpoints (`Features/DocumentoQualityEvent/VincularDesdeDocumento/`, `VincularDesdeQE/`), registrados en `Extensions/EndpointExtensions.cs`.
4. `FirmarPublicarDocumentoHandler` (RN-DOC-005 real, D3), `EliminarDocumentoHandler` (migra a la tabla puente, D3), `ObtenerDocumentoHandler`/`ObtenerQualityEventHandler` (resumen poblado, D6), `ListarQualityEventsQuery`/`Handler` (search, D7).
5. `DashboardDataFetcher`/`DashboardSummaryBuilder.BuildAuditor` (evidenciasHallazgos real, D5).
6. Frontend: `documents.types.ts`, `qualityEvent.types.ts` (breaking, D1), `components/shared/DocumentoQECombobox.tsx` (D8), hooks nuevos, secciones nuevas en ambos detalles (D9), claves i18n.
7. MSW: handlers + fixtures (D10).
8. `dotnet test` (Toño corre y reporta, mismo criterio que cambios de backend anteriores — Cowork no tiene SDK .NET en este entorno) + pasada manual en navegador del golden path (vincular desde ambos lados, ver banner/sección actualizados, desvincular) — primera vez que un cambio de este tipo de módulo requiere esa pasada, porque es el primero con UI nueva real.
9. Sin rollback especial más allá de la migración reversible — no hay datos de producción.

## Open Questions

1. **Permiso de vinculación/desvinculación del lado QE (D4)** — ¿`JEFE_CALIDAD_SYST` (cualquier estado activo) + `SUPERVISOR` responsable (estado activo) es el criterio correcto, o Toño prefiere replicar literalmente `puedeEditarCabecera` (restringido a `ABIERTO`)? Bloquea `/opsx:apply` hasta confirmación.
2. **Mensaje/UX del 409 en D3** — ¿basta con un mensaje de error con el número del QE bloqueante, o se espera que la UI liste explícitamente qué vínculos hay que resolver antes de reintentar publicar? Afecta el diseño del `DocumentSignatureModal.tsx` (manejo de errores de la mutación de firma).
