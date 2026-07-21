## ADDED Requirements

### Requirement: useNotifications query hook
The system SHALL export `useNotifications()` from `src/features/notifications/hooks/useNotifications.ts`, a `useQuery` hook keyed on `QUERY_KEYS.notifications.all` calling `getNotifications()`.

#### Scenario: useNotifications exposes the fetched list
- **WHEN** `useNotifications()` resolves successfully
- **THEN** `data` is the `Notificacion[]` returned by `GET /api/notifications`

### Requirement: useMarkNotificationRead mutation hook
The system SHALL export `useMarkNotificationRead()` from `src/features/notifications/hooks/useMarkNotificationRead.ts`, a `useMutation` hook calling `markNotificationRead(id)` that, `onSuccess`, invalidates `QUERY_KEYS.notifications.all` so the bell badge and dropdown refresh without a page reload.

#### Scenario: Marking one notification as read invalidates the notifications query
- **WHEN** `useMarkNotificationRead().mutate(id)` succeeds
- **THEN** the `['notifications']` query is invalidated and refetched

### Requirement: useMarkAllNotificationsRead mutation hook
The system SHALL export `useMarkAllNotificationsRead()` from `src/features/notifications/hooks/useMarkAllNotificationsRead.ts`, a `useMutation` hook calling `markAllNotificationsRead()` that, `onSuccess`, invalidates `QUERY_KEYS.notifications.all`.

#### Scenario: Marking all as read invalidates the notifications query
- **WHEN** `useMarkAllNotificationsRead().mutate()` succeeds
- **THEN** the `['notifications']` query is invalidated and refetched
