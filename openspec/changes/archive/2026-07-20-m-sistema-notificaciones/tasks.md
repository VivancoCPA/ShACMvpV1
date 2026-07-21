## 1. Types and fixtures foundation

- [x] 1.1 Add `Notificacion`, `NotificacionTipo`, `NotificacionEntidadTipo` to `src/types/notification.types.ts`
- [x] 1.2 Create `src/mocks/fixtures/notifications.fixtures.ts` with seed data (at least one per `tipo`) and `getNotificationsStore`/`addNotification`/`resetStore`, verifying every seed `usuarioId` resolves in `getUsersStore()`
- [x] 1.3 Wire `resetStore()` into the existing `dev-mock-reset` mechanism

## 2. Notification generation core

- [x] 2.1 Implement `isResolvableAccount(id)` in `src/mocks/fixtures/notificationGeneration.ts` backed by `getUsersStore()` (not `resolveUserDisplayName`)
- [x] 2.2 Implement `createCambioEstadoNotification(params)` with recipient dedup, self-exclusion, and the resolvable-account guard
- [x] 2.3 Implement `createAsignacionNotification(params)` with self-exclusion and the resolvable-account guard
- [x] 2.4 Implement `buildVencimientoKey(entidadTipo, entidadId)`
- [x] 2.5 Implement `generateVencimientoNotifications()`: AC scan via QE/NC/Incidente `getXStore()`s using `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` from `shared-semaforo-pendientes`, and document scan via `getDocumentsStore()` against `fechaRevisionProxima` (RN-DOC-006), both keyed by `buildVencimientoKey`
- [x] 2.6 Unit tests (Vitest) for all of the above: identity guard, dedup/self-exclusion, and idempotency (re-running the scan does not duplicate)

## 3. Notifications MSW domain

- [x] 3.1 Create `src/mocks/handlers/notifications.handlers.ts`: `GET /api/notifications` (invokes `generateVencimientoNotifications()` first, then filters by requesting user and sorts by `createdAt` desc), `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas`
- [x] 3.2 Register `notificationHandlers` in `src/mocks/handlers/index.ts`
- [x] 3.3 msw/node integration tests for the three endpoints, including the 404 and per-user filtering cases

## 4. Wire notification generation into existing domain handlers

