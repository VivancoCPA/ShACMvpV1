## MODIFIED Requirements

### Requirement: useNotifications query hook
The system SHALL export `useNotifications()` from `src/features/notifications/hooks/useNotifications.ts`, a `useQuery` hook keyed on `QUERY_KEYS.notifications.all` calling `getNotifications()`, with `refetchInterval: 60_000` — a lightweight poll that keeps the bell/dropdown in sync for the 5 non-urgent `NotificacionTipo` values, and serves as a fallback net for `SEVERIDAD_CRITICA`/`CIERRE` if the SignalR hub connection (see `notifications-realtime-client`) is momentarily disconnected.

#### Scenario: useNotifications exposes the fetched list
- **WHEN** `useNotifications()` resolves successfully
- **THEN** `data` is the `Notificacion[]` returned by `GET /api/notifications`

#### Scenario: useNotifications refetches automatically every 60 seconds
- **WHEN** `useNotifications()` is mounted and 60 seconds elapse without any manual invalidation
- **THEN** the query refetches `GET /api/notifications` again, without requiring user interaction or navigation

#### Scenario: Polling still catches an urgent notification if the hub was disconnected
- **WHEN** a `SEVERIDAD_CRITICA`/`CIERRE` notification is created while the current user's SignalR hub connection is disconnected
- **THEN** the next 60-second poll of `useNotifications()` brings that notification into the cache even though no `"notificacionNueva"` event was received for it
