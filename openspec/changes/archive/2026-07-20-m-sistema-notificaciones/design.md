## Context

SHAC has no notification system today. Three domains already gesture at one but never deliver it:

- **M1 (`document-approval-flow`)**: `DocumentRejectModal` sends `notificarAutor` to `POST /api/documents/:id/status`; the MSW handler never reads that field, so it's a dead parameter.
- **M4 QE (`quality-event-cierre`, `quality-event-verificacion`, `quality-event-ac-section`)**: three separate requirements already say "notifies Gerencia/reporter/Jefe Calidad/Supervisor" — verified against the real hooks (`useForzarVencimientoVerificacion.ts`, `QEACSection.tsx`) and specs, this is implemented (or, in one case, not implemented at all) as a `Sonner` toast shown to the **acting** user narrating that someone *else* was notified. No message ever reaches the actual recipient's session.
- **M5-S03 (`dashboard-operario-view`)**: the Operario dashboard has no "Notificaciones pendientes" section; it was scoped out of that spec pending this one.

Two structural constraints shape the design:

1. **No backend.** MSW v2 is the only data layer. There is no cron, no WebSocket/SSE, no email. Anything time-based (deadline crossing) must be computed idempotently on read, and anything "real-time" only works within a single browser tab/session.
2. **Disjoint ID spaces.** `authFixtures` (`auth.fixtures.ts`) uses ids like `user-operario-001`; QE/NC/Incident domain fixtures mix those with legacy bare ids (`user-002`...`user-009`) that have no login. `userIdentity.fixtures.ts` already solves *display-name* resolution for this split (`resolveUserDisplayName` + `seedLegacyNames`), but that helper always returns a string — including for ids with no real account — so it cannot answer "can this id receive an in-app notification?"

## Goals / Non-Goals

**Goals:**
- One `Notificacion` model and one MSW domain (`notifications.fixtures.ts` / `notifications.handlers.ts`) serving all three event categories (RN-NOTIF-001/002/003).
- A single reusable notification list UI (dropdown in `TopNav`, reused verbatim — filtered — in the Operario dashboard).
- Replace every existing mock/self-toast "notifies X" requirement with a real persisted notification to the actual recipient, verified against `getUsersStore()`.
- An idempotent generation mechanism for deadline-crossing notifications that tolerates being recomputed on every app load / notifications fetch without duplicating.
- A recipient-resolution guard that never breaks the parent mutation (QE close, AC creation, document reject, etc.) when a domain id doesn't map to a real account.

**Non-Goals:**
- Real email delivery, real push between two different browser sessions/users, or a WebSocket/SSE channel — explicitly backlogged for the .NET backend.
- Per-user notification preferences/muting.
- Notifications for `ADMINISTRADOR_SISTEMA` or M6.
- Fixing the underlying `user-00X` vs `user-{rol}-00X` fixture ID split itself — this design consumes `getUsersStore()` as the source of truth for "is this id a real account," it does not attempt to reconcile or migrate the two id spaces.

## Decisions

### 1. Single cross-domain `notifications` MSW module, not one per domain
All four domains (QE, NC, Incidente, Documento) funnel into one `Notificacion` store rather than each domain owning its own notification list. **Why:** the UI (bell dropdown, Operario widget) needs one unified, chronologically-merged feed per user; splitting storage per domain would require a fan-out read on every dropdown open. **Alternative considered:** notifications embedded as a sub-array on each domain entity (mirroring `auditTrail`) — rejected because a single QE state change can fan out to multiple recipients (reporter + N AC responsables), which doesn't fit a per-entity array cleanly, and cross-domain "my notifications" queries would require reading four fixture files instead of one.

### 2. Notification generation lives in domain handlers, called through a shared pure helper module
Each domain's existing MSW handler (documents, quality-events, nonconformities, incidents) calls a shared `notification-generation` helper (e.g. `createCambioEstadoNotification(...)`, `createAsignacionNotification(...)`) at the point the mutation already knows old/new state — it does not re-derive that diff elsewhere. **Why:** this matches the existing "store cross-domain in MSW" convention (call the other domain's exported store/helper function, never reach into its fixtures directly) already used between `dashboard` and `incidents`/`nonconformities`. **Alternative considered:** a generic "diff the entity before/after and infer notifications" middleware wrapping all handlers — rejected as over-engineered for four call sites and harder to reason about per RN-NOTIF-00x.

