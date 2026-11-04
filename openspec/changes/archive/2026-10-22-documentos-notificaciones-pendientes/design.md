## Context

`Features/Documentos/Shared/DocumentoNotificationSender.cs` (implementa `IDocumentoNotificationSender`) hoy solo tiene dos métodos:

- `NotificarAsignacionAsync` — llamado desde `CrearDocumentoHandler` y `EditarDocumentoHandler` cuando `RevisorId`/`AprobadorId` es nuevo o cambió, siempre que el asignado no sea el propio actor. Mensaje actual: "Se te asignó a una revisión/aprobación del documento {codigo}."
- `NotificarRechazoAsync` — llamado desde `CambiarEstadoDocumentoHandler` solo en la rama `esRechazo && command.NotificarAutor` (el flag viene del checkbox de `DocumentRejectModal.tsx`, default `true`, el usuario lo puede desmarcar).

Ninguna otra transición dispara notificación: `CambiarEstadoDocumentoHandler` (enviar a revisión, aprobar revisión, cancelar revisión, rechazar sin motivo/cancelar) y `FirmarPublicarDocumentoHandler` (publicar) no reciben `IDocumentoNotificationSender` como dependencia hoy salvo el primero (ya inyectado, solo usado para rechazo). `NuevaVersionDocumentoHandler` no lo inyecta.

`DocumentoSqlHelpers.BuildPendientesClause(UserRole rol)` (usado por `ListarDocumentosHandler` vía `pendientes=true` y por `ContarPendientesHandler`) decide qué documentos son "pendientes" mirando el **rol global** del actor, con reglas anteriores a D1 de `documentos-revisor-aprobador-reales` (revisor ∈ JCA/JCD/AUD/DIR, aprobador ∈ JCD/DIR):

```csharp
if (rol == UserRole.SUPERVISOR) clauses.Add("(estado = 'EN_REVISION' AND revisor_id = @ActorId)");
if (rol is not (OPERARIO or AUDITOR_INTERNO or ALTA_DIRECCION)) clauses.Add("(estado = 'EN_APROBACION' AND aprobador_id = @ActorId)");
if (rol == JEFE_CALIDAD_SYST) clauses.Add("estado IN ('EN_REVISION', 'EN_REVISION_PERIODICA')");
if (rol == JEFE_CONTROL_DOCUMENTARIO) clauses.Add("estado = 'EN_REVISION_PERIODICA'");
```

`ContarPendientesHandler` además corta antes con `NonPendingRoles = {OPERARIO, AUDITOR_INTERNO, ALTA_DIRECCION}` → `return 0` sin consultar, y no aplica `DocumentoSqlHelpers.ConfidencialidadClause` (que `ListarDocumentosHandler` sí aplica siempre, incluido en modo `pendientes=true`).

`RestaurarDocumentoEndpoint.Map` solo tiene `.RequireAuthorization()` — sin `RequireRole`. El resto del backend (`Features/Zonas/*`, `Features/Areas/*`, `Features/Locales/*`, `Features/Empresas/*`) usa consistentemente `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.X), nameof(UserRole.Y)))` para este tipo de restricción — es el patrón a replicar, no uno nuevo.

En el frontend, `DocumentListFilters.tsx` (`CAN_SEE_PENDIENTES`) y `Sidebar.tsx` (`PENDIENTES_BADGE_ROLES`) ocultan el filtro/badge de pendientes para todo rol fuera de `{SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO}` — ninguno de los dos está documentado en `document-list-view`/`app-navigation` hoy (drift spec/código ya existente antes de este change, no introducido por él).

El router ya expone `/documentos/:id` (ruta canónica; `/documents` solo redirige) — el link `/documentos/{documentoId}` que ya usan `NotificarAsignacionAsync`/`NotificarRechazoAsync` es correcto y no requiere corrección.

## Goals / Non-Goals

