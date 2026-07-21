## Why

SHAC never designed a notification system: important events (state changes, assignments, approaching deadlines) are invisible unless a user is looking at the exact screen when they happen. Two gaps already document this — the "Notificar al creador" checkbox in the M1 document-reject modal is wired through the form and API request but silently dropped by the MSW handler (never triggers anything), and the M5-S03 Operario dashboard has no "pending notifications" section at all. This change closes both gaps with a transversal notification system: ephemeral toast (Sonner) + a persistent inbox (bell icon in `TopNav` with an unread-count badge), covering three event categories in one spec per an explicit scope decision: state changes, assignments, and deadlines.

## What Changes

- Add a `Notificacion` data model and a new MSW domain (`notifications.fixtures.ts` + `notifications.handlers.ts`) with a mutable module store, following the existing `getXStore()` pattern (e.g. `getNonconformitiesStore()`).
- Add `GET /api/notifications`, `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas`, an Axios client module, and TanStack Query hooks (`useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`).
- Add pure notification-generation logic for:
  - **RN-NOTIF-001** (state change): notifies the original reporter and active-AC responsables of a QE/NC/Incidente, excluding whoever triggered the transition.
  - **RN-NOTIF-002** (assignment): notifies a newly assigned AC responsable, a QE actor who must act next (e.g. signer on `PENDIENTE_CIERRE`, verificador on `EN_VERIFICACION`), and a document assigned as Revisor/Aprobador.
  - **RN-NOTIF-003** (deadline): notifies once when an AC first crosses into AMARILLO (reusing the existing `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` from `shared-semaforo-pendientes` — no new threshold logic) and once when a document crosses its `fechaRevisionProxima` warning window (`RN-DOC-006`), computed idempotently on each notifications read (no cron available in the mock environment).
- Add an identity-resolution guard: before creating any notification, the target id is checked against the live `authFixtures` store (`getUsersStore()`) — not `resolveUserDisplayName`, which always returns a display string even for login-less legacy ids. If the id isn't a real loggable account, that notification is silently skipped instead of failing the parent mutation.
- Replace the QE domain's existing same-session mock "notifies X" toasts (`quality-event-cierre`, `quality-event-verificacion`, `quality-event-ac-section` — verified in code: they only tell the *acting* user that someone else "was notified", and one clause is asserted in the spec but not implemented at all) with real persisted notifications to the actual recipients.
- Add a bell icon + dropdown to `TopNav` (unread badge, relative timestamps, click-to-navigate-and-mark-read, "mark all as read"), and reuse that same list component, filtered, to finally populate the Operario dashboard's "Notificaciones pendientes" section.
- Wire the previously-inert `notificarAutor` field in the M1 reject-modal request into the document status-change MSW handler so it actually creates a `CAMBIO_ESTADO` notification to the author when checked.
- Add Sonner toast firing for same-browser-session events only, with the cross-user real-time limitation (no WebSocket/SSE in the mock environment) explicitly documented as a known gap for the real .NET backend to close.

## Capabilities

### New Capabilities
- `notification-types`: `Notificacion` interface, `tipo`/`entidadTipo` enums, request/response DTOs.
- `notification-msw-fixtures`: fixtures + mutable store (`getNotificationsStore`, `addNotification`, `resetStore`) for the new notifications domain.
- `notification-msw-handlers`: `GET /api/notifications`, `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas`.
- `notification-generation`: pure functions implementing RN-NOTIF-001/002/003, including the idempotent-vencimiento mechanism and the `getUsersStore()`-backed identity guard (CA-NOTIF-06).
- `notification-api-client`: Axios endpoints module + query keys for the notifications domain.
- `notification-query-hooks`: `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`.
- `notification-bell`: `TopNav` bell icon, unread badge, dropdown list, deep-link navigation, mark-as-read/mark-all-as-read interactions.
- `notification-toast`: Sonner toast wiring for same-session events, with the cross-session/cross-browser limitation documented.

