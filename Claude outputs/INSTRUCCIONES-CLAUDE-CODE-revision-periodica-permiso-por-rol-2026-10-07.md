# Instrucciones para Claude Code — Revisión periódica: el permiso debe depender del rol, no de la participación en el documento

Fecha: 2026-10-07
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño tiene un documento con la fecha de revisión vencida y no encuentra cómo iniciar su revisión periódica.
Change sugerido: `revision-periodica-permiso-por-rol`. Es **urgente**: hoy puede quedar un documento vencido sin que nadie pueda revisarlo. Hazlo **antes** de `revision-periodica-fecha-editable` y de `revision-periodica-trazabilidad`, que tocan el mismo flujo.

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

- En PUBLICADO, el permiso `canStartReview` solo existe para el docRole **JEFE_CALIDAD**. Así está en `DocumentPermissionResolver.GetBasePermissions` del backend y en `permissions.ts` del frontend.
- El docRole se resuelve con la precedencia **AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD** (`ResolveDocRole` / `resolveDocRoleForUser`). Si un JCA o JCD fue autor, revisor o aprobador del documento, deja de ser JEFE_CALIDAD para ese documento, y en PUBLICADO esos roles tienen solo lectura (AUTOR ni siquiera eso).
- Desde `nueva-version-autor-permisos`, el frontend usa esa misma precedencia en `DocumentActionPanel` (`canStartPeriodic = PUBLICADO && perms.canStartReview`) y en `DocumentListRow` (icono ↻ "Iniciar revisión"). Los botones aparecen **solo** para un Jefe que no participó en el documento.
- Consecuencia: el JCD suele ser aprobador y el JCA autor o revisor. En una empresa con pocos Jefes, **nadie** puede iniciar la revisión periódica de ese documento. Es el caso de Toño.
- Además, en el mismo flujo:
  - `ConfirmarRevisionPeriodicaHandler` (`PATCH /:id/confirmar-revision`) **no valida ningún permiso**: cualquier usuario autenticado de la empresa puede confirmar la vigencia.
  - `EN_REVISION_PERIODICA → BORRADOR` (`CanCancelReview`) también depende del docRole JEFE_CALIDAD.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-07): las acciones de revisión periódica se autorizan por rol global, siempre.** Cualquier `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO` de la empresa activa puede iniciar la revisión periódica, confirmar la vigencia sin cambios y cancelar la revisión periódica, **aunque haya sido autor, revisor o aprobador del documento**. Se descartaron "por rol más el autor" y "por rol excepto el aprobador".

Fundamento: la revisión periódica es una función del sistema de gestión de calidad sobre el documento vigente, no una etapa del ciclo de aprobación de esa versión. La segregación autor ≠ revisor ≠ aprobador se mantiene donde corresponde: en la aprobación de cada versión.

---

## Qué implementar

### Backend
1. **No cambies `ResolveDocRole`** ni la matriz por docRole de las etapas de aprobación: siguen siendo la fuente de verdad del ciclo BORRADOR → PUBLICADO.
2. Define en un solo lugar la regla de revisión periódica, por ejemplo `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(UserRole actorRolGlobal)` = JCA o JCD. Úsala en:
   - `CambiarEstadoDocumentoHandler`, transición `PUBLICADO → EN_REVISION_PERIODICA`, en lugar de `permisos.CanStartReview`;
   - `CambiarEstadoDocumentoHandler`, transición `EN_REVISION_PERIODICA → BORRADOR`, en lugar de `permisos.CanCancelReview`;
   - `ConfirmarRevisionPeriodicaHandler`, que hoy no valida nada. Un usuario sin el rol recibe **403**; un documento de otra empresa, 404 como siempre.
3. Con la regla anterior, los flags `CanStartReview` y `CanCancelReview` que devuelve el backend deben reflejar la regla por rol. Revisa si alguna respuesta del backend expone esos flags y alinéala.
4. **Crear nueva versión** ya se autoriza por "autor o JCA/JCD" desde `nueva-version-autor-permisos`. Confirma que no se haya visto afectada.

### Frontend
1. Agrega a `permissions.ts` la misma regla por rol, por ejemplo `canManagePeriodicReview(userRol)`, y úsala en:
   - `DocumentActionPanel`: `canStartPeriodic`, la cancelación de la revisión periódica y el modal de confirmación;
   - `DocumentListRow`: icono ↻ "Iniciar revisión";
   - el botón "Iniciar revisión periódica" del aviso del detalle, si `revision-periodica-trazabilidad` ya se implementó o cuando se implemente.
2. Mantén `resolveDocRoleForUser` y la matriz para las demás acciones.
3. MSW: replica la regla en los handlers de cambio de estado y de `confirmar-revision`.

## Tests
- Backend:
  - un JCD que fue **aprobador** del documento inicia la revisión periódica → 200;
  - un JCA que fue **autor** inicia → 200;
  - un SUPERVISOR o un OPERARIO → 403;
  - `confirmar-revision` con OPERARIO → 403 (hoy pasa);
  - un JCA que fue revisor confirma la vigencia → 200;
  - cancelar la revisión periódica con un JCD que participó → 200.
- Frontend: el panel y la fila de la lista muestran "Iniciar revisión" a un JCA/JCD aunque haya participado en el documento, y no se lo muestran a otros roles.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado: con el documento vencido de Toño, entra como el JCD o JCA que fue aprobador o autor. Debe aparecer "Iniciar revisión", y se debe poder iniciar y confirmar la vigencia o crear una nueva versión.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso.
