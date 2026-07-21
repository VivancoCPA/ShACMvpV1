## ADDED Requirements

### Requirement: NotificationBell renders in TopNav with an unread-count badge
The system SHALL render a `NotificationBell` component in `src/components/layout/TopNav.tsx`, placed in the right-side controls group alongside the existing language/theme toggle buttons (before the user-avatar block), using `useNotifications()`. It SHALL show a numeric badge with the count of `leida: false` notifications, hidden entirely when that count is `0`. It SHALL follow the existing toggle-button dark-mode class pattern (`text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark`) and expose `aria-label={t('notifications:bell.ariaLabel')}`.

#### Scenario: Badge hidden when there are no unread notifications
- **WHEN** `useNotifications()` returns only notifications with `leida: true`
- **THEN** no badge is rendered on the bell icon

#### Scenario: Badge shows the unread count
- **WHEN** `useNotifications()` returns 3 notifications with `leida: false`
- **THEN** the badge displays `3`

### Requirement: Dropdown lists notifications with read/unread visual distinction
Clicking `NotificationBell` SHALL open a dropdown listing all notifications from `useNotifications()`, most recent first, each rendering `mensaje`, a relative timestamp (e.g. `t('notifications:relativeTime.hoursAgo', { count })`) computed from `createdAt`, and a visual distinction between read (dimmed/muted text) and unread (full-contrast, e.g. a subtle background or bold treatment) entries, each with dark-mode variants per project convention.

#### Scenario: Unread notifications are visually distinct from read ones
- **WHEN** the dropdown renders a mix of `leida: true` and `leida: false` notifications
- **THEN** unread entries render with full-contrast/emphasis styling and read entries render dimmed, both with light and dark mode classes present

### Requirement: Clicking a notification navigates to its link and marks it read
Clicking a notification row SHALL call `useMarkNotificationRead().mutate(id)` and navigate to the notification's `link` via React Router.

#### Scenario: Click navigates and marks read
- **WHEN** the user clicks a notification with `link: '/quality-events/qe-2026-0042'`
- **THEN** `useMarkNotificationRead().mutate` is called with that notification's `id` and the router navigates to `/quality-events/qe-2026-0042`

### Requirement: "Marcar todas como leídas" button in dropdown header
The dropdown SHALL render a button labeled via `t('notifications:markAllRead')` in its header that calls `useMarkAllNotificationsRead().mutate()` when clicked, visible even when there are zero unread notifications (disabled or a no-op in that case is acceptable, but the control SHALL NOT be hidden based on count).

#### Scenario: Marking all as read clears the badge without a page reload
- **WHEN** the user clicks "Marcar todas como leídas" with 3 unread notifications present
- **THEN** the badge disappears and all dropdown entries render in the read (dimmed) state without a full page reload
