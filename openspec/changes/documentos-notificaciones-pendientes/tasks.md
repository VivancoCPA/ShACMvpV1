## 1. Backend — Notificaciones en transiciones (H1)

- [x] 1.1 Agregar `DocumentoTransicionNotificacion` y `NotificarTransicionAsync` a `IDocumentoNotificationSender`/`DocumentoNotificationSender` (design.md D1), reutilizando `NotificacionTipo.ASIGNACION`/`CAMBIO_ESTADO`.
- [x] 1.2 `CambiarEstadoDocumentoHandler`: disparar notificación en `BORRADOR → EN_REVISION` (revisor), `EN_REVISION → EN_APROBACION` (aprobador), `EN_REVISION → BORRADOR` sin `motivo` (autor + revisor), `PUBLICADO → EN_REVISION_PERIODICA` (autor) — cada una en `try/catch`, después de `SaveChangesAsync`, excluyendo al actor y a destinatarios nulos.
- [x] 1.3 `FirmarPublicarDocumentoHandler`: inyectar `IDocumentoNotificationSender` y notificar `CAMBIO_ESTADO` a autor y revisor al publicar, con las mismas reglas (best-effort, sin auto-notificación).
- [x] 1.4 `NuevaVersionDocumentoHandler`: inyectar `IDocumentoNotificationSender` y notificar `ASIGNACION` al revisor/aprobador heredados de la nueva versión.
- [x] 1.5 Ajustar el texto de `NotificarAsignacionAsync` en `DocumentoNotificationSender.cs` para que diga que la persona fue designada y será notificada de nuevo en su turno (design.md D3) — sin cambiar la firma del método.
- [x] 1.6 Tests unitarios/integración backend: una por cada transición de la tabla H1 (destinatario correcto, tipo correcto), + actor nunca se notifica a sí mismo, + destinatario nulo no notifica nada, + falla del sender no revierte la transición (mock de `IDocumentoNotificationSender` que lanza excepción).

## 2. Backend — Pendientes (H2)

- [x] 2.1 Reescribir `DocumentoSqlHelpers.BuildPendientesClause` para que no reciba — o ignore — el rol salvo para la rama `EN_REVISION_PERIODICA` (design.md D4): BORRADOR propio, EN_REVISION por `revisor_id`, EN_APROBACION por `aprobador_id`, EN_REVISION_PERIODICA solo por rol JCA/JCD.
- [x] 2.2 `ContarPendientesHandler`: eliminar `NonPendingRoles` y su corte temprano; agregar `DocumentoSqlHelpers.ConfidencialidadClause` (mismos parámetros que `ListarDocumentosHandler`) al `WHERE` del conteo (design.md D5).
- [x] 2.3 Verificar que `ListarDocumentosHandler` (`pendientes=true`) sigue aplicando la nueva cláusula sin cambios adicionales — ajustar si la firma de `BuildPendientesClause` cambia.
- [x] 2.4 Tests backend: autor ve su BORRADOR; AUDITOR_INTERNO revisor ve su EN_REVISION; ALTA_DIRECCION aprobadora ve su EN_APROBACION; JCA que no es el revisor no ve un EN_REVISION ajeno; JCA y JCD ven EN_REVISION_PERIODICA; el contador coincide con `GET /api/documents?pendientes=true`; no se cuentan documentos de otra empresa, eliminados, ni ocultos por confidencialidad.

## 3. Backend — Restaurar (H3)

- [x] 3.1 `RestaurarDocumentoEndpoint.Map`: agregar `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.JEFE_CALIDAD_SYST), nameof(UserRole.ALTA_DIRECCION)))` (design.md D6), mismo patrón que `Features/Zonas`/`Features/Areas`/`Features/Locales`.
- [x] 3.2 Tests backend: JCA → 200; DIR → 200; JCD, OPERARIO, AUTOR (sin rol habilitado) → 403; documento de otra empresa → 404 (verificar que el 404 de empresa-scoping precede al 403 de rol, o documentar el orden real).

## 4. MSW — Espejo de los tres cambios

