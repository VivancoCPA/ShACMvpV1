# Instrucciones para Claude Code — Cutover: Notificaciones

Fecha: 2026-09-22
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Toño preguntó específicamente por el estado de Notificaciones tras cerrarse
Dashboard — resulta que es un noveno módulo pendiente, con la misma situación que tenía Dashboard
antes de hoy.

**No le preguntes a Toño si conviene hacer este cutover — ya lo pidió.**

## Contexto — mismo patrón que tenía Dashboard: backend ya verificado, contrato de red nunca verificado

El backend de Notificaciones (`Features/Notifications/*`, change `be-notificaciones`) ya fue
implementado y verificado independientemente por Cowork el 2026-08-21/25
(`SHAC-Verificacion-Notificaciones-2026-08-25.md`, guardado en el Project) y **ya está archivado**
en `openspec/changes/archive/2026-08-25-be-notificaciones/` — a diferencia de Dashboard, este sí
se archivó. Esa verificación confirmó que el backend implementa correctamente el sistema de
notificaciones (idempotencia de vencimientos, scoping por empresa, `BackgroundService` real,
conexión de `ASIGNACION` a los 3 módulos con reasignación de AC), no que el frontend real conecta
bien contra él.

**No existe ningún `openspec/changes/cutover-notificaciones/`** — a diferencia de los ocho módulos
de dominio, Notificaciones nunca tuvo su propio ciclo de cutover. No es que se haya olvidado
archivarlo — simplemente nunca se abrió el change. Este es el noveno y verdadero último pendiente
del roadmap de cutover.

## 1. El contrato coincide en su mayor parte — confirmado por lectura

- `GET /api/notifications` ↔ `getNotifications()` (`notifications.api.ts`) ↔ `ListarNotificacionesEndpoint`/`ListarNotificacionesHandler`:
  coincide. Sin restricción de rol — cualquier usuario autenticado con empresa activa ve las
  suyas, filtrado por `usuarioId + empresaActivaId` (Dapper). Sin excepción para `SUPERADMIN`
  (nunca tiene `empresaActivaId`, mismo mecanismo que documenté hoy en Dashboard D3 — responde 401,
  no 403, por diseño explícito).
- `PATCH /api/notifications/:id/leida` ↔ `markNotificationRead(id)` ↔ `MarcarLeidaEndpoint`/`MarcarLeidaHandler`:
  coincide. 404 uniforme (no 403) para "no existe" y "es de otro usuario" — nunca revela que la
  notificación pertenece a otro usuario, mismo patrón ya visto en otros módulos.
- `PATCH /api/notifications/marcar-todas-leidas` ↔ `markAllNotificationsRead()` ↔ `MarcarTodasLeidasEndpoint`/`MarcarTodasLeidasHandler`:
  coincide, filtra por `usuarioId + empresaActivaId + !leida`.
- Las 3 rutas están registradas en `EndpointExtensions.cs` (líneas 244-246).
- La entidad `Notificacion` (backend, `Domain/Entities/Notificacion.cs`) coincide campo a campo con
  la interfaz `Notificacion` (frontend, `types/notification.types.ts`): `id`, `usuarioId`,
  `empresaId`, `tipo`, `entidadTipo`, `entidadId`, `entidadCodigo`, `mensaje`, `leida`, `createdAt`,
  `link`.
