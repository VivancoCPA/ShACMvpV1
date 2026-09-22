## Why

`cutover-auth`, `cutover-catalogos`, `cutover-incidentes`, `cutover-documentos`, `cutover-no-conformidades`, `cutover-quality-events`, `cutover-usuarios` y `cutover-dashboard` ya verificaron y cerraron los ocho módulos de dominio del roadmap contra el backend .NET real (los últimos cuatro siguen sin archivar, pendientes de que Toño decida cuándo). Notificaciones nunca tuvo su propio ciclo de cutover: es un módulo transversal a los ocho anteriores, no uno de ellos, así que quedó fuera del roadmap original. Su backend (`Features/Notifications/*`, change `be-notificaciones`) ya fue implementado y verificado independientemente el 2026-08-21/25 (idempotencia de vencimientos, scoping por empresa, `BackgroundService` real, conexión de `ASIGNACION` a los 3 módulos con reasignación de AC) y está archivado — lo que nunca se hizo es apuntar el frontend real contra ese backend real con MSW apagado y verificar el contrato de red extremo a extremo, mismo patrón que tenía Dashboard antes de `cutover-dashboard`.

## What Changes

- Apuntar `shc-controldoc` en desarrollo (`.env.development`, `VITE_ENABLE_MSW=false`) al backend .NET real y verificar los 3 endpoints de Notificaciones: `GET /api/notifications`, `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas` — sin tocar `.env.production`.
- Corregir `NotificacionTipo` (frontend, `types/notification.types.ts:3`) para incluir los 4 valores que el backend real ya puede emitir y el frontend no tipa (`SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`) — hoy no rompe nada en ejecución (ningún componente hace switch/narrowing sobre `tipo`), pero es un mismatch de tipos real que deja de advertir a TypeScript si mañana algo empieza a discriminar por `tipo` (un ícono o color por tipo de notificación, por ejemplo).
- Ejercitar al menos uno de los 4 tipos nuevos contra datos reales, aprovechando que QE y NC ya están cutover-eados (p.ej. cerrar un QE real debería disparar una notificación con `tipo: "CIERRE"` o el que corresponda vía `IQualityEventNotificationSender`).
- Confirmar por lectura de código (ya verificado en esta sesión, no solo heredado del handoff) que el comentario de `useNotificationToast.ts` sobre "push entre sesiones" queda desactualizado: no existe `refetchInterval` en ningún `useQuery` de Notificaciones ni configuración global de TanStack Query, y el backend real tampoco tiene WebSocket/SSE (3 endpoints REST simples, sin SignalR). La limitación de "sin push entre sesiones" no se resuelve con este cutover — se corrige el comentario para no confundir a quien lo lea después y se deja constancia en `design.md` como limitación real de producto, no del entorno MSW.
- No se anticipa ningún otro cambio de código en backend ni frontend para cerrar un mismatch de contrato — la investigación previa solo encontró el gap de tipos de la Sección 2. Cualquier discrepancia real adicional que aparezca durante la verificación se corrige con causa raíz confirmada, no se asume de antemano.
- Como en los cutovers anteriores: inspeccionar los tests de Notificaciones (`useNotifications.test.ts`, `useNotificationToast.test.ts`, `NotificationBell.test.tsx`) antes de asumir que dependen de MSW.
- Al cerrar: revertir `.env.development` a `VITE_ENABLE_MSW=true`. Con este módulo, quedan cerrados los nueve módulos identificados hasta ahora del roadmap de cutover (los ocho de dominio más este, el único transversal con esta situación conocida).

## Capabilities

### New Capabilities

- `frontend-notificaciones-cutover-verification`: escenarios de verificación manual/API para Notificaciones contra el backend .NET real + Postgres real, sin MSW — listado filtrado por usuario+empresa activa, marcar una como leída (404 uniforme para "no existe" y "es de otro usuario"), marcar todas como leídas, y al menos uno de los 4 `tipo` nuevos disparado por una mutación real de otro módulo ya cutover-eado. Equivalente de Notificaciones a `frontend-dashboard-cutover-verification`.

### Modified Capabilities

(Ninguna — no se detectó ningún requirement de contrato de `Features/Notifications/**` que necesite cambiar; el contrato de red ya coincide. El gap de tipos de `NotificacionTipo` es un defecto de tipado del frontend, no un requirement de comportamiento de la spec de backend.)

## Impact

- **Afectado (frontend)**: `shc-controldoc/.env.development` (ventana de verificación), `types/notification.types.ts` (union `NotificacionTipo` ampliada a 7 valores), comentario de `useNotificationToast.ts` (corregido para no prometer una resolución que este cutover no entrega), tests de Notificaciones que resulten depender de MSW tras inspección.
- **Afectado (backend)**: ninguno anticipado — a confirmar durante la verificación.
- **No afectado**: `notifications.api.ts`, `useNotifications.ts`, `useMarkNotificationRead.ts`/`useMarkAllNotificationsRead.ts`, `NotificationBell.tsx`/`NotificationList.tsx` (ninguno de los dos hace narrowing por `tipo`, solo renderizan `mensaje`/`link`), handlers MSW de Notificaciones (se mantienen intactos hasta que se decida apagar MSW globalmente), `Features/Notifications/*` (ya archivado en `be-notificaciones`, sin cambios de lógica interna en este change).
- **Pendiente explícito, no se resuelve en este change**: "push entre sesiones" (toast en tiempo real para notificaciones creadas por otro usuario/sesión) sigue sin resolver — el backend real no tiene WebSocket/SSE. Se documenta en `design.md` como Open Question de producto (¿agregar `refetchInterval` de polling, o encarar SignalR más adelante?), no se decide en este change.
- **Fuera de alcance**: cualquier capa transversal que dependa de MSW globalmente hasta que se decida apagarlo por completo. Como trabajo de mantenimiento futuro (no parte de este change): archivar los `openspec/changes/` pendientes (`cutover-quality-events`, `cutover-usuarios`, `cutover-dashboard`, y este) y resolver el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
