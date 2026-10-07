## Context

`CambiarEstadoDocumentoHandler.cs` (`ShcMvpEndPoint/Features/Documentos/CambiarEstadoDocumento/`) maneja las 6 transiciones sin firma de `Documento`, incluyendo las dos variantes de `_ → BORRADOR`:

- `EN_REVISION → BORRADOR` con `Motivo` no nulo → rechazo formal del revisor (`permisos.CanReject`), `esRechazo = true`.
- `EN_REVISION → BORRADOR` sin `Motivo` → cancelación de revisión del Jefe de Calidad (`permisos.CanEdit`), `esRechazo = false`.
- `EN_APROBACION → BORRADOR` → rechazo del aprobador (`permisos.CanReject`), siempre `esRechazo = true`.

Hoy las tres escriben **una sola** entrada `DocumentoAuditTrail` con `Accion = "ESTADO_CAMBIADO"`, `EstadoAnterior`/`EstadoNuevo` correctos, y el motivo (si existe) en `ValorAnterior` — campo reservado para "valor previo de un campo editado" (`CAMPO_EDITADO`), no para un motivo de rechazo. El mismo patrón se repite en el mock (`documents.handlers.ts:697-701`, `valorAnterior: motivo`). `DocumentoAuditTrailLoader.SelectColumns` (la única vía por la que `GET /api/documents/:id` puebla `Documento.AuditTrail`, agregada en `fix-detalle-documento-historial-audit`) no proyecta ningún campo nuevo — solo los que ya existen en la entidad — así que agregar `motivo` a la entidad no basta: hay que agregarlo también a este SELECT.

`DocumentoAuditTrail` no tiene DTO de proyección propio: Dapper mapea directo a la entidad de dominio y esta se serializa tal cual en la respuesta (mismo patrón que el resto del dominio — ver `[JsonIgnore]` en la navegación `Documento`). Por eso agregar el campo a la entidad + al SELECT es suficiente para que llegue al frontend, sin tocar ningún mapper intermedio.

El frontend nunca pinta el motivo: `DocumentAuditTrail.describeEntry` (`shc-controldoc/src/features/documents/components/DocumentAuditTrail.tsx:44-54`) solo compone un diff cuando hay `campoModificado`; para `ESTADO_CAMBIADO` solo muestra `estadoAnterior → estadoNuevo`. `DocumentHistorial.describeEntry` (mismo archivo, patrón idéntico) tiene la misma limitación.

## Goals / Non-Goals

**Goals:**
- Dar a cada una de las tres transiciones `_ → BORRADOR` su propia acción de audit trail, para que el log sea legible sin tener que inferir el caso por ausencia/presencia de un campo mal usado.
- Mover el motivo a una columna con semántica propia (`Motivo`), append-only, visible en el detalle del documento.
- Migrar los datos históricos sin perder información ni dejar el log en un estado mixto permanente.

**Non-Goals:**
- No se introduce un motivo opcional para `REVISION_CANCELADA` en este change (el proposal lo deja abierto para el futuro; hoy esa transición sigue sin motivo).
- No se cambia el contrato de `DocumentRejectModal` ni el body que envía al backend (`{ estado, motivo, notificarAutor }` se mantiene igual) — el cambio es puramente de cómo el servidor interpreta y registra esa misma entrada.
- No se tocan `QualityEventAuditTrail`, `IncidenteAuditTrail` ni `NoConformidadAuditTrail` — son tablas y entidades independientes; compartir el string `"ESTADO_CAMBIADO"` con ellas es solo una coincidencia de nomenclatura, no un acoplamiento real. `QEFechaDerivadaResolver.cs` (dashboard) filtra sobre `QualityEventAuditTrail`, tabla distinta — no se ve afectado.

## Decisions

**D1 — Reemplazo de acción, no acción adicional.** Cuando la transición es un rechazo o una cancelación, la única entrada que se escribe usa directamente `RECHAZADO_EN_REVISION` / `RECHAZADO_EN_APROBACION` / `REVISION_CANCELADA` — nunca se agrega una segunda entrada `ESTADO_CAMBIADO` en paralelo. Esto preserva el invariante "una transición = una entrada" que ya tiene el handler, y evita que `EstadoAnterior`/`EstadoNuevo` se dupliquen entre dos filas.

**D2 — `Motivo` como columna propia, nunca reutilizar `ValorAnterior`.** Alternativa descartada: dejar `ValorAnterior` y solo renombrar `Accion` — se evaluó porque es un cambio menor, pero el propio diagnóstico de Toño señala que el log seguiría siendo semánticamente incorrecto (un campo pensado para `CAMPO_EDITADO` sirviendo un propósito distinto), y no resuelve el caso de migración limpia a futuro si `CAMPO_EDITADO` necesitara convivir en el mismo registro.

**D3 — Migración de datos en la misma migración EF, por `EstadoAnterior`/presencia de motivo, nunca por fecha.** Para cada `ESTADO_CAMBIADO` histórico con `EstadoNuevo = 'BORRADOR'`:
- `EstadoAnterior = 'EN_REVISION'` AND `ValorAnterior IS NOT NULL` → `RECHAZADO_EN_REVISION`, mover `ValorAnterior` a `Motivo`, limpiar `ValorAnterior`.
- `EstadoAnterior = 'EN_APROBACION'` → `RECHAZADO_EN_APROBACION`, mismo traslado (el handler actual siempre pone `esRechazo = true` en este caso, así que `ValorAnterior` siempre debería tener algo, pero el script tolera `NULL`).
- `EstadoAnterior = 'EN_REVISION'` AND `ValorAnterior IS NULL` → `REVISION_CANCELADA`.
- Cualquier otra fila (`ESTADO_CAMBIADO` con otro `EstadoNuevo`, u otra acción) no se toca.

