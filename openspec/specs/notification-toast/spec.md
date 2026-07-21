# Spec: notification-toast

## Purpose

Same-session Sonner toast for newly-created notifications belonging to the current user, and the documented limitation that cross-session/cross-user real-time delivery does not exist in the MSW mock environment.

---

## Requirements

### Requirement: Same-session toast fires when a new notification appears for the current user
When `useNotifications()`'s data changes to include a notification for the current user with `createdAt` newer than the last-seen notification timestamp (tracked client-side, e.g. via `useRef`, not via `useEffect`-derived state that duplicates query state), the system SHALL fire a Sonner `toast()` with the notification's `mensaje`, without mutating any store. This SHALL only fire for events generated within the same browser tab/session (e.g. a mutation the current user's own action caused a notification to be created for their own account, such as a QE signer also being an AC responsable) — there is no cross-browser/cross-user push in the mock environment.

#### Scenario: New same-session notification triggers a toast
- **WHEN** a mutation in the current tab causes a new notification to be created for the currently logged-in user
- **THEN** a Sonner toast is shown with that notification's `mensaje`

#### Scenario: Notifications for other users never toast in this session
- **WHEN** the notifications query returns entries for a different `usuarioId` than the currently logged-in user (which it never should, per the `GET /api/notifications` filter, but is documented as a defense-in-depth expectation)
- **THEN** no toast is fired for those entries

### Requirement: Cross-session delivery limitation is documented
The system SHALL document, in code comments on the toast-triggering hook and in the design record, that real-time delivery of a toast to a *different* user's browser session requires a real backend (WebSocket/SSE or polling against a real API) and does not function in the MSW mock environment — a notification created for another user is only visible to them via the bell/inbox on their next fetch (e.g. next `GET /api/notifications`, triggered by React Query's normal refetch behavior), not instantly.

#### Scenario: Recipient in a different session sees the notification only on next fetch
- **WHEN** user A's action creates a notification for user B, and user B is in a separate browser session
- **THEN** user B does not see a toast at the moment of creation; the notification appears in user B's bell/dropdown once their `useNotifications()` query next fetches
