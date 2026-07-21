## ADDED Requirements

### Requirement: GET /api/notifications handler
The system SHALL register an MSW v2 handler for `GET /api/notifications` in `src/mocks/handlers/notifications.handlers.ts` that: (1) resolves the requesting user from the request's auth context; (2) before filtering, invokes the idempotent vencimiento-generation pass from `notification-generation` so any newly-crossed AC/document deadlines are appended to the store first; (3) filters `getNotificationsStore()` to entries where `usuarioId` matches the requesting user; (4) sorts the result by `createdAt` descending (most recent first); (5) returns `ApiResponse<Notificacion[]>`. The response SHALL be delayed by 400 ms.

#### Scenario: Returns only the requesting user's notifications, most recent first
- **WHEN** `GET /api/notifications` is requested by a user with id `user-operario-001` and the store contains notifications for both `user-operario-001` and other users
- **THEN** the response `data` contains only `user-operario-001`'s notifications, ordered from most to least recent

#### Scenario: Triggers vencimiento generation before reading
- **WHEN** `GET /api/notifications` is requested and an AC has newly crossed into AMARILLO since the last read, with no existing `VENCIMIENTO` notification for that AC
- **THEN** the response `data` includes a new `VENCIMIENTO` notification for that AC's responsable (if resolvable)

### Requirement: PATCH /api/notifications/:id/leida handler
The system SHALL register an MSW v2 handler for `PATCH /api/notifications/:id/leida` that sets `leida: true` on the matching notification in `getNotificationsStore()` and returns the updated `Notificacion` wrapped in `ApiResponse<Notificacion>`. Unknown `:id` SHALL return 404. The response SHALL be delayed by 400 ms.

#### Scenario: Marks a single notification as read
- **WHEN** `PATCH /api/notifications/notif-001/leida` is requested for an unread notification
- **THEN** the response status is 200 and `data.leida` is `true`

#### Scenario: Unknown id returns 404
- **WHEN** `PATCH /api/notifications/does-not-exist/leida` is requested
- **THEN** the response status is 404

### Requirement: PATCH /api/notifications/marcar-todas-leidas handler
The system SHALL register an MSW v2 handler for `PATCH /api/notifications/marcar-todas-leidas` that sets `leida: true` on every notification in `getNotificationsStore()` belonging to the requesting user, and returns the updated list wrapped in `ApiResponse<Notificacion[]>`. The response SHALL be delayed by 400 ms.

#### Scenario: Marks all of the requesting user's notifications as read
- **WHEN** `PATCH /api/notifications/marcar-todas-leidas` is requested by a user with 3 unread notifications
- **THEN** the response status is 200 and all 3 of that user's notifications have `leida: true`, without affecting other users' notifications

### Requirement: Handlers registered in index.ts
The system SHALL export `notificationHandlers` from `src/mocks/handlers/notifications.handlers.ts` and combine it into the array in `src/mocks/handlers/index.ts` so it is active whenever MSW starts.

#### Scenario: notificationHandlers are active when MSW starts
- **WHEN** the MSW worker is started with `VITE_ENABLE_MSW=true`
- **THEN** a request to `GET /api/notifications` is intercepted and handled