### 3. Recipient validity check uses `getUsersStore()` directly, not `resolveUserDisplayName`
The identity guard is `getUsersStore().some(u => u.id === candidateId)`. **Why:** `resolveUserDisplayName` is a display-formatting helper that intentionally always resolves to *some* string (falling back to `seedLegacyNames`, then the raw id) — it cannot distinguish "has a real, loggable account" from "has a friendly fallback name." Notifications must only be created for ids that are real `authFixtures` entries, since `usuarioId` on `Notificacion` is used to filter `GET /api/notifications` for the logged-in user. **Alternative considered:** extending `seedLegacyNames` with fake login accounts for the legacy ids — rejected as out of scope and it would let untestable historical seed data silently start "receiving" notifications no real user session could ever see.

### 4. Idempotent vencimiento notifications keyed by `entidadId + tipo`, computed on `GET /api/notifications`
On every `GET /api/notifications` call, the handler walks live ACs (via each domain's `getXStore()`) and documents nearing `fechaRevisionProxima`, computes semaforo state with the *existing* `calcularEstadoSemaforoDesdeFecha`/`calcularEstadoSemaforoFila` (no new threshold logic), and creates a notification only if none already exists for that `entidadId + tipo: 'VENCIMIENTO'` pair. **Why:** matches the brief's explicit idempotency requirement and reuses `shared-semaforo-pendientes` instead of re-implementing the >5/1-5/<1 day thresholds. **Trade-off:** this makes `GET /api/notifications` do more work than a typical read (a full recompute pass) — acceptable at mock-fixture scale (dozens of items, 400ms latency budget already established for MSW handlers); the real .NET backend replaces this entirely with a scheduled job per the brief, so this is explicitly throwaway logic.

### 5. Same-session toast stays, but as a *secondary* effect, not the notification itself
For QE cierre/verificacion/AC transitions, the existing Sonner toast shown to the acting user is kept (useful immediate feedback: "closure recorded"), but the clauses claiming other roles were "notified" are removed from the toast copy — that information now lives only in the real notification created for the actual recipient. **Why:** avoids misleading the acting user into thinking a message was actually delivered cross-session while still giving them their own confirmation.

## Risks / Trade-offs

- **[Risk]** Recomputing vencimiento notifications on every `GET /api/notifications` could create duplicate-looking entries if two idempotency keys are computed slightly differently across a refactor (e.g. AC vs Documento key shape drift) → **Mitigation:** `notification-generation`'s idempotency key builder is a single exported pure function (`buildVencimientoKey(entidadTipo, entidadId)`) used by both the AC and document scan, tested directly for stability.
- **[Risk]** A silently-skipped notification (unresolvable id, per Decision 3) could mask a real fixture data-quality bug (e.g. a typo'd `responsableId`) → **Mitigation:** CA-NOTIF-06 requires the skip to be silent *to the parent mutation*, not silent everywhere — the skip path logs via the same pattern already used for other soft-fail branches in this codebase (`console.warn` in dev), so it's discoverable without blocking the flow.
- **[Risk]** Merging four domains' state-change notifications into one handler surface increases the blast radius of a bug in `notification-generation` (a bug there could affect QE, NC, Incident, and Document mutations simultaneously) → **Mitigation:** the helper functions are pure (input: entity + actor + recipients, output: `Notificacion[]` to append) with no side effects of their own; each domain handler remains responsible for calling them and persisting the result to its own transaction, so a thrown error surfaces at the call site closest to the actual mutation.
- **[Trade-off]** No real cross-user real-time delivery in the mock environment — explicitly accepted and documented per the brief; QA/demo scripts must log in as two different roles in two browser profiles to see the receiving side of a notification (bell badge, not a live toast).

## Migration Plan

Not applicable — this is a net-new feature with no existing `Notificacion` data to migrate. The one behavioral migration is replacing the QE mock toasts (Decision 5); no data shape changes to existing entities are required (no new required fields on `QualityEvent`, `NoConformidad`, `Incidente`, or `Documento` — recipients are derived from existing `reportadoPorId`/`responsableId`/`revisorId`/`aprobadorId` fields at generation time, not stored redundantly on the source entity).

## Open Questions

- Should `PENDIENTE_CIERRE` notify a specific `JEFE_CALIDAD_SYST` (and which one, if there are several fixture users with that role) or all users with that role? The brief (§2.2) says "notifica a quien debe firmar el cierre" — resolving to a specific individual vs. a role-wide broadcast affects whether `Notificacion.usuarioId` ever needs to be plural. Recommendation: broadcast to all matching-role users found via `getUsersStore()`, since QE fixtures don't currently assign a specific "designated signer" distinct from role membership — flagging for confirmation before `tasks.md` locks the handler shape.
- Should the Operario dashboard's "Notificaciones pendientes" section show all notification types or only ones relevant to an Operario's typical role (state-change on their own reports, not e.g. document revisor assignments they'd never receive anyway)? Recommendation: no extra filtering beyond "this user's own `usuarioId`" — role-appropriateness is already guaranteed by RN-NOTIF-001/002/003's recipient rules, so a second filter layer would be redundant.
