## ADDED Requirements

### Requirement: OperarioDashboard renders a "Notificaciones pendientes" section
`OperarioDashboard` SHALL render a "Notificaciones pendientes" section using `useNotifications()`, reusing the same notification-list rendering component used by `NotificationBell`'s dropdown (from `notification-bell`), filtered to the current user (already guaranteed by the `GET /api/notifications` handler's per-user filter) and to unread entries first. It SHALL NOT duplicate the notification-rendering markup or read/mark-as-read logic already implemented for the bell dropdown.

#### Scenario: Section renders the current user's unread notifications
- **WHEN** `OperarioDashboard` renders for a user with 2 unread notifications
- **THEN** the "Notificaciones pendientes" section lists both, using the shared notification-list component

#### Scenario: Clicking a notification in the dashboard section marks it read and navigates
- **WHEN** the user clicks a notification row inside the "Notificaciones pendientes" section
- **THEN** the same mark-as-read mutation and navigation behavior defined for the bell dropdown fires (no separate implementation)

#### Scenario: Empty state when there are no notifications
- **WHEN** `useNotifications()` returns an empty array for the current user
- **THEN** the section renders an empty-state message instead of an empty list
