# Spec: notification-msw-fixtures

## Purpose

Seed data and mutable in-memory store for notifications, following the same pattern as other domain fixtures (`getNonconformitiesStore()`, etc.).

---

## Requirements

### Requirement: notifications.fixtures.ts seed data and mutable store
The system SHALL provide `src/mocks/fixtures/notifications.fixtures.ts` exporting a seed array of `Notificacion` fixtures (at least one per `tipo` value, targeting ids that exist in `getUsersStore()`) and a module-level mutable store following the same pattern as `getNonconformitiesStore()`: an internal `let notifications: Notificacion[] = [...notificationFixtures]`, an exported `getNotificationsStore(): Notificacion[]` returning the live array reference (not a copy), an exported `addNotification(n: Notificacion): void` appending to the live array, and an exported `resetStore(): void` restoring the seed data (used by tests and `dev-mock-reset`).

#### Scenario: getNotificationsStore returns the live mutable array
- **WHEN** `addNotification(n)` is called and then `getNotificationsStore()` is read
- **THEN** the returned array contains `n`

#### Scenario: resetStore restores the original seed fixtures
- **WHEN** `addNotification(n)` is called, then `resetStore()` is called, then `getNotificationsStore()` is read
- **THEN** the returned array equals the original seed fixtures and does not contain `n`

### Requirement: Seed fixtures reference ids resolvable in authFixtures
Every `usuarioId` in the seed fixture array SHALL correspond to an id present in `getUsersStore()` (`auth.fixtures.ts`), so the seed data is reachable end-to-end by logging in as that fixture user.

#### Scenario: Every seed notification's usuarioId is a real authFixtures id
- **WHEN** each `usuarioId` in the seed fixture array is looked up in `getUsersStore()`
- **THEN** a matching user is found for every entry