**D4 — Notificación: extracto embebido en `Mensaje`, sin columna nueva en `Notificacion`.** `Notificacion.Mensaje` es `text` sin límite de longitud en Postgres (confirmado en `ShacDbContextModelSnapshot.cs`), así que no hay restricción de esquema que obligue a truncar — se trunca a 120 caracteres por legibilidad en la lista de notificaciones, no por límite de columna. El texto completo solo vive en `DocumentoAuditTrail.Motivo`, consultado vía el detalle del documento. Esto requiere agregar `Motivo` (o el `string? motivo`) a `DocumentoRechazoNotificacion` (`IDocumentoNotificationSender.cs`) y pasarlo desde `CambiarEstadoDocumentoHandler` donde hoy solo se pasa `(empresaId, documento.Id, documento.Codigo, documento.AutorId, actorId)`.

**D5 — El aviso en el detalle vive en `DocumentDetailHeader`, como un banner contextual más.** `DocumentDetailHeader` ya tiene el requirement "DocumentDetailHeader contextual banners" (`document-detail`), con el mismo patrón exacto que necesitamos: banner condicional sobre el estado/audit trail del documento (OBSOLETO, QE-vinculados, RESTRINGIDO). Se agrega un cuarto banner siguiendo ese patrón en vez de inventar un contenedor nuevo en `DocumentDetailPage`: se muestra cuando `documento.estado === 'BORRADOR'` y la entrada de `auditTrail` con el `timestamp` más reciente entre `RECHAZADO_EN_REVISION`/`RECHAZADO_EN_APROBACION`/`REVISION_CANCELADA` es un rechazo (no una cancelación). Se deriva de `auditTrail` ya cargado — sin `useEffect`, sin fetch adicional (consistente con RN de arquitectura del proyecto).

## Divergencia encontrada entre spec y código real

`openspec/specs/document-msw-handlers/spec.md` solo documenta un handler `POST /api/documents/:id/status` con body `{ nuevoEstado, firma }` — nomenclatura que no coincide con el código real. El frontend (`documents.api.ts:79`) y el `DocumentRejectModal`/resto del panel de acciones (`document-approval-flow`) usan exclusivamente `PATCH /api/documents/:id/status` con `{ estado, motivo, notificarAutor }` (`documents.handlers.ts:638`); el handler `POST` sigue existiendo en el código (`documents.handlers.ts:446`) pero no tiene ningún consumidor real en `features/documents` — quedó de una versión anterior al cutover y nunca se actualizó su spec. Por eso este change agrega un requirement **nuevo** (`ADDED`, no `MODIFIED`) para el handler PATCH en `document-msw-handlers`, en vez de editar el requirement POST existente — no se toca esa staleness preexistente porque está fuera del alcance de este change; queda documentada aquí para que una futura limpieza la retome.

## Risks / Trade-offs

- [Riesgo] La migración de datos reclasifica filas históricas con una heurística (`EstadoAnterior` + presencia de motivo) que asume que el handler nunca tuvo un bug donde un rechazo real quedara sin motivo o viceversa → Mitigación: el script es de solo lectura/clasificación sobre filas ya cerradas (nunca se inventa un motivo), y `design.md` registrará el conteo real de filas migradas en este entorno para que cualquier caso raro sea auditable después.
- [Riesgo] Cualquier código que compare `Accion == "ESTADO_CAMBIADO"` para contar rechazos de documentos deja de contarlos tras este change → Mitigación: búsqueda confirmada — no existe tal consumidor hoy (`QEFechaDerivadaResolver.cs` opera sobre `QualityEventAuditTrail`, tabla distinta; no hay KPI de documentos basado en audit trail en el backend actual). `DocumentVersionesTab.getPublisher` (frontend) solo filtra `estadoNuevo === 'PUBLICADO'`, no se ve afectado.
- [Trade-off] Se elige no agregar motivo opcional a `REVISION_CANCELADA` ahora, aunque el modelo ya lo soportaría (columna nullable) — para no inflar el alcance de este change sin un requirement de producto que lo pida.

## Migration Plan

1. Migración EF `AddMotivoDocumentoAuditTrail` (o nombre equivalente): agrega columna `motivo` (`text`, nullable) a `documento_audit_trail`, y en el mismo `Up()` ejecuta el UPDATE de reclasificación de D3 (SQL crudo via `migrationBuilder.Sql(...)`, como ya es el patrón en migraciones de datos previas del proyecto).
2. `Down()` revierte: todo lo que no sea `ESTADO_CAMBIADO` entre las tres acciones nuevas vuelve a `ESTADO_CAMBIADO` moviendo `Motivo` de regreso a `ValorAnterior`, y se elimina la columna.
3. Backend: `dotnet build`, luego detener la API, `dotnet ef database update`, y recién ahí levantar la API de nuevo (orden exigido por el proposal — nunca migrar con la API corriendo).
4. Verificación manual con MSW apagado (los 4 pasos del proposal) antes de avisar "listo".

**Resultado real de la migración (entorno local, 2026-10-06):** `RECHAZADO_EN_REVISION`: 33 filas; `REVISION_CANCELADA`: 5 filas; `RECHAZADO_EN_APROBACION`: 0 filas (el dataset local no tenía rechazos históricos en `EN_APROBACION` todavía).

## Open Questions

- Ninguna pendiente de decisión humana — Toño ya resolvió D1 (acciones propias + columna `motivo` + migración) en la instrucción original.