- [x] 4.1 `documents.handlers.ts`: agregar las mismas notificaciones (vía `createAsignacionNotification`/`createCambioEstadoNotification`) en el handler `PATCH /api/documents/:id/status` para enviar a revisión, aprobar revisión, cancelar revisión, iniciar revisión periódica; en `POST /api/documents/:id/sign` al publicar; en `POST /api/documents/:id/nueva-version` al heredar revisor/aprobador (el mock descartaba `revisorId`/`aprobadorId` en la nueva versión — divergía del backend real; corregido para heredarlos).
- [x] 4.2 Reescribir `filterPendientes` con la misma regla de asignación (design.md D4); eliminar `NON_PENDING_ROLES` de `GET /api/documents/pendientes/count` y aplicar el mismo filtro de confidencialidad que ya usa `GET /api/documents`.
- [x] 4.3 `PATCH /api/documents/:id/restaurar`: verificar `getSessionUser()?.rol` contra `{JEFE_CALIDAD_SYST, ALTA_DIRECCION}` antes de mutar, devolviendo 403 (mismo shape que otros 403 del módulo) en caso contrario.
- [x] 4.4 Actualizar/crear tests de `documents.handlers.test.ts` para los tres cambios (notificaciones nuevas, pendientes reescrito, restaurar con rol).

## 5. Frontend — Visibilidad de "pendientes"

- [x] 5.1 `DocumentListFilters.tsx`: quitar o expandir `CAN_SEE_PENDIENTES` para que el filtro "Mis pendientes" sea visible a los 6 roles del módulo (design.md D7).
- [x] 5.2 `Sidebar.tsx`: quitar o expandir `PENDIENTES_BADGE_ROLES` con el mismo criterio.
- [x] 5.3 Ajustar/añadir tests de `DocumentListFilters` y `Sidebar.test.tsx` que verifiquen visibilidad para `AUDITOR_INTERNO`, `ALTA_DIRECCION` y `OPERARIO`.
- [x] 5.4 Revisar textos i18n si el ajuste del punto 1.5 introduce una clave nueva (`documents:form.*` o namespace que corresponda) en `es-PE.json` y `en-US.json`. **Resultado: no aplica.** El mensaje de notificación (backend y MSW) es texto plano en español generado en el servidor (`Notificacion.mensaje` / `mensaje` de `createAsignacionNotification`), el mismo patrón que ya usaban `NotificarAsignacionAsync`/`NotificarRechazoAsync` antes de este change — `NotificationList.tsx` lo renderiza directo (`{notificacion.mensaje}`), sin pasar por `t()`. No hay clave i18n nueva que agregar.

## 6. Verificación final

- [x] 6.1 Confirmar que `/documentos/{id}` (ruta real del router) es el link usado por todas las notificaciones nuevas — no se requiere corrección de ruteo (ya verificado contra `router/index.tsx`).
- [x] 6.2 Confirmar que ninguna de estas notificaciones agrega una llamada SignalR — siguen llegando solo por polling de 60s (`notifications-realtime-hub` sin cambios). Verificado: ni `DocumentoNotificationSender` ni los handlers MSW tocados importan `IHubContext`/`NotificationsHub`; el spec de `notifications-realtime-hub` solo empuja `SEVERIDAD_CRITICA`/`CIERRE`.
- [x] 6.3 Suite completa del frontend (`npm test` o equivalente en `shc-controldoc`). 178 archivos / 1419 passed (1 expected-fail preexistente, no relacionado).
- [x] 6.4 Tests del backend (`dotnet test`). 514/514 passed, 0 errores.
- [x] 6.5 `tsc` sin errores en el frontend. **Nota:** `npx tsc -b` reporta 1 error preexistente en `src/features/incidents/components/IncidentForm.tsx:377` (tipo `evidencias: File[] | IncidentEvidencia[]`), ajeno al módulo Documentos y a este change — confirmado comparando con `git stash` que ya existía antes de empezar (trabajo en curso de otro change, `IncidentForm`/M3). Ningún archivo tocado por este change genera error de `tsc`.
- [x] 6.6 Detener el backend y ejecutar `dotnet build` antes de la prueba manual. No había ningún backend corriendo en esta sesión; `dotnet build` de `ShcMvpEndPoint.csproj` y `ShcMvpEndPoint.Tests.csproj` → 0 advertencias, 0 errores en ambos.
- [ ] 6.7 Prueba manual con `VITE_ENABLE_MSW=false` y el backend real corriendo: tres sesiones (autor, revisor, aprobador) recorriendo PRC-CD-013 (o un documento nuevo) hasta `PUBLICADO`, verificando notificación en campana + aparición en pendientes del responsable en cada paso. Luego probar un rechazo y una cancelación de revisión.
- [ ] 6.8 Avisar "listo" para que se actualice `SHAC-Mapa-Proceso-Control-Documentario.md` con "quién recibe aviso" en cada paso (fuera de este change — lo hace Cowork releyendo el código real).
