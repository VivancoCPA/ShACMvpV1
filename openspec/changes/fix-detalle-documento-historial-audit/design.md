## Context

`DocumentHistorial.tsx:23` ejecuta `documento.historialVersiones.map(...)`. `types/documents.types.ts` declara `Documento.historialVersiones: VersionEntry[]` como obligatorio. La entidad real `Documento.cs` (confirmado leyendo el archivo completo) no tiene ese campo: el modelo de versiones real es una cadena de filas `Documento` independientes, cada una con su propio `Codigo` (compartido) y `VersionAnteriorId` apuntando a la fila anterior. El campo nunca viaja en `GET /api/documents/:id`, así que `.map()` sobre `undefined` tumba el detalle de cualquier documento real. El handler MSW sí lo envía (`historialVersiones: []` o con datos), por eso nunca se detectó contra mocks.

Al corregir esto se encontró un segundo problema, no reportado originalmente: `ObtenerDocumentoHandler` arma `Documento` con Dapper (`SELECT {DocumentoSqlHelpers.SelectColumns} FROM documentos WHERE id = @Id`) y solo completa a mano `QeVinculados`/`NcVinculados` — nunca consulta `documento_audit_trail`. `Documento.AuditTrail` (con default `= []` en la entidad) queda siempre vacío. No crashea (el frontend ya maneja `[]` sin problema en `DocumentAuditTrail.tsx`), pero **falla en silencio**: el panel de Audit Trail se ve "sin entradas" con datos reales en la tabla, `DocumentHistorial` nunca puede mostrar la creación, y `DocumentVersionesTab.getPublisher()` nunca encuentra quién publicó.

## Goals / Non-Goals

**Goals:**
- Que el detalle de cualquier documento real no crashee.
- Que el audit trail grabado de verdad se pueda ver: en el detalle, y en la pestaña Versiones (quién publicó).
- Dejar el contrato TS `Documento`/`AuditTrailEntry` alineado con lo que el backend real puede enviar, para no repetir este patrón.

**Non-Goals:**
- Que el backend reconstruya `historialVersiones` recorriendo la cadena `VersionAnteriorId` (descartado por Toño, D1: duplicaría lo que ya resuelve `DocumentVersionesTab`).
- Restringir el audit trail por rol (queda como pregunta abierta, ver Riesgos).
- Corregir los demás campos del contrato que el barrido encontró sin backend real (`fechaObsolescencia`, `archivoUrl`, `tipoArchivo`, `hashArchivo`) salvo que rompan o se vean mal — se listan, no se tocan en este change.

## Decisions

**D1 — Corregir en el frontend y poblar el audit trail real (decidido por Toño, 2026-09-30).**
Se elimina `historialVersiones`/`VersionEntry` del contrato. `DocumentHistorial` ("Historial de estados") se reconstruye desde `documento.auditTrail`: `DOCUMENTO_CREADO`, `ESTADO_CAMBIADO` (con la transición), `FIRMA_REGISTRADA`, y si aporta, `NUEVA_VERSION_INICIADA`/`RESTAURADO`. Descartada: que el backend arme `historialVersiones` recorriendo `VersionAnteriorId` — es información que ya expone `DocumentVersionesTab` vía `GET /api/documents?codigo=`, y mantenerla en dos lugares los desincroniza.

**D2 — Divergencia respecto al pedido original: el listado filtrado por `codigo` SÍ lleva audit trail.**
El pedido dice textualmente "No agregues el audit trail a `ListarDocumentosHandler`... mismo criterio que `QeVinculados` y `NcVinculados`". Leyendo el código real: `DocumentVersionesTab.getPublisher()` (línea 24-32) busca `FIRMA_REGISTRADA`/`ESTADO_CAMBIADO→PUBLICADO` dentro de `doc.auditTrail` de **cada versión**, y esas versiones se obtienen exclusivamente de `useDocumentVersiones(codigo)` → `GET /api/documents?codigo=` → `ListarDocumentosHandler`. Si ese handler nunca puebla `auditTrail` (ninguna excepción), "quién publicó" en la pestaña Versiones queda permanentemente vacío — lo cual contradice el propio checklist de prueba manual de este pedido ("comprobar que... la pestaña Versiones (con quién publicó) muestren datos reales").

Interpretación aplicada: la preocupación de N+1 es sobre un **listado paginado arbitrario** (cientos de documentos de distintos códigos); una consulta filtrada por `codigo` está acotada a las versiones de un único documento (típicamente 1-5 filas). Se puebla el audit trail únicamente en ese caso (`query.Codigo is not null`), dejando el listado general sin filtrar exactamente como se pidió. Si Toño prefiere la lectura literal (nunca poblarlo en `ListarDocumentosHandler`, aceptando que "quién publicó" quede sin resolver), es un `if` menos en `ListarDocumentosHandler` — revertir es trivial.

**D3 — Helper compartido de carga de audit trail.** Nuevo `DocumentoAuditTrailLoader` (o método estático) en `Features/Documentos/Shared/`, con una función que reciba uno o varios `documentoId` y devuelva un diccionario `Guid -> List<DocumentoAuditTrail>`, para que `ObtenerDocumentoHandler` (un id) y `ListarDocumentosHandler` (varios ids, solo cuando `Codigo` está presente) compartan la misma consulta SQL y el mismo mapeo de columnas.

