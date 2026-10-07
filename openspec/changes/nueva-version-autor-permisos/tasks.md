## 1. Backend — DocumentoAsignacionService

- [x] 1.1 Agregar `EsCandidatoValidoAsync(empresaId, tipo, actorId, candidatoId, ct)` en `DocumentoAsignacionService`, factorizando la query de `GetCandidatosAsync` (mismo filtro: activo, rol elegible, asignación activa, excluyendo `actorId`) con un filtro adicional por `candidatoId`, sin duplicar el SQL.

## 2. Backend — NuevaVersionDocumentoHandler

- [x] 2.1 `AutorId = actorId` en vez de `origen.AutorId`.
- [x] 2.2 `RevisorId`/`AprobadorId`: heredar del origen solo si `!= actorId` y `EsCandidatoValidoAsync` confirma que siguen siendo elegibles para `actorId`; si no, `null`.
- [x] 2.3 Ajustar el loop de notificaciones de asignación para que solo notifique los campos efectivamente heredados (ya itera sobre `nuevaVersion.RevisorId`/`AprobadorId`, que ahora pueden ser `null` — confirmar que el `continue` por `null` ya cubre esto). Confirmado, sin cambios necesarios.

## 3. Backend — NuevaVersionDocumentoEndpoint

- [x] 3.1 Antes de llamar al handler (o al inicio del handler), verificar `actorId == origen.AutorId || actorRolGlobal ∈ {JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO}`; si no, `ForbiddenBusinessException` (403), sin crear nada. Implementado al inicio del handler (ya tenía `origen` cargado); el endpoint ahora resuelve y pasa `actorRolGlobal`.

## 4. Backend — CambiarEstadoDocumentoHandler

- [x] 4.1 En la rama `(DocStatus.BORRADOR, DocStatus.EN_REVISION)`, antes de evaluar `permisos.CanEdit`, validar que `documento.RevisorId` y `documento.AprobadorId` no sean `null`; si falta alguno, lanzar `FieldValidationException` con el campo correspondiente (`revisorId`/`aprobadorId`), sin tocar el estado.

## 5. Backend — Tests de integración

- [x] 5.1 Nueva versión creada por un JCD que era revisor del original → `AutorId = JCD` y `RevisorId = null`.
- [x] 5.2 Nueva versión creada por el autor original → hereda `revisorId`/`aprobadorId` sin cambios.
- [x] 5.3 Revisor/aprobador heredado inactivo o sin rol elegible → queda `null`.
- [x] 5.4 Un usuario sin permiso (no autor, no JCA/JCD) intenta `POST /:id/nueva-version` → `403`, no se crea documento.
- [x] 5.5 `PATCH /:id/status` a `EN_REVISION` sin `revisorId` → `400` con error de campo `revisorId`, documento permanece en `BORRADOR`.
- [x] 5.6 Mismo caso sin `aprobadorId` → `400` con error de campo `aprobadorId`.
- [x] 5.7 Un JCA/JCD que es revisor de un `BORRADOR` ajeno (con revisor/aprobador ya asignados) intenta `PATCH /:id/status` a `EN_REVISION` → `403` (comportamiento documentado en design.md D4, no roto por este fix).
- [x] (extra) Tests existentes que creaban `BORRADOR`→`EN_REVISION` sin revisor/aprobador (`DocumentosStateMachineEndpointTests`, `DocumentosAuditTrailEndpointTests`, `DocumentosNotificationFailureTests`, `DocumentosTransicionNotificacionesTests`) actualizados para asignar ambos campos, o reescritos para reflejar el nuevo comportamiento (400 en vez del 200 silencioso anterior).

## 6. Frontend — resolver de docRole compartido

- [x] 6.1 Exportar `resolveDocRoleForUser(documento, user)` desde `features/documents/permissions.ts`, con la precedencia `AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO` (misma lógica ya inline en `DocumentDetailPage.tsx`).
- [x] 6.2 `DocumentDetailPage.tsx`: reemplazar el bloque inline de resolución de `docRole` por una llamada a `resolveDocRoleForUser`.

## 7. Frontend — DocumentActionPanel

