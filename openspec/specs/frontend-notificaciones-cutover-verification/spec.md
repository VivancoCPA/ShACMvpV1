# frontend-notificaciones-cutover-verification

## Purpose

Verificación manual / API directa del contrato de red completo de Notificaciones (módulo transversal a los ocho módulos de dominio) de `shc-controldoc` contra el backend .NET real + Postgres real, con `VITE_ENABLE_MSW=false`. Notificaciones nunca tuvo su propio ciclo de cutover — su backend (`Features/Notifications/*`, change `be-notificaciones`) ya fue implementado y verificado independientemente el 2026-08-21/25 y está archivado, pero nunca se apuntó el frontend real contra ese backend real con MSW apagado. Cubre el listado de `GET /api/notifications` filtrado por `usuarioId` y por la empresa activa de la sesión (incluida la excepción `SUPERADMIN` sin empresa activa → 401, no 403), marcar una notificación como leída con 404 uniforme entre "no existe" y "es de otro usuario", marcar todas como leídas, la corrección de tipos de `NotificacionTipo` (frontend) para incluir los 7 valores reales que el backend puede emitir (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`), y la reversión de MSW a activo al cerrar. Equivalente de Notificaciones a `frontend-dashboard-cutover-verification`.

## Requirements

### Requirement: El listado de Notificaciones funciona de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar el listado de Notificaciones del usuario autenticado, filtrado por `usuarioId` y por la empresa activa de la sesión, con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Listado de Notificaciones del usuario autenticado contra el backend real

- **WHEN** un usuario autenticado con empresa activa abre `NotificationBell`
- **THEN** `GET /api/notifications` devuelve únicamente las notificaciones de ese usuario en esa empresa, y `NotificationBell`/`NotificationList` las renderizan ordenadas por `createdAt`, con el contador de no leídas correcto

#### Scenario: `SUPERADMIN` sin empresa activa recibe 401, no 403

- **WHEN** un actor `SUPERADMIN` (sin `empresaActivaId` en la sesión) invoca `GET /api/notifications`
- **THEN** el backend responde 401, por diseño (`ListarNotificacionesEndpoint`, D6 de `be-notificaciones`) — no hay caso de uso de ver notificaciones de todo el sistema, a diferencia de `GET /api/users`

### Requirement: Marcar una Notificación como leída funciona contra el backend real, con 404 uniforme

El sistema SHALL completar la acción de marcar una Notificación como leída contra el backend .NET real. El backend SHALL responder 404 uniforme tanto cuando la notificación no existe como cuando pertenece a otro usuario, sin distinguir ambos casos en la respuesta.

#### Scenario: Marcar una Notificación propia como leída

- **WHEN** el usuario hace clic en una notificación no leída en `NotificationList`
- **THEN** `PATCH /api/notifications/:id/leida` marca `leida: true` contra el backend real, y la UI navega a `notificacion.link`

#### Scenario: Intentar marcar como leída una notificación de otro usuario, o inexistente

- **WHEN** se envía `PATCH /api/notifications/:id/leida` con un `id` que no existe o que pertenece a otro usuario
- **THEN** el backend responde 404 en ambos casos, sin revelar si la notificación existe pero es de otro usuario

### Requirement: Marcar todas las Notificaciones como leídas funciona contra el backend real

El sistema SHALL completar la acción de marcar todas las Notificaciones no leídas del usuario autenticado, en su empresa activa, como leídas contra el backend .NET real.

#### Scenario: Marcar todas como leídas desde la campana de notificaciones

- **WHEN** el usuario hace clic en "Marcar todas como leídas" en `NotificationBell`
- **THEN** `PATCH /api/notifications/marcar-todas-leidas` marca `leida: true` en todas las notificaciones no leídas de ese usuario en su empresa activa contra el backend real, y el contador de no leídas pasa a cero

### Requirement: `NotificacionTipo` (frontend) coincide con los 7 valores reales que el backend puede emitir

El tipo `NotificacionTipo` en `shc-controldoc/src/types/notification.types.ts` SHALL incluir los 7 valores definidos en `Domain/Enums/NotificacionTipo.cs` (backend): `CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`.

#### Scenario: Una notificación con un `tipo` de los 4 valores no contemplados antes se recibe y se muestra sin error de tipos

- **WHEN** el backend real emite una notificación con `tipo: "CIERRE"` (o `SEVERIDAD_CRITICA`/`VERIFICACION_EFICAZ`/`COMERCIO_EXTERIOR`), por ejemplo al cerrar un Quality Event real
- **THEN** `GET /api/notifications` la devuelve, el frontend la tipa correctamente sin recurrir a `any`/aserciones, y `NotificationList` la renderiza igual que cualquier otra notificación (por `mensaje`/`link`, sin discriminar por `tipo`)

### Requirement: MSW se revierte a activo al cerrar la verificación de Notificaciones

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos aún dependientes de MSW.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