- `NotificacionEntidadTipo` coincide exacto en ambos lados: `QE`/`NC`/`INCIDENTE`/`DOCUMENTO`/`AC`
  (el backend real no emite `DOCUMENTO` todavía — comentario explícito en el enum, incluido "por
  paridad de contrato" — no es un mismatch, es una decisión ya documentada en `be-notificaciones`).

## 2. Hallazgo real — `NotificacionTipo` del frontend solo tiene 3 de los 7 valores reales del backend

**Esto es un mismatch de tipos real, aunque hoy no rompe nada en ejecución** — documentalo con
Decision en `design.md` antes de decidir si lo corregís.

- Backend (`Domain/Enums/NotificacionTipo.cs`): 7 valores — `CAMBIO_ESTADO`, `ASIGNACION`,
  `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`. El
  propio comentario del enum dice que los 4 últimos se agregaron a propósito (decisión de Toño, D4
  de `be-notificaciones/design.md`) para no aplanar información que el backend ya distinguía.
- Frontend (`types/notification.types.ts:3`): `export type NotificacionTipo = 'CAMBIO_ESTADO' |
  'ASIGNACION' | 'VENCIMIENTO'` — **solo 3 valores**. Nunca se actualizó cuando se agregaron los 4
  adicionales en `be-notificaciones`.
- **Por qué hoy no es un bug visible**: confirmé por grep que ningún componente del frontend hace
  switch/narrowing sobre `notificacion.tipo` — ni `NotificationBell.tsx` ni `NotificationList.tsx`
  lo leen; solo renderizan `mensaje` (string ya armado por el backend) y navegan a `link` al hacer
  clic. Así que una notificación real con `tipo: "CIERRE"` llega, se muestra y se puede marcar como
  leída sin ningún error — el campo simplemente no está tipado correctamente.
- **Por qué vale la pena corregirlo igual**: es el mismo tipo de gap silencioso que este proceso de
  cutover existe para atrapar — si mañana alguien agrega un ícono o color por `tipo` (algo natural
  para una campana de notificaciones), TypeScript no va a advertir que faltan 4 casos, porque el
  union type miente sobre lo que el backend realmente puede enviar. Es una corrección de una línea
  (`notification.types.ts:3`, agregar los 4 valores) — recomiendo aplicarla en este change, pero
  documentala como hallazgo con causa raíz igual que las otras encontradas en cutovers anteriores.

## 3. Informativo — el comentario de `useNotificationToast.ts` sobre "push entre sesiones" queda desactualizado

El hook tiene un comentario extenso explicando que los toasts solo disparan dentro de la misma
pestaña/sesión "porque no existe WebSocket/SSE en el entorno MSW" y que esto "queda resuelto recién
cuando exista un backend .NET real con push entre sesiones" — confirmé por grep que **no existe
ningún `refetchInterval` en `useNotifications.ts` ni en ninguna configuración global de
TanStack Query** en todo `shc-controldoc/src`. El backend real tampoco tiene WebSocket/SSE
(`Features/Notifications/*` son 3 endpoints REST simples, sin hub de SignalR ni Server-Sent
Events). Es decir: la limitación de "sin push entre sesiones" **no se resuelve con este cutover** —
el comentario da a entender que sí, y eso puede confundir a quien lo lea después. No es bloqueante
para cerrar este change (no es un requisito de ningún PRD que revisé), pero corregí el comentario
si lo tocás, o al menos dejá una nota en `design.md` aclarando que sigue siendo una limitación real
del producto, no del entorno MSW. Es una decisión de producto (¿vale la pena agregar
`refetchInterval` para polling, o encarar SignalR más adelante?) que le corresponde a Toño, no a
este change — documentalo como Open Question si preferís no tocar el hook.

## 4. Estrategia

1. Backend local (`dotnet run` + Postgres dev), `.env.development` con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Sin herramienta de navegador disponible en este entorno (mismo criterio que los cutovers
   anteriores) — verificá por API directa: login, `GET /api/notifications` (debería devolver `[]`
   o notificaciones reales si ya provocaste alguna desde otro módulo cutover-eado, p.ej. cerrar un
   QE debería generar una notificación real vía `IQualityEventNotificationSender`), `PATCH
   .../:id/leida`, `PATCH .../marcar-todas-leidas`.
3. Para ejercitar al menos un `tipo` de los 4 nuevos (`SEVERIDAD_CRITICA`/`CIERRE`/
   `VERIFICACION_EFICAZ`/`COMERCIO_EXTERIOR`), aprovechá que QE y NC ya están cutover-eados: cerrar
   un QE real por API debería disparar una notificación con `tipo: "CIERRE"` (o el que corresponda)
   — confirmá que `GET /api/notifications` la devuelve con el campo `tipo` real, más allá de lo que
   el tipo TypeScript (roto) permitía antes de tu fix.
4. Si corregís el enum del frontend (Sección 2), confirmá que no rompe ningún test existente
   (`useNotifications.test.ts` y los tests de `NotificationBell`/`useNotificationToast` no deberían
   depender del union type específico).
5. Revisá los tests de Notificaciones (`useNotifications.test.ts`, `useNotificationToast.test.ts`,
   `NotificationBell.test.tsx`) antes de asumir que dependen de MSW — mismo criterio que cutovers
   anteriores.
6. Revertí `.env.development` al terminar. No toques `.env.production`.

## 5. Ciclo OpenSpec

Abrí un change nuevo (`cutover-notificaciones`), no reutilices `be-notificaciones` (ya está
archivado, y este change tiene un objetivo distinto: contrato de red frontend↔backend real, no
lógica interna). Documentá el hallazgo de la Sección 2 como Decision con causa raíz (archivo +
línea) antes de corregirlo, y la Sección 3 como Open Question u observación en `design.md` si
decidís no tocar el hook. Con este módulo, quedarían cerrados los nueve módulos identificados hasta
ahora del roadmap de cutover — seguí atento a si aparece algún otro módulo transversal en la misma
situación (backend ya implementado, contrato de red nunca verificado) que Toño no haya mencionado
todavía.