### Modified Capabilities
- `document-msw-handlers`: the `POST /api/documents/:id/status` transition handler must read `notificarAutor` from the reject request body and, when `true`, create a `CAMBIO_ESTADO` notification to the author (closes the currently-inert checkbox); the create and update handlers must emit an `ASIGNACION` notification when `revisorId`/`aprobadorId` is set or changed.
- `quality-event-cierre`: replaces the existing "CERRADO transition notifies Gerencia and the original reporter" requirement's same-session mock toasts (currently only informs the *signer* that Gerencia/the reporter "was notified") with real `CAMBIO_ESTADO` notifications persisted for those actual recipients, in addition to the signer's own confirmation toast.
- `quality-event-verificacion`: replaces the equivalent mock toasts in "VERIFICADO and reapertura notify Gerencia, Jefe Calidad, Supervisor, and the reporter" with real persisted notifications to those recipients; the "Dev-only control forces the CERRADO to EN_VERIFICACION transition" requirement's currently-unimplemented "create a verification task notification for `JEFE_CALIDAD_SYST`" clause becomes a real `ASIGNACION` notification to the assigned verificador (RN-NOTIF-002).
- `quality-event-ac-section`: replaces the "QEACSection notifies JEFE_CALIDAD_SYST and SUPERVISOR on auto-transition to PENDIENTE_CIERRE" requirement's role-gated same-session `toast.info` (only visible if the *acting* user happens to hold that role) with a real `ASIGNACION` notification to whoever must sign the closure; new-AC creation and AC reassignment emit an `ASIGNACION` notification to the new `responsableId` (RN-NOTIF-002).
- `nc-msw-handlers`: the `PATCH /api/nonconformities/:id` handler must emit a `CAMBIO_ESTADO` notification to the reporter and active-AC responsables when `estado` is among the changed fields (RN-NOTIF-001), excluding the acting user.
- `incident-msw-handlers`: the `PATCH /api/incidents/:id/status` handler must emit a `CAMBIO_ESTADO` notification to the reporter and active-AC responsables on every valid transition (RN-NOTIF-001), excluding the acting user.
- `dashboard-operario-view`: the Operario dashboard gains a "Notificaciones pendientes" section, implemented by reusing the `notification-bell` list component rather than duplicating notification-rendering logic.

**Note on existing mock-toast pattern:** `quality-event-cierre`, `quality-event-verificacion`, and `quality-event-ac-section` already contain requirement text describing "notifies X" behavior — verified against the actual hooks/components, these are same-session toasts that inform the *acting* user someone else "was notified" (one clause, the verification-task notification, isn't implemented in code at all despite being asserted in the spec). This change makes all of them real by routing through `notification-generation` instead of leaving them as self-referential toast copy.

## Impact

- **New code:** `src/types/notification.types.ts` (or `features/notifications/types/`), `src/mocks/fixtures/notifications.fixtures.ts`, `src/mocks/handlers/notifications.handlers.ts`, `src/api/endpoints/notifications.api.ts`, `src/features/notifications/hooks/*`, `src/features/notifications/components/*` (bell, dropdown, toast trigger), new i18n keys under a `notifications` namespace (`es-PE`/`en-US`).
- **Modified code:** `src/components/layout/TopNav.tsx` (bell icon), `src/mocks/handlers/documents.handlers.ts` (read `notificarAutor`, emit on revisor/aprobador assignment), `src/mocks/handlers/quality-events.handlers.ts` (cierre/verificacion/AC-assignment endpoints), `src/features/quality-events/hooks/useForzarVencimientoVerificacion.ts`, `src/features/quality-events/components/QEACSection.tsx` (replace mock toasts with real notification reads), `src/mocks/handlers/nonconformities.handlers.ts`, `src/mocks/handlers/incidents.handlers.ts` (emit notifications on relevant transitions/assignments), `src/features/dashboard/pages/OperarioDashboard.tsx` (new section).
- **Dependencies:** reuses `getUsersStore()` (`auth.fixtures.ts`), `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` (`shared-semaforo-pendientes`), and the existing store-mutable-module MSW pattern. No new npm packages — Sonner and TanStack Query are already in the stack.
- **Out of scope (documented backlog):** real email delivery, real cross-browser push (WebSocket/SSE), per-user notification preferences, and `ADMINISTRADOR_SISTEMA` notifications.