- [x] 7.1 Calcular `docRole = resolveDocRoleForUser(documento, user)` y `perms = getDocumentPermissions(documento.estado, docRole, { isAssignedAuthor: docRole === 'AUTOR' })`.
- [x] 7.2 `canSendToReview = documento.estado === 'BORRADOR' && perms.canEdit`.
- [x] 7.3 `canDelete = documento.estado === 'BORRADOR' && perms.canDelete`.
- [x] 7.4 `canCancelReview = documento.estado === 'EN_REVISION' && perms.canEdit`.
- [x] 7.5 `canStartPeriodic = documento.estado === 'PUBLICADO' && perms.canStartReview`.
- [x] 7.6 Confirmar que `canApproveReview`/`canRejectReview`/`canSign`/`canRejectAprobacion`/`canCreateVersion`/`canStartNewVersion` no necesitan cambios (ya usan `isRevisor`/`isAprobador`/`isAutor`/`isJefeCalidad` directo, consistente con `docRole` por construcción — ver design.md D2/D5).
- [x] 7.7 Si `documento.estado === 'BORRADOR'` y falta `revisorId` o `aprobadorId`: mostrar banner con enlace a `/documents/:id/edit`, y deshabilitar "Enviar a revisión" con `title` explicando el motivo. El banner se implementó en `DocumentDetailHeader.tsx` (no en `DocumentActionPanel.tsx`) — es donde ya viven todos los demás banners de este patrón (obsoleto, restringido, rechazos); el botón deshabilitado sí vive en `DocumentActionPanel.tsx`.

## 8. Frontend — DocumentNuevaVersionModal / useCreateNuevaVersion

- [x] 8.1 En `useCreateNuevaVersion.onSuccess`: si `newDoc.revisorId == null || newDoc.aprobadorId == null`, mostrar un toast distinto (`nuevaVersion.toast.faltaAsignacion`) y navegar a `/documents/${newDoc.id}/edit` en vez de `/documentos/${newDoc.id}`.

## 9. Frontend — i18n

- [x] 9.1 Agregar claves en `es-PE.json`/`en-US.json`: `documents:detail.banners.faltaAsignacion` (+ `faltaAsignacionEditar`), `documents:detail.actions.sendToReviewDisabledTooltip`, `documents:nuevaVersion.toast.faltaAsignacion`.

## 10. MSW

- [x] 10.1 Handler `POST /documents/:id/nueva-version`: `autorId` = actor de la request (no `doc.autorId`); `revisorId`/`aprobadorId` heredados solo si `!= actorId` y siguen siendo candidatos elegibles (reusar el mismo filtro que ya usa el handler de `candidatos-asignacion` — factorizado en `esCandidatoAsignacionValido`, reusado también en el propio handler de `candidatos-asignacion`).
- [x] 10.2 Mismo handler: rechazar con `403` si el actor no es `doc.autorId` ni tiene rol `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`.
- [x] 10.3 Handler `PATCH /documents/:id/status`: en la transición `BORRADOR → EN_REVISION`, validar `revisorId`/`aprobadorId` presentes; si falta alguno, responder `400` con el campo faltante (nuevo helper `fieldErr`, mismo contrato `errors: ["campo: mensaje"]` que el backend real).

## 11. Frontend — Tests

- [x] 11.1 `permissions.test.ts`: `resolveDocRoleForUser` con los casos de precedencia (autor, revisor, aprobador, jefe calidad sin asignación, jefe calidad que SÍ es revisor/aprobador de este documento, operario, sin usuario).
- [x] 11.2 `DocumentActionPanel.test.tsx`: un JCA/JCD que es revisor/aprobador de un `BORRADOR` ajeno no ve "Enviar a revisión"/"Eliminar"; uno que no tiene relación con el documento sí los ve.
- [x] 11.3 `DocumentActionPanel.test.tsx`: botón "Enviar a revisión" deshabilitado cuando falta revisor o aprobador en `BORRADOR`, habilitado cuando ambos están asignados.
- [x] 11.4 `documents.handlers.test.ts`: nueva-version vía MSW asigna autor correcto, hereda condicionalmente (revisor ya no elegible queda vacío, aprobador elegible se mantiene) y rechaza sin permiso (403); `PATCH /status` a `EN_REVISION` sin `revisorId`/`aprobadorId` responde `400` con el campo faltante.

## 12. Verificación

- [x] 12.1 Correr la suite completa del frontend (vitest) en `shc-controldoc`. 183 archivos / 1481 tests OK (1 expected fail preexistente, no relacionado).
- [x] 12.2 Correr los tests del backend (`dotnet test`) en `ShcMvpEndPoint`. 540/540 OK.
- [x] 12.3 Correr `tsc --noEmit` en `shc-controldoc`. Sin errores.
- [x] 12.4 Detener el backend en ejecución y correr `dotnet build` antes de la prueba manual. Hecho (con tu confirmación anterior).
- [ ] 12.5 Prueba manual con MSW apagado: tomar un documento `PUBLICADO` cuyo revisor sea un JCD; entrar como ese JCD y crear una nueva versión → el JCD queda como autor, el revisor queda vacío, aparece el aviso.
- [ ] 12.6 Asignar otro revisor y enviar a revisión → funciona.
- [ ] 12.7 Repetir creando la versión con el autor original → hereda todo y se puede enviar directamente.
- [ ] 12.8 Recorrer el flujo hasta publicar → la versión anterior pasa a `OBSOLETO`.

## 13. Cierre

- [ ] 13.1 Avisar "listo" para verificación de causa raíz releyendo el código real.
