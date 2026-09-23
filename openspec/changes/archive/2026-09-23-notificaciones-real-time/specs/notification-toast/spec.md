## MODIFIED Requirements

### Requirement: Same-session toast fires when a new notification appears for the current user
When `useNotifications()`'s data changes to include a notification for the current user with `createdAt` newer than the last-seen notification timestamp (tracked client-side, e.g. via `useRef`, not via `useEffect`-derived state that duplicates query state), the system SHALL fire a Sonner `toast()` with the notification's `mensaje`, without mutating any store. This heuristic SHALL remain the toast source for the 5 non-urgent `NotificacionTipo` values (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`), for same-tab events, and as a fallback for `SEVERIDAD_CRITICA`/`CIERRE` notifications the SignalR hub (`notifications-realtime-client`) did not already surface (e.g. the hub was disconnected when they were created). It SHALL NOT re-toast a notification the hub has already surfaced (see "Hub-sourced notifications are marked as seen").

#### Scenario: New same-session notification triggers a toast
- **WHEN** a mutation in the current tab causes a new notification to be created for the currently logged-in user
- **THEN** a Sonner toast is shown with that notification's `mensaje`

#### Scenario: Notifications for other users never toast in this session
- **WHEN** the notifications query returns entries for a different `usuarioId` than the currently logged-in user (which it never should, per the `GET /api/notifications` filter, but is documented as a defense-in-depth expectation)
- **THEN** no toast is fired for those entries

### Requirement: Cross-session delivery limitation is documented, split by notification type
The system SHALL document, in code comments on the toast-triggering hook and in the design record, the current state of cross-session delivery: for the 5 non-urgent `NotificacionTipo` values, a notification created for another user's session is only visible to them via the bell/inbox on their next poll (`useNotifications()`'s 60-second `refetchInterval`, `notification-query-hooks`) or manual fetch — not instantly. For `SEVERIDAD_CRITICA`/`CIERRE`, real-time cross-session delivery exists via the `NotificationsHub` (`notifications-realtime-hub`/`notifications-realtime-client`) — the comment SHALL NOT claim this remains an unresolved limitation for those two types.

#### Scenario: Recipient in a different session sees a non-urgent notification only on next poll
- **WHEN** user A's action creates a `CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `VERIFICACION_EFICAZ` or `COMERCIO_EXTERIOR` notification for user B, in a separate browser session
- **THEN** user B does not see a toast at the moment of creation; it appears in user B's bell/dropdown within at most 60 seconds via polling, or sooner via manual navigation

#### Scenario: Recipient in a different session sees an urgent notification immediately
- **WHEN** user A's action creates a `SEVERIDAD_CRITICA` or `CIERRE` notification for user B, in a separate browser session with an active hub connection
- **THEN** user B sees a toast at the moment of creation, delivered via the SignalR hub, not via polling

## ADDED Requirements

### Requirement: Hub-sourced notifications are marked as seen to prevent a duplicate toast on next poll
When the SignalR hub (`notifications-realtime-client`) fires a toast for a `SEVERIDAD_CRITICA`/`CIERRE` notification, the system SHALL record that notification's `createdAt`/`id` in the same "last seen" reference the same-session polling heuristic uses, so that the next `useNotifications()` refetch does not treat it as new and re-toast it.

#### Scenario: A hub-delivered notification is not re-toasted on the next poll
- **WHEN** the hub delivers a `"notificacionNueva"` toast for a `SEVERIDAD_CRITICA`/`CIERRE` notification, and `useNotifications()` subsequently refetches and includes that same notification
- **THEN** no second toast is fired for it
