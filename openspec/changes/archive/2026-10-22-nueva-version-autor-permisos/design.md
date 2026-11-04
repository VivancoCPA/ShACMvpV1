## Context

Confirmado leyendo el código real (2026-10-07):

- `NuevaVersionDocumentoHandler.cs:49-51` — `AutorId = origen.AutorId`, `RevisorId = origen.RevisorId`, `AprobadorId = origen.AprobadorId`: copia los tres actores sin cambios.
- `NuevaVersionDocumentoEndpoint.cs:14` — solo `.RequireAuthorization()`, sin gate de rol ni de autoría.
- `DocumentPermissionResolver.ResolveDocRole` (`DocumentPermissionResolver.cs:46-53`) — precedencia `AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD (rol global) → OPERARIO`. En `BORRADOR`, `REVISOR`/`APROBADOR` solo tienen `CanRead` (`GetBasePermissions`, líneas 74-82); `CambiarEstadoDocumentoHandler.cs:44-47` exige `CanEdit` para `BORRADOR → EN_REVISION` y lanza `ForbiddenBusinessException` (403) si no lo tiene.
- `DocumentActionPanel.tsx:136-152` — `isJefeCalidad` es un flag de rol global (`user.rol === 'JEFE_CALIDAD_SYST' || 'JEFE_CONTROL_DOCUMENTARIO'`), sin considerar si ese mismo usuario es el revisor/aprobador asignado de ESTE documento. `canSendToReview`, `canDelete`, `canCancelReview` y `canStartPeriodic` lo usan directo.
- `DocumentDetailPage.tsx:101-111` ya resuelve `docRole` con la precedencia correcta (duplicado inline, no exportado) — es la referencia a seguir, no a reinventar.
- `DocumentoAsignacionService.GetCandidatosAsync(empresaId, tipo, autorId, ct)` (`DocumentoAsignacionService.cs:15-36`) ya excluye `autorId` y filtra por activo + rol elegible + asignación activa en la empresa — exactamente la regla que necesita la herencia condicionada de D1.
- `CambiarEstadoDocumentoHandler.cs:44-47` no valida en ningún punto que `RevisorId`/`AprobadorId` estén asignados antes de `BORRADOR → EN_REVISION`.
- MSW (`documents.handlers.ts`): el handler `PATCH /:id/status` no aplica ningún gate de permiso (ni 403 ni field-validation) — más permisivo que el backend real, divergencia ya existente independiente de este bug. El handler `nueva-version` (líneas 955-969) también copia `revisorId`/`aprobadorId` del origen vía `...doc` spread, sin excluir al nuevo actor ni revalidar elegibilidad.

## Goals / Non-Goals

**Goals:**
- Crear una nueva versión como autor nunca produce un 403 al enviarla a revisión por culpa de una asignación heredada incorrecta.
- El permiso para crear una nueva versión y para enviarla a revisión queda explícito y consistente entre backend, frontend y MSW.
- `DocumentActionPanel` nunca muestra un botón que el backend va a rechazar.

**Non-Goals:**
- No se cambia el orden de precedencia de `ResolveDocRole`/`getDocRoleForUser` — sigue siendo `AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD`. Un JCA/JCD que es revisor o aprobador de un `BORRADOR` ajeno sigue sin poder enviarlo a revisión (ver Decisiones, D4).
- No se valida revisor/aprobador en la creación (`POST /api/documents`) ni edición (`PUT /:id`) más allá de lo que ya hace `documentos-revisor-aprobador-reales` — solo se añade la validación nueva en la transición `BORRADOR → EN_REVISION`.
- No se tocan `DocumentFormPage.tsx` (su `docRole` simplificado para edición, `AUTOR`/`JEFE_CALIDAD`/`OPERARIO`, no aplica a este bug porque REVISOR/APROBADOR nunca llegan a ese formulario en `BORRADOR`) ni `DocumentListRow.tsx`.

## Decisions

**D1 — Autor de la nueva versión = quien la crea; herencia condicionada (ya decidido por Toño, no se reabre).**
`RevisorId`/`AprobadorId` se heredan del origen solo si: (a) son distintos del nuevo `actorId`, y (b) siguen siendo candidatos válidos para ese nuevo autor. Se reutiliza `DocumentoAsignacionService.GetCandidatosAsync(empresaId, tipo, actorId, ct)` — como ya excluye `autorId` de la lista, el caso "el heredado es el nuevo autor" queda cubierto gratis por la misma consulta, sin lógica adicional. Se agrega un método liviano `EsCandidatoValidoAsync(empresaId, tipo, actorId, candidatoId, ct)` que reutiliza la misma query con un filtro adicional por id, en vez de traer la lista completa solo para un `.Any()`.