**Goals:**
- Notificar al responsable correcto en cada transición real de un documento, con mensajes claros en español.
- Que "pendientes" (badge + filtro) dependa exclusivamente de la asignación real del actor, salvo el único caso que estructuralmente no tiene asignado individual (`EN_REVISION_PERIODICA`).
- Que el contador y el listado filtrado (`pendientes=true`) apliquen exactamente las mismas condiciones (incluida confidencialidad), para que nunca diverjan.
- Cerrar el backend de `Restaurar` al mismo criterio de rol que ya aplica el frontend.

**Non-Goals:**
- No se toca el mecanismo de tiempo real (`notifications-realtime-hub`): estas notificaciones siguen siendo solo-polling (60s), no SignalR. Solo `SEVERIDAD_CRITICA`/`CIERRE` usan push.
- No se agregan valores a `NotificacionTipo` — se reutilizan `ASIGNACION` (le toca actuar) y `CAMBIO_ESTADO` (informativo).
- No se cambia el comportamiento del flag `notificarAutor` en rechazo — queda igual, con la recomendación de Cowork anotada como pregunta abierta.
- No se toca la lógica de incidentes (`RN-INC-006`) ni ningún otro dominio — es el mismo patrón `try/catch` + `IDocumentoNotificationSender`, pero exclusivo de documentos.

## Decisions

### D1 — Un método genérico de transición, no uno por caso
`IDocumentoNotificationSender` gana un tercer método genérico en vez de 6 métodos específicos (uno por fila de la tabla H1 del change), porque los 6 casos comparten forma exacta (mismo `EntidadTipo: DOCUMENTO`, mismo `Link`, difieren solo en destinatario(s), `Tipo` y texto):

```csharp
public sealed record DocumentoTransicionNotificacion(
    Guid EmpresaId, Guid DocumentoId, string Codigo, Guid DestinatarioId, NotificacionTipo Tipo, string Mensaje);

Task NotificarTransicionAsync(DocumentoTransicionNotificacion notificacion, CancellationToken ct);
```

El call site arma el mensaje (texto fijo en español, sin i18n en backend — mismo patrón que los dos métodos existentes) y decide destinatario(s), filtrando siempre `!= actorId` antes de llamar. Para transiciones con más de un destinatario (p.ej. publicar → autor + revisor), el call site llama el método una vez por destinatario — igual que `CrearDocumentoHandler` ya hace con revisor/aprobador.

**Alternativa descartada:** un método por transición (`NotificarEnvioRevisionAsync`, `NotificarAprobacionAsync`, etc.). Más explícito pero 6 métodos casi idénticos solo para variar el mensaje; el genérico reduce superficie y es consistente con que el mensaje ya es texto libre armado en el handler en los 2 métodos existentes.

### D2 — Tabla transición → destinatario(s) → tipo → mensaje

| Transición | Handler | Destinatario(s) | `Tipo` | Mensaje (plantilla) |
|---|---|---|---|---|
| `BORRADOR → EN_REVISION` | `CambiarEstadoDocumentoHandler` | `RevisorId` | `ASIGNACION` | "{codigo} está listo para tu revisión." |
| `EN_REVISION → EN_APROBACION` | `CambiarEstadoDocumentoHandler` | `AprobadorId` | `ASIGNACION` | "{codigo} está listo para tu aprobación." |
| `EN_REVISION → BORRADOR` (sin motivo, cancelar) | `CambiarEstadoDocumentoHandler` | `AutorId`, `RevisorId` | `CAMBIO_ESTADO` | "Se canceló la revisión de {codigo}; vuelve a BORRADOR." |
| `EN_APROBACION → BORRADOR` (rechazo) | `CambiarEstadoDocumentoHandler` | `AutorId` (ya cubierto por `NotificarRechazoAsync`, sin cambios) | `CAMBIO_ESTADO` | (sin cambios) |
| `EN_APROBACION → PUBLICADO` | `FirmarPublicarDocumentoHandler` | `AutorId`, `RevisorId` | `CAMBIO_ESTADO` | "{codigo} fue publicado ({version})." |
| `PUBLICADO → EN_REVISION_PERIODICA` | `CambiarEstadoDocumentoHandler` | `AutorId` | `CAMBIO_ESTADO` | "{codigo} entró en revisión periódica; te toca iniciar la nueva versión." |
| Nueva versión creada | `NuevaVersionDocumentoHandler` | `RevisorId`, `AprobadorId` heredados | `ASIGNACION` | "Fuiste designado para la revisión/aprobación de la nueva versión de {codigo} ({version})." |

