## Context

`DocumentPermissionResolver` (backend, `Features/Documentos/Shared/DocumentPermissionResolver.cs`) y `permissions.ts` (frontend, carácter por carácter idéntico) resuelven un `docRole` por documento (`AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO`, precedencia fija) y de ahí una matriz de 9 flags por `(estado, docRole)`. En `PUBLICADO`, solo `docRole JEFE_CALIDAD` tiene `canStartReview`; en `EN_REVISION_PERIODICA`, solo `docRole JEFE_CALIDAD` tiene `canCancelReview`. Como un `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` que fue autor/revisor/aprobador de ESE documento resuelve a `docRole AUTOR/REVISOR/APROBADOR` (no `JEFE_CALIDAD`), pierde el permiso — en una empresa con pocos Jefes esto puede dejar un documento sin nadie habilitado para iniciar su revisión periódica. `ConfirmarRevisionPeriodicaHandler` (`PATCH /:id/confirmar-revision`) no valida ningún permiso hoy — ninguna matriz, ningún rol.

Esta matriz por `docRole` es correcta y SHALL seguir siendo la fuente de verdad para el ciclo de aprobación de una versión (enviar a revisión, aprobar, rechazar, firmar) — ahí la segregación autor ≠ revisor ≠ aprobador tiene sentido. El problema es específico de las 3 acciones de revisión periódica, que no son una etapa de ESE ciclo de aprobación sino una función del sistema de gestión de calidad sobre el documento ya vigente.

## Goals / Non-Goals

**Goals:**
- Las 3 acciones de revisión periódica (iniciar, confirmar vigencia sin cambios, cancelar) se autorizan por rol global (`JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`), sin importar el `docRole` del actor sobre ese documento.
- Una sola función por capa (backend / frontend / MSW) calcula la regla — ningún call site repite `rol === 'JEFE_CALIDAD_SYST' || rol === 'JEFE_CONTROL_DOCUMENTARIO'` inline para esta decisión.
- `ConfirmarRevisionPeriodicaHandler` y su handler MSW ganan su primer gate de permiso.

**Non-Goals:**
- No se toca `ResolveDocRole`/`resolveDocRoleForUser` ni la matriz `GetBasePermissions`/`getBasePermissions` por `(estado, docRole)` — siguen siendo la fuente de verdad del ciclo BORRADOR → PUBLICADO.
- No se agrega una acción de UI nueva para "cancelar revisión periódica" (`EN_REVISION_PERIODICA → BORRADOR`) — hoy esa transición no tiene botón en `DocumentActionPanel` (ni lo tenía antes de este change); solo se corrige el gate de permiso en backend/MSW para cuando se invoque (y se deja preparado el helper de frontend para cuando se agregue la UI).
- No cambia el contrato de API: `DocumentPermissions`/`CanStartReview`/`CanCancelReview` son un tipo interno de cada handler, nunca se serializan al cliente (confirmado en `ObtenerDocumentoHandler`).

## Decisions

**D1 — Autorización por rol global, siempre (decidido por Toño, 2026-10-07).** Cualquier `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO` de la empresa activa puede iniciar la revisión periódica, confirmar la vigencia y cancelar la revisión periódica, aunque haya sido autor, revisor o aprobador del documento. Se descartaron "por rol más el autor" y "por rol excepto el aprobador" — la revisión periódica es una función del SGC sobre el documento vigente, no una etapa de la aprobación de esa versión.

**D2 — Regla centralizada, no inline.** Backend: `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(UserRole actorRolGlobal) => actorRolGlobal is UserRole.JEFE_CALIDAD_SYST or UserRole.JEFE_CONTROL_DOCUMENTARIO`, junto al resto de `DocumentPermissionResolver` (mismo archivo, no un servicio nuevo — es una regla de una línea, no justifica una clase aparte). Frontend: `canManagePeriodicReview(userRol: UserRole): boolean` en `permissions.ts`, junto a `resolveDocRoleForUser`/`canAccessDocument`. Alternativa descartada: repetir la condición inline en cada call site (handler, MSW, 2 componentes) — ya causó el bug equivalente en otro lugar del código (`isJefeCalidad` suelto antes de `nueva-version-autor-permisos`).

**D3 — Los call sites de las 3 acciones dejan de leer `permisos.CanStartReview`/`CanCancelReview` (backend) y `perms.canStartReview`/`canCancelReview` (frontend), y leen la nueva función.** La matriz (`GetBasePermissions`/`getBasePermissions`) no se modifica — esos 2 de los 9 flags por `(estado, docRole)` siguen existiendo y sus tests (`document-permissions` spec) no cambian, pero dejan de ser el gate real de estas 3 acciones. Alternativa descartada: eliminar `canStartReview`/`canCancelReview` de la matriz — habría sido un cambio de tipo más grande (9 → 7 flags) sin beneficio funcional, y estos flags siguen siendo útiles como documentación de la intención original de la matriz por `docRole`.

**D4 — `ConfirmarRevisionPeriodicaHandler` necesita `actorRolGlobal`, que hoy no recibe.** `ConfirmarRevisionPeriodicaEndpoint.Handle` debe resolverlo igual que `CambiarEstadoDocumentoEndpoint` (`Enum.Parse<UserRole>(user.GetRolEfectivo() ?? nameof(UserRole.OPERARIO))`) y pasarlo al handler. Orden de validación en el handler: 404 (empresa) → 403 (rol) → 409 (estado inválido) → 422 (fecha fuera de margen) — el 403 va antes que el 409 porque un actor sin el rol no debería poder distinguir por el código de error si el documento está o no en un estado válido para la acción.

**D5 — `DocumentListRow` ya es accidentalmente consistente con D1.** Hoy aproxima el `docRole` solo desde el rol global (`userRoleToDocRole`, sin conocer `autorId`/`revisorId`/`aprobadorId` del documento ni el id del usuario actual) — por lo que el icono ↻ ya se muestra a cualquier `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` sin importar participación. Se reemplaza igual por `canManagePeriodicReview(userRole)` explícito, para que la corrección quede documentada como regla intencional y no como un efecto colateral de una simplificación no relacionada (si en el futuro `DocumentListRow` empieza a recibir el id del usuario y a resolver `docRole` real para otros flags, no debe arrastrar por accidente el bug que este change corrige).

## Risks / Trade-offs

- [Riesgo] Dejar `canStartReview`/`canCancelReview` en la matriz sin ser el gate real de estas 3 acciones puede confundir a quien lea `permissions.ts`/`DocumentPermissionResolver.cs` sin leer también `canManagePeriodicReview` → Mitigación: comentario en la matriz (ambos archivos) señalando que estos 2 flags ya no gatean iniciar/confirmar/cancelar revisión periódica, y apuntando a la función nueva.
- [Riesgo] `ConfirmarRevisionPeriodicaHandler` gana su primer 403 — un cliente que dependía del comportamiento "cualquiera puede confirmar" (ninguno documentado, pero posible en datos de prueba/demo ya grabados) empieza a fallar → Mitigación: es el comportamiento correcto y buscado por este change; se documenta en el CHANGELOG/proposal como fix de seguridad, no como regresión.
- [Riesgo] MSW y backend real podrían desalinearse si solo se actualiza uno → Mitigación: tasks.md exige ambos, y los tests de MSW (`documents.handlers.test.ts`) cubren el mismo set de casos que los tests de backend.

## Migration Plan

No aplica migración de datos. Es un cambio de lógica de autorización puro, desplegable sin downtime. Rollback: revertir el commit: la lógica previa (matriz por `docRole`) sigue intacta y funcional en `GetBasePermissions`/`getBasePermissions`.