- [x] 4.1 `documents.handlers.ts`: read `notificarAutor` in the `POST /api/documents/:id/status` rejection path and call `createCambioEstadoNotification`; call `createAsignacionNotification` in the create and update handlers when `revisorId`/`aprobadorId` is set or changed
- [x] 4.2 `quality-events.handlers.ts` — AC sub-resource endpoints: call `createAsignacionNotification` on AC creation/reassignment `responsableId`; call `createCambioEstadoNotification` for `JEFE_CALIDAD_SYST` users on the automatic `EN_EJECUCION → PENDIENTE_CIERRE` transition
- [x] 4.3 `quality-events.handlers.ts` — `firmar-cierre`: call `createCambioEstadoNotification` for the reporter (always) and `ALTA_DIRECCION` users (when `severidad` is `ALTA`/`CRITICA`) on the `CERRADO` transition
- [x] 4.4 `quality-events.handlers.ts` — `forzar-vencimiento-verificacion` (CERRADO→EN_VERIFICACION path): call `createAsignacionNotification` for the assigned `auditorAsignadoId`, replacing the previous unimplemented "notify JEFE_CALIDAD_SYST" text
- [x] 4.5 `quality-events.handlers.ts` — `verificacion-eficacia` and `forzar-vencimiento-verificacion` (EN_VERIFICACION reapertura path): call `createCambioEstadoNotification` for `ALTA_DIRECCION`, `JEFE_CALIDAD_SYST`, area `SUPERVISOR` (via `areasAsignadas`), and the reporter, on both `VERIFICADO` and reapertura outcomes
- [x] 4.6 `nonconformities.handlers.ts`: call `createCambioEstadoNotification` in `PATCH /api/nonconformities/:id` when `estado` is among the changed fields
- [x] 4.7 `incidents.handlers.ts`: call `createCambioEstadoNotification` in `PATCH /api/incidents/:id/status` on every valid transition
- [x] 4.8 Update `useForzarVencimientoVerificacion.ts` and `QEACSection.tsx`/`QECierreSection.tsx`/`QEVerificacionSection.tsx` toast copy to stop claiming other roles were notified (keep only the acting user's own confirmation toast)
- [x] 4.9 Tests updated/added for each modified handler covering the new notification-emission scenarios from the delta specs

## 5. API client and query hooks

- [x] 5.1 Create `src/api/endpoints/notifications.api.ts` (`getNotifications`, `markNotificationRead`, `markAllNotificationsRead`)
- [x] 5.2 Add `QUERY_KEYS.notifications.all`
- [x] 5.3 Create `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead` hooks under `src/features/notifications/hooks/`
- [x] 5.4 Unit tests for the query hooks (mocked API, cache invalidation on mutation success)

## 6. Notification Bell UI

- [x] 6.1 Build shared `NotificationList` component (row: mensaje, relative time, read/unread styling, click → mark-read + navigate) reused by both the bell dropdown and the Operario dashboard section
- [x] 6.2 Build `NotificationBell` (icon + unread badge + dropdown housing `NotificationList` + "Marcar todas como leídas" button) and mount it in `TopNav.tsx`
- [x] 6.3 Add `notifications` i18n namespace entries (`es-PE.json`, `en-US.json`): bell aria-label, relative-time strings, mark-all-read label, empty state
- [x] 6.4 Component tests: badge visibility/count, dropdown open/close, click-to-navigate-and-mark-read, mark-all-as-read

## 7. Toast wiring

- [x] 7.1 Implement the same-session toast trigger hook (tracks last-seen `createdAt` via `useRef`, fires Sonner `toast()` on new same-user notifications, no `useEffect`-derived state duplication)
- [x] 7.2 Document the cross-session/cross-browser limitation inline (code comment) per design.md Decision and Non-Goals
- [x] 7.3 Test: new notification for the current user triggers a toast; notification for a different user does not

## 8. Dashboard integration (M5-S03 gap closure)

- [x] 8.1 Add "Notificaciones pendientes" section to `OperarioDashboard.tsx` reusing `NotificationList`
- [x] 8.2 Add empty-state rendering when there are no notifications
- [x] 8.3 Test covering the section's render, click-through, and empty state

## 9. Cross-cutting verification

- [ ] 9.1 Verify RN-NOTIF-001/002/003 and CA-NOTIF-01 through CA-NOTIF-06 end-to-end in the browser, logged in as at least 2 distinct roles (e.g. `OPERARIO` reporting a QE, then `JEFE_CALIDAD_SYST` changing its state, confirming the Operario's bell updates on next fetch) — **not done**: no browser-automation tool (chromium-cli/Playwright) is available in this environment; behavior is instead covered by msw/node integration tests exercising the real handlers end-to-end (see `notifications.handlers.test.ts`, `quality-events.handlers.test.ts`, `documents.handlers.test.ts`, `nonconformities.handlers.test.ts`, `incidents.handlers.test.ts`). Recommend a manual pass in the browser before shipping.
- [ ] 9.2 Verify the M1 reject-notify checkbox (checked vs unchecked) actually creates/omits a notification for the author — covered at the handler level (`documents.handlers.test.ts`: "notificarAutor on rejection" describe block) but not manually verified through the actual `DocumentRejectModal` UI in a browser.
- [ ] 9.3 Verify dark mode on `NotificationBell`, its dropdown, and the dashboard section — all new markup includes `dark:` variants per project convention, but not visually confirmed in a browser (same tooling limitation as 9.1).
- [x] 9.4 Run full test suite and confirm no regressions in the modified QE/NC/Incident/Document handler tests — 990-995/995 passing; the handful of failures are pre-existing and unrelated (confirmed via `git stash`): `DeadlineBadge.test.tsx`/`Pagination.test.tsx` (broken import path `../../i18n/config`), `JefeCalidadDashboard.test.tsx`, `qualityEventCreate.schema.test.ts` (×2), `useNCList.test.ts` — all trace to the separately in-flight, uncommitted `m1-segregar-funciones` change already present in the working tree before this session, not to this change.