Todas usan `Link = $"/documentos/{documentoId}"` (del documento involucrado — en nueva versión, el `Id` del documento **nuevo**, no el origen).

### D3 — Ajuste del mensaje de designación al crear/editar
`NotificarAsignacionAsync` (ya existente, sin cambio de firma) cambia su texto de "Se te asignó a una revisión/aprobación del documento {codigo}." a algo como "Fuiste designado revisor/aprobador de {codigo}; te avisaremos cuando sea tu turno." — evita que el destinatario entre a un documento en BORRADOR donde no puede hacer nada todavía. No se distingue revisor/aprobador en el texto hoy (el método no recibe ese dato); se mantiene así por consistencia con el código existente, salvo que se prefiera agregar un campo `Rol` al record — **decisión menor, implementar con el texto genérico primero y ajustar en code review si se pide distinguir**.

### D4 — Reescritura de `BuildPendientesClause` (ya no depende del rol global, salvo un caso)
```csharp
public static string BuildPendientesClause() => """
    (
        (estado = 'BORRADOR' AND autor_id = @ActorId)
        OR (estado = 'EN_REVISION' AND revisor_id = @ActorId)
        OR (estado = 'EN_APROBACION' AND aprobador_id = @ActorId)
        OR (estado = 'EN_REVISION_PERIODICA' AND @ActorRolNombre IN ('JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO'))
    )
    """;
```
Deja de tomar `UserRole rol` como único insumo relevante para las 3 primeras ramas (ahora dependen de `@ActorId` contra la fila, no del rol) y siempre retorna una cláusula no nula — el `pendientesClause ?? "1 = 0"` de `ListarDocumentosHandler` y el `if (pendientesClause is null) return 0;` de `ContarPendientesHandler` quedan como código muerto pero se dejan (no rompen nada; simplificarlos es opcional, ver tasks.md).

### D5 — Confidencialidad también en el contador
`ContarPendientesHandler` pasa a construir el mismo SQL que el bloque `pendientes=true` de `ListarDocumentosHandler`: agrega `DocumentoSqlHelpers.ConfidencialidadClause` al `WHERE`, con los mismos parámetros (`@ActorRolNombre`, `@ActorEsConfidencialRole` resuelto vía `DocumentPermissionResolver.CanAccessByConfidencialidad`). Elimina `NonPendingRoles` y su corte temprano por completo — ya no hay un conjunto de roles sin bandeja, el filtro de asignación hace ese trabajo.

### D6 — Restaurar: mismo patrón `RequireRole` que el resto del backend
```csharp
app.MapPatch("/api/documents/{id:guid}/restaurar", Handle)
   .RequireAuthorization(p => p.RequireRole(nameof(UserRole.JEFE_CALIDAD_SYST), nameof(UserRole.ALTA_DIRECCION)))
   ...
```
Sin cambios en `RestaurarDocumentoHandler` (la lógica de negocio no depende de rol, solo el gate del endpoint). MSW: el handler `PATCH /api/documents/:id/restaurar` agrega una verificación de `getSessionUser().rol` contra el mismo set antes de mutar, respondiendo 403 (mismo shape de error que otros 403 de documentos) en caso contrario.