Columnas reales confirmadas en `ShacDbContextModelSnapshot.cs` (tabla `documento_audit_trail`): `id`, `documento_id`, `accion`, `estado_anterior`, `estado_nuevo`, `campo_modificado`, `valor_anterior`, `valor_nuevo`, `realizado_por_id`, `realizado_por_nombre`, `timestamp`, `generado_por_ia`. No hay `entidad_tipo`, `entidad_id` ni `ip_origen`.

**D4 — `AuditTrailEntry.entidadTipo`/`entidadId`/`ipOrigen` pasan a opcionales** (no se eliminan): no existen en `DocumentoAuditTrail.cs` y el backend no los va a inventar. Se dejan opcionales en vez de eliminarlos para no forzar una edición mecánica de las ~30 fixtures de MSW que ya los incluyen (siguen siendo válidos ahí, solo dejan de ser obligatorios). Confirmado que ningún componente de producción los lee (`grep` en `features/documents` solo los encontró en un test).

## Barrido — contrato `Documento` TS vs. lo que el backend real envía

Comparado campo por campo contra `DocumentoSqlHelpers.SelectColumns` (usado tanto por `ObtenerDocumentoHandler` como por `ListarDocumentosHandler`) más lo poblado a mano (`QeVinculados`, `NcVinculados`, y ahora `AuditTrail`).

| Campo TS | ¿Backend lo envía? | ¿Algún componente lo usa? | Efecto real | Acción |
|---|---|---|---|---|
| `historialVersiones` | No — no existe en la entidad | `DocumentHistorial.tsx:23` | **Crash** (`.map()` sobre `undefined`) | Corregido en este change (D1) |
| `auditTrail` | No, hasta este change (`[]` siempre) | `DocumentAuditTrail.tsx`, `DocumentHistorial.tsx`, `DocumentVersionesTab.tsx` (`getPublisher`) | Sin crash, pero vacío en silencio | Corregido en este change (D2/D3) |
| `deletedAt` | Sí (`deleted_at` está en `SelectColumns`) | Listados de eliminados/restaurar | Correcto | Sin cambios |
| `fechaObsolescencia` | No — no existe en la entidad ni en el SELECT | `DocumentVersionesTab.tsx:153`, `DocumentVersionSubRow.tsx:34` (anotación "obsoleto el `<fecha>`") | Se muestra mal: esa anotación nunca aparece en una versión `OBSOLETO`, aunque el chequeo `documento.fechaObsolescencia &&` no crashea | **No corregido** — hallazgo para Toño (¿de dónde sale esa fecha? ¿`ActualizadoEn` de la fila al pasar a `OBSOLETO`, o un audit trail entry?) |
| `archivoUrl` | No — no existe en la entidad ni en el SELECT | `DocumentActionPanel.tsx:132-133` (`canVerArchivo`, `canExportarPdf`), `DocumentDetailPage.tsx:155-156` (bloque de info de archivo) | Se muestra mal: "Ver archivo"/"Exportar PDF" y el bloque de info de archivo nunca aparecen contra el backend real, incluso en `PUBLICADO` | **No corregido** — parece un campo legado de antes de `archivoOriginalUrl`/`archivoDistribucionUrl` (SHAC-PRD-003-ADD-02); decidir a cuál de los dos debería apuntar es una decisión de producto, no un simple `?? null`. Hallazgo para Toño |
| `tipoArchivo` | No — no existe en la entidad ni en el SELECT | `DocumentDetailPage.tsx:156` (junto con `archivoUrl`) | Mismo efecto que `archivoUrl` | **No corregido** — mismo hallazgo |
| `hashArchivo` | No — no existe en la entidad ni en el SELECT | Ningún componente de producción (solo en `VersionEntry`, que se elimina, y en fixtures/tests) | Ninguno tras eliminar `VersionEntry` | Se elimina junto con `VersionEntry` si queda huérfano; si algo más lo usa, se deja como hallazgo |

## Riesgos / Trade-offs

- **Pregunta abierta para Toño (no resuelta en este change):** ¿un `OPERARIO` que lee un documento `PUBLICADO` debería ver en el audit trail quién lo descargó/visualizó? Hoy (y con este fix) el audit trail completo se entrega a cualquiera que pueda leer el detalle, igual que el mock. Si la respuesta es "no", hace falta filtrar por acción y rol en `ObtenerDocumentoHandler`, un cambio aparte.
- **D2 es una interpretación, no lo literal del pedido.** Documentado arriba con el razonamiento; revertir a la lectura literal es trivial pero deja "quién publicó" permanentemente vacío en la pestaña Versiones, contradiciendo el propio checklist de prueba manual del pedido.
- Los cuatro campos del barrido que quedan sin corregir (`fechaObsolescencia`, `archivoUrl`, `tipoArchivo` con su UI oculta, y el hallazgo de a qué deberían apuntar) siguen ocultando funcionalidad contra el backend real. No es nuevo (ya estaba así), pero ahora está confirmado y documentado en vez de ser una sospecha.
