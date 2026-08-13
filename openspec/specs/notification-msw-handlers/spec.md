# Spec: notification-msw-handlers

## Purpose

MSW v2 request handlers for the notifications inbox: listing (which triggers the idempotent vencimiento-generation pass), marking a single notification read, and marking all of a user's notifications read.

---

## Requirements

### Requirement: GET /api/notifications handler
The system SHALL register an MSW v2 handler for `GET /api/notifications` in `src/mocks/handlers/notifications.handlers.ts` that: (1) resolves the requesting user from the request's auth context; (2) before filtering, invokes the idempotent vencimiento-generation pass from `notification-generation` so any newly-crossed AC/document/incident deadlines are appended to the store first; (3) filters `getNotificationsStore()` to entries where `usuarioId` matches the requesting user AND `empresaId` matches the session's active empresa (`getActiveEmpresaId()`); (4) sorts the result by `createdAt` descending (most recent first); (5) returns `ApiResponse<Notificacion[]>`. The response SHALL be delayed by 400 ms.

#### Scenario: Returns only the requesting user's notifications, most recent first
- **WHEN** `GET /api/notifications` is requested by a user with id `user-operario-001` and the store contains notifications for both `user-operario-001` and other users
- **THEN** the response `data` contains only `user-operario-001`'s notifications, ordered from most to least recent

#### Scenario: Triggers vencimiento generation before reading
- **WHEN** `GET /api/notifications` is requested and an AC has newly crossed into AMARILLO since the last read, with no existing `VENCIMIENTO` notification for that AC
- **THEN** the response `data` includes a new `VENCIMIENTO` notification for that AC's responsable (if resolvable)

#### Scenario: A user's notification from another empresa is not returned while a different empresa is active (RN-EMP-004)
- **WHEN** `user-supervisor-001` has notifications with `empresaId: 'empresa-001'` and `empresaId: 'empresa-002'` (from their two `UsuarioEmpresa` assignments), and their session's active empresa is `empresa-001`
- **THEN** `GET /api/notifications` returns only the `empresa-001` notifications; the `empresa-002` ones are excluded until the user switches active empresa

#### Scenario: Switching active empresa changes the visible notification set immediately
- **WHEN** `user-supervisor-001` switches active empresa from `empresa-001` to `empresa-002` and requests `GET /api/notifications` again without reloading
- **THEN** the response now contains only `empresa-002` notifications

### Requirement: PATCH /api/notifications/:id/leida handler
The system SHALL register an MSW v2 handler for `PATCH /api/notifications/:id/leida` that sets `leida: true` on the matching notification in `getNotificationsStore()` and returns the updated `Notificacion` wrapped in `ApiResponse<Notificacion>`. Unknown `:id` SHALL return 404. The response SHALL be delayed by 400 ms.

#### Scenario: Marks a single notification as read
- **WHEN** `PATCH /api/notifications/notif-001/leida` is requested for an unread notification
- **THEN** the response status is 200 and `data.leida` is `true`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/notifications/does-not-exist/leida` is requested
- **THEN** the response status is 404

### Requirement: PATCH /api/notifications/marcar-todas-leidas handler
The system SHALL register an MSW v2 handler for `PATCH /api/notifications/marcar-todas-leidas` that sets `leida: true` on every notification in `getNotificationsStore()` belonging to the requesting user AND to the session's active empresa (`empresaId === getActiveEmpresaId()`), and returns the updated list wrapped in `ApiResponse<Notificacion[]>`. The response SHALL be delayed by 400 ms.

#### Scenario: Marks all of the requesting user's notifications as read
- **WHEN** `PATCH /api/notifications/marcar-todas-leidas` is requested by a user with 3 unread notifications, all in their active empresa
- **THEN** the response status is 200 and all 3 of that user's notifications have `leida: true`, without affecting other users' notifications

#### Scenario: Does not mark as read a notification belonging to a different empresa
- **WHEN** `user-supervisor-001` has an unread notification with `empresaId: 'empresa-002'` while their active empresa is `empresa-001`, and requests `PATCH /api/notifications/marcar-todas-leidas`
- **THEN** that `empresa-002` notification remains unread; only `empresa-001` notifications are affected

### Requirement: Handlers registered in index.ts
The system SHALL export `notificationHandlers` from `src/mocks/handlers/notifications.handlers.ts` and combine it into the array in `src/mocks/handlers/index.ts` so it is active whenever MSW starts.

#### Scenario: notificationHandlers are active when MSW starts
- **WHEN** the MSW worker is started with `VITE_ENABLE_MSW=true`
- **THEN** a request to `GET /api/notifications` is intercepted and handled