**D2 — Permiso de creación de nueva versión: regla simple, no la matriz de `docRole`.**
`POST /:id/nueva-version` exige `actorId == origen.AutorId || actorRolGlobal ∈ {JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO}`. No se resuelve `docRole` para esta decisión (no hay un "REVISOR de un documento PUBLICADO que no sea también JCA/JCD" relevante aquí, y el documento de doc ya especifica esta regla explícita). Mismo criterio exacto que ya usa el frontend en `canCreateVersion`/`canStartNewVersion` (`isAutor || isJefeCalidad`) — por eso esos dos flags del panel NO cambian en este fix, ya estaban alineados.

**D3 — Validación de asignación al enviar a revisión: `FieldValidationException`, no una regla nueva de `DocumentoAsignacionService`.**
Se valida directo en `CambiarEstadoDocumentoHandler` (`documento.RevisorId is null || documento.AprobadorId is null` en la rama `BORRADOR → EN_REVISION`), antes de evaluar permisos de `docRole` — un documento sin revisor/aprobador nunca debería llegar a "no tenés permiso", sino a "asigná revisor y aprobador primero". Aplica a todo documento (no solo a nuevas versiones), porque la causa (campo vacío) es la misma sin importar cómo llegó a estar vacío.

**D4 — `ResolveDocRole` no cambia (explícito, no implícito).**
Con D1, el caso típico reportado por Toño queda resuelto porque quien crea la versión pasa a ser `AUTOR`, que tiene la máxima precedencia. Pero un JCA/JCD que YA era revisor/aprobador de un `BORRADOR` creado por otra persona sigue resolviendo a `REVISOR`/`APROBADOR` (solo lectura) — comportamiento esperado y pre-existente, no un efecto secundario de este fix. `DocumentActionPanel` debe reflejar esto ocultando/deshabilitando el botón, no limitarse a "arreglar" el caso de nueva versión.

**D5 — Resolver de `docRole` compartido en frontend: extraer, no reinventar.**
Se exporta `resolveDocRoleForUser(documento, user)` desde `features/documents/permissions.ts`, con la misma precedencia ya implementada inline en `DocumentDetailPage.tsx:101-111`. `DocumentDetailPage` pasa a importar esta función en vez de su copia inline; `DocumentActionPanel` la adopta para derivar `canSendToReview`, `canDelete`, `canCancelReview`, `canStartPeriodic` vía `getDocumentPermissions(estado, docRole, ctx).{canEdit,canDelete,canStartReview}` — reutilizando la matriz que YA existe en `permissions.ts`, sin matriz paralela. `canApproveReview`/`canRejectReview`/`canSign`/`canRejectAprobacion` NO cambian: ya usan `isRevisor`/`isAprobador` directo, que coincide con `docRole === 'REVISOR'/'APROBADOR'` por construcción (ambos se calculan contra el mismo `revisorId`/`aprobadorId` del documento). `canCreateVersion`/`canStartNewVersion` tampoco cambian (ver D2).

**D6 — Aviso de asignación faltante: banner + tooltip, no bloqueo silencioso.**
En el detalle de un `BORRADOR` sin `revisorId` o sin `aprobadorId`, se agrega un banner (mismo patrón que los `detail.banners.*` existentes — obsoleto, restringido, rechazos) con enlace a `/documents/:id/edit`. El botón "Enviar a revisión" se deshabilita con un `title` (tooltip) explicando el motivo — mismo patrón ya usado para `otraVersionEnProceso` en "Crear nueva versión".

## Risks / Trade-offs

- [Riesgo] Documentos `BORRADOR` ya existentes en la base (de antes de este fix) sin revisor/aprobador quedan bloqueados para enviar a revisión hasta que alguien los edite y asigne ambos campos. → Mitigación: es el comportamiento correcto buscado por D3 (nunca debieron poder avanzar sin aprobador asignado); el banner con enlace a "Editar" hace el siguiente paso obvio, no es un callejón sin salida.
- [Riesgo] `EsCandidatoValidoAsync` nuevo en `DocumentoAsignacionService` duplica parcialmente la query de `GetCandidatosAsync` si no se factoriza bien. → Mitigación: ambos métodos comparten la misma `CommandDefinition` base vía un helper privado; se verifica en code review que no hay dos SQL distintos para la misma regla.
- [Riesgo] Cambiar `canSendToReview`/`canDelete`/`canCancelReview`/`canStartPeriodic` a depender de `getDocumentPermissions` podría exponer otras divergencias frontend/backend no relacionadas con este bug (la matriz de `permissions.ts` podría tener su propio drift). → Mitigación: se corre la suite completa de tests de `DocumentActionPanel` y se compara manualmente contra `DocumentPermissionResolver.GetBasePermissions` línea por línea antes de aplicar (ya hecho en este `design.md`, ambas matrices son idénticas hoy).

## Migration Plan

Sin migración de datos. Los documentos `BORRADOR` existentes sin revisor/aprobador simplemente no pueden avanzar a `EN_REVISION` hasta ser editados — comportamiento nuevo pero no destructivo (no se les cambia estado ni se pierde información). Rollback: revertir el commit.
