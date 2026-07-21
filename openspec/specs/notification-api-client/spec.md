# Spec: notification-api-client

## Purpose

Axios endpoint module for notifications, following the existing per-domain `*.api.ts` pattern, plus the `QUERY_KEYS.notifications` convention it depends on.

---

## Requirements

### Requirement: notifications.api.ts Axios endpoints
The system SHALL provide `src/api/endpoints/notifications.api.ts` exporting: `getNotifications(): Promise<Notificacion[]>` calling `GET /api/notifications`; `markNotificationRead(id: string): Promise<Notificacion>` calling `PATCH /api/notifications/:id/leida`; `markAllNotificationsRead(): Promise<Notificacion[]>` calling `PATCH /api/notifications/marcar-todas-leidas`. Each SHALL use the shared `api` Axios instance (`lib/axios.ts`) so auth headers and the `data.data` response-unwrapping interceptor apply automatically, matching the pattern of other domain `*.api.ts` modules.

#### Scenario: getNotifications calls the correct endpoint and returns unwrapped data
- **WHEN** `getNotifications()` is called
- **THEN** it issues `GET /api/notifications` via the shared `api` instance and resolves to the unwrapped `Notificacion[]`

#### Scenario: markNotificationRead calls the correct endpoint with the given id
- **WHEN** `markNotificationRead('notif-001')` is called
- **THEN** it issues `PATCH /api/notifications/notif-001/leida`

### Requirement: QUERY_KEYS.notifications convention
The system SHALL add a `notifications` entry to `QUERY_KEYS` with `all: ['notifications']`, following the existing `use[Entidad][Accion]` and query-key convention documented for other domains.

#### Scenario: QUERY_KEYS.notifications.all is stable
- **WHEN** `QUERY_KEYS.notifications.all` is read
- **THEN** it equals `['notifications']`