### D7 — Frontend: expandir el gate de "pendientes" a todos los roles con acceso al módulo
`CAN_SEE_PENDIENTES`/`PENDIENTES_BADGE_ROLES` pasan de un `Set` de 3 roles a derivarse de "cualquier rol con acceso al módulo Documentos" (los 6 roles operativos, igual que ya filtra el router / `ROUTE_ROLE_GROUPS.documentsView`) — no se intenta calcular en el cliente si el usuario *realmente* tiene algo pendiente antes de pedirlo (eso ya lo resuelve `useDocumentosPendientesCount`; el filtro/badge simplemente no debe estar oculto a priori). Alternativa descartada: computar elegibilidad en frontend replicando D4 — duplicaría la regla de negocio en dos capas; más simple es asumir "todos pueden tener pendientes" y dejar que el contador en 0 sea la señal.

## Risks / Trade-offs

- [Riesgo] Duplicar notificaciones si dos ramas de una misma transición califican a la vez (p.ej. publicar notifica a autor y revisor por separado) → Mitigación: cada llamada es por destinatario individual con guard `!= actorId`; no hay posibilidad de que el mismo destinatario reciba dos filas para la misma transición porque cada handler llama el método una vez por persona fija.
- [Riesgo] Cambiar `BuildPendientesClause` puede alterar qué ve cada usuario de forma visible e inmediata (badge/filtro) → Mitigación: la tabla de equivalencia (D4) está explícitamente acordada con Toño (D1 del pasted doc) y los tests nuevos cubren cada rama antes/después.
- [Riesgo] `ContarPendientesHandler` deja de tener su atajo rápido (`NonPendingRoles` → `return 0` sin tocar la BD) → Mitigación: el costo real es una query indexada por `empresa_id`/`estado`/`autor_id`/`revisor_id`/`aprobador_id` — ya se ejecuta igual para el resto de roles, no hay escalamiento nuevo.
- [Riesgo] Notificación best-effort que falla silenciosamente deja al responsable sin aviso, pero el documento igual avanza de estado → Mitigación: ya es el comportamiento aceptado del resto del sistema (design.md de otros dominios, D7); el badge de pendientes sigue siendo la red de seguridad aunque la notificación puntual falle.

## Migration Plan

No hay migración de datos (no cambia el esquema de `documentos` ni de `notificaciones`). Orden sugerido de implementación (ver tasks.md): (1) backend notificaciones, (2) backend pendientes, (3) backend restaurar, (4) MSW espejo de los tres, (5) frontend (gates de rol), (6) prueba manual con `VITE_ENABLE_MSW=false` y backend real corriendo, con tres sesiones (autor/revisor/aprobador) recorriendo PRC-CD-013 completo.

## Open Questions

1. **Divergencia Matriz RACI M1 vs. decisión D2 del pasted doc**: la tabla de `SHAC-M1-Matriz-Responsabilidades-v1.0.docx` marca también a `JEFE_CONTROL_DOCUMENTARIO` como autorizado a restaurar, pero su nota aclaratoria dice "Solo JCA y DIR". Se implementa lo que ya hace el código real (`DocumentActionPanel.tsx`): `JEFE_CALIDAD_SYST` + `ALTA_DIRECCION`, sin agregar `JEFE_CONTROL_DOCUMENTARIO`. Pendiente que Toño confirme si la matriz oficial debe corregirse.
2. **Flag `notificarAutor` en rechazo**: Cowork recomienda que el autor se entere siempre de un rechazo (su documento vuelve a `BORRADOR` y le toca corregir), sin depender del checkbox de `DocumentRejectModal.tsx`. Este change **no** lo cambia — requiere decidir si se quita el checkbox del formulario o se deja como aviso opcional adicional.
3. **Texto distinto para "designado como revisor" vs. "designado como aprobador"**: D3 propone un texto genérico sin distinguir el rol asignado; si se prefiere distinguir, requiere agregar un campo al record existente (cambio menor, no bloqueante).
