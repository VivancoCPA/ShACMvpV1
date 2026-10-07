## 1. Backend — regla centralizada

- [x] 1.1 Agregar `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(UserRole actorRolGlobal)` en `Features/Documentos/Shared/DocumentPermissionResolver.cs`: `true` solo para `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`. Comentario junto a `GetBasePermissions` señalando que `CanStartReview`/`CanCancelReview` de la matriz ya no gatean estas 3 acciones.

## 2. Backend — CambiarEstadoDocumentoHandler

- [x] 2.1 En el `switch` de `CambiarEstadoDocumentoHandler.HandleAsync`, reemplazar el chequeo `if (!permisos.CanStartReview)` (caso `PUBLICADO → EN_REVISION_PERIODICA`) por `if (!DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal))`.
- [x] 2.2 Reemplazar el chequeo `if (!permisos.CanCancelReview)` (caso `EN_REVISION_PERIODICA → BORRADOR`) por la misma regla.
- [x] 2.3 Confirmar que `docRole`/`permisos` (ya calculados arriba en el método) siguen usándose sin cambios para las demás transiciones (`BORRADOR→EN_REVISION`, `EN_REVISION→EN_APROBACION`, rechazos).

## 3. Backend — ConfirmarRevisionPeriodicaHandler (nuevo gate)

- [x] 3.1 `ConfirmarRevisionPeriodicaEndpoint.Handle`: resolver `actorRolGlobal` igual que `CambiarEstadoDocumentoEndpoint` (`Enum.Parse<UserRole>(user.GetRolEfectivo() ?? nameof(UserRole.OPERARIO))`) y pasarlo a `handler.HandleAsync`.
- [x] 3.2 `ConfirmarRevisionPeriodicaHandler.HandleAsync`: agregar parámetro `UserRole actorRolGlobal`; tras el chequeo 404 y antes del chequeo de estado (409), validar `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal)` y lanzar `ForbiddenBusinessException` (403) si falla.
- [x] 3.3 Actualizar la firma en cualquier otro caller del handler (tests incluidos).

## 4. Backend — tests

- [x] 4.1 `DocumentosStateMachineEndpointTests.cs`: agregar casos — JCD aprobador inicia revisión periódica (200), JCA autor inicia (200), SUPERVISOR/OPERARIO (403) en ambas transiciones (`PUBLICADO→EN_REVISION_PERIODICA` y `EN_REVISION_PERIODICA→BORRADOR`), JCD que participó cancela la revisión periódica (200).
- [x] 4.2 `DocumentosConfirmarRevisionPeriodicaEndpointTests.cs`: agregar casos — OPERARIO (403), JCA revisor confirma (200), SUPERVISOR (403).
- [x] 4.3 Correr la suite completa de backend (`dotnet test`). — 568/568 OK.

## 5. Frontend — permissions.ts

- [x] 5.1 Agregar `canManagePeriodicReview(userRol: UserRole): boolean` en `src/features/documents/permissions.ts`, junto a `resolveDocRoleForUser`. Comentario señalando que reemplaza `canStartReview`/`canCancelReview` como gate real de estas 3 acciones (la matriz no cambia).
- [x] 5.2 `permissions.test.ts`: agregar tests para `canManagePeriodicReview` (true para JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO, false para el resto de roles).

## 6. Frontend — DocumentActionPanel y DocumentListRow

- [x] 6.1 `DocumentActionPanel.tsx`: cambiar `canStartPeriodic = documento.estado === 'PUBLICADO' && perms.canStartReview` por `documento.estado === 'PUBLICADO' && canManagePeriodicReview(user.rol)`.
- [x] 6.2 `DocumentListRow.tsx`: cambiar el gate del icono ↻ ("Iniciar revisión") de `perms.canStartReview` a `canManagePeriodicReview(userRole)` (estado `PUBLICADO`), explícito en vez de depender de la aproximación de `userRoleToDocRole`.
- [x] 6.3 `DocumentActionPanel.test.tsx`: agregar caso — JEFE_CALIDAD_SYST que es `aprobadorId` del documento ve "Iniciar revisión periódica" en `PUBLICADO`.
- [x] 6.4 Se creó `DocumentListRow.test.tsx` (no existía): mismo caso para el icono ↻.

## 7. MSW — documents.handlers.ts

- [x] 7.1 `PATCH /api/documents/:id/status`: antes de aplicar la transición, si `(doc.estado, nuevoEstado)` es `(PUBLICADO, EN_REVISION_PERIODICA)` o `(EN_REVISION_PERIODICA, BORRADOR)`, validar que `getUserFromRequest(request)?.rol` sea `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`; si no, `err(..., 403)`.
- [x] 7.2 `PATCH /api/documents/:id/confirmar-revision`: agregar el mismo chequeo de rol (403 si no corresponde) — hoy no valida ningún permiso.
- [x] 7.3 `documents.handlers.test.ts`: agregar casos equivalentes a los del backend (sección 4) para ambos handlers. — 78/78 OK.

## 8. Verificación manual y cierre

- [x] 8.1 Correr la suite completa del frontend (`npm test` / `vitest run` en `shc-controldoc`). — 1536/1537 OK (1 expected fail preexistente, no relacionado).
- [x] 8.2 Correr `tsc` (frontend) sin errores. — limpio.
- [x] 8.3 Detener el backend y ejecutar `dotnet build` antes de la prueba manual. — backend detenido (PID 36472) y recompilado sin errores.
- [ ] 8.4 Prueba manual con MSW apagado: documento vencido de Toño, logueado como el JCD/JCA que fue aprobador o autor — debe aparecer "Iniciar revisión", y debe poder iniciarse y confirmarse la vigencia (o crearse una nueva versión).
- [ ] 8.5 Al terminar, avisar con "listo" para que Cowork verifique releyendo el código real y actualice el mapa de proceso.
