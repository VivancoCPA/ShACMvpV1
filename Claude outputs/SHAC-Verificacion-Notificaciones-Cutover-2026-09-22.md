# Verificación independiente — Cutover: Notificaciones

Fecha: 2026-09-22
Autor: Cowork, releyendo el código real (frontend `shc-controldoc`, backend `.NET`) vía device
bridge — sin confiar en el reporte de Claude Code ni en el de Toño ("listo, implementado"). Noveno
módulo del roadmap de cutover, transversal a los ocho de dominio, no anticipado originalmente.

**Veredicto: aprobado.** Los dos cambios de código propuestos en las instrucciones se aplicaron
exactamente como se pidió, y confirmé cada uno leyendo el archivo real, no solo la prosa de
`design.md`.

## 1. `openspec/changes/cutover-notificaciones/` — confirmado, sin archivar

Listé `openspec/changes/` directamente en el repo: `cutover-notificaciones` existe junto a
`cutover-dashboard`, `cutover-no-conformidades`, `cutover-quality-events` y `cutover-usuarios` —
los cinco sin archivar. Listé `openspec/changes/archive/` completo: no contiene ninguna entrada de
`cutover-notificaciones`.

## 2. El gap de `NotificacionTipo` — corregido, confirmado en el archivo real

`design.md` D1 documentaba que el frontend solo declaraba 3 de los 7 valores reales del enum
backend. Leí `shc-controldoc/src/types/notification.types.ts` directamente: el union type ahora
tiene los 7 valores (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`,
`VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`), coincide exacto con `Domain/Enums/NotificacionTipo.cs`
del backend, que no fue tocado (mismo contenido que verifiqué al escribir las instrucciones).

Además, verifiqué la afirmación de `tasks.md` 6.1-6.2 de que esto se ejercitó contra una
notificación real, no solo contra el tipo: releí `QualityEventNotificationSender.cs` —
`NotificarSeveridadCriticaAsync` construye el mensaje exacto reportado ("El Quality Event {numero}
tiene severidad CRÍTICA.") y el `link` (`/quality-events/{id}`), dirigido al rol `ALTA_DIRECCION`
vía `RolNotificationHelper.ResolverDestinatariosPorRolAsync` con el `actorId` excluido — coincide
con lo que `tasks.md` reportó haber observado por API directa (la notificación llegó a
`dash.altadireccion.qa@shac.dev` y no al propio `dash.jefecalidad.qa@shac.dev` que creó el QE).

## 3. El comentario de `useNotificationToast.ts` — corregido, confirmado en el archivo real

`design.md` D2 documentaba que el comentario original prometía que la limitación de "solo un toast
dentro de la misma pestaña" se resolvería al existir un backend real — algo fácticamente falso,
porque ese backend tampoco tiene WebSocket/SSE. Leí el archivo real: el comentario nuevo ya no
promete esa resolución — explica que el backend real son 3 endpoints REST simples sin
WebSocket/SSE/SignalR, que no hay `refetchInterval` configurado, y deja la decisión de agregar
polling o construir push real como Open Question de producto, exactamente como se pidió. Ningún
cambio de comportamiento, solo documentación — coincide con "D2: documentación, no código de
producto" del `design.md`.

## 4. Resto del contrato — sin cambios de código, verificado por lectura

Los 3 endpoints (`GET /api/notifications`, `PATCH /:id/leida`, `PATCH /marcar-todas-leidas`) y sus
handlers no fueron tocados en este cutover (mismo `mtime` de agosto que verifiqué en la
investigación previa) — coincide con lo esperado, ya que la investigación previa no había
encontrado ningún mismatch de contrato en ellos, solo el gap de tipos. No repetí las llamadas
`curl` de `tasks.md` (scoping por usuario+empresa, 401 para `SUPERADMIN`, 404 uniforme, marcar
todas como leídas) porque no tocan código — son las mismas rutas y handlers que ya había leído al
escribir las instrucciones originales, sin ninguna señal de que hayan cambiado.

## 5. `.env.development` — revertido, confirmado por lectura directa

`VITE_API_BASE_URL=` (vacío), `VITE_ENABLE_MSW=true` — estado original restaurado, coincide con
`tasks.md` 8.4. `.env.production` no fue mencionado como tocado y no había razón para tocarlo.

## Conclusión

Con Notificaciones cerrado, quedan **cinco** `openspec/changes/` sin archivar como housekeeping
pendiente: `cutover-no-conformidades`, `cutover-quality-events`, `cutover-usuarios`,
`cutover-dashboard` y `cutover-notificaciones` — ninguno bloqueante, a tu criterio cuándo
archivarlos. Con esto, no queda ningún módulo (de dominio ni transversal) identificado con un gap
de cutover pendiente en este roadmap. El Open Question de hosting/dominio de producción heredado de
`cutover-auth` sigue siendo el único punto abierto de toda la serie — y ahora se suma el nuevo Open
Question de si vale la pena agregar `refetchInterval` o construir push real (SignalR/SSE) para
notificaciones entre sesiones, una decisión de producto tuya, no técnica.
