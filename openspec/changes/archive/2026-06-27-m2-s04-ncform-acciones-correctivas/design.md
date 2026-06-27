## Context

M2 Specs 1–3 established the full data layer (types, schemas, API client, MSW handlers, TanStack Query hooks) and the read-only NCList view with URL-driven filters, pagination, and status/severity badges. The shared components `DeadlineBadge`, `FilterBar`, and `Pagination` were also delivered in the S03 corrections change.

What remains is the write path: a form to create/edit NCs, a detail page that exposes contextual actions and Acciones Correctivas management, and the annulment flow. All mutations (`useCreateNonconformity`, `useAnularNonconformity`, `useCreateAccionCorrectiva`, `useUpdateAccionCorrectiva`, `useCerrarAccionCorrectiva`) are already wired in S02 hooks. The permissions utility (`getNCPermissions`) exists from S01.

Constraints:
- No `useEffect` for state derivation.
- React Hook Form + Zod exclusively for forms.
- All strings via `t('nonconformities:...')`.
- Dates: `<input type="date">` for UI, ISO 8601 string internally and over the wire.
- MSW v2 `http.*` pattern only.
- The existing `NCStatus` type uses: `DETECTADA | EN_INVESTIGACION | EN_CORRECCION | PENDIENTE_CIERRE | CERRADA | REABIERTA`. The domain input calls for an `ANULADA` terminal state and an additional `NCDominio` dimension (`NC-CAL | NC-SST | NC-ADU | NC-OPE | NC-PRV`) not in S01 types — these must be added.

## Goals / Non-Goals

**Goals:**
- `NonconformityDetailPage` at `/nonconformities/:id` with full NC header, AC section, audit trail, and annulment trigger.
- `NCForm` for create (`/nonconformities/new`) and inline edit, covering all fields in the spec including domain-aware UX rules.
- `ACSection` embedded in the detail page with inline add-AC form and per-state transition buttons.
- `AnularNCModal` with justified text requirement (min 20 chars).
- Duplicate detection modal when server returns `warning: 'POSIBLE_DUPLICADO'`.
- `GET /api/users` MSW handler for the responsable picker.
- Extend `NCStatus` with `ANULADA` and `NCPermissions` with `canAnular`, `canAsignarAC`, `canCerrarAC`, `canVerAuditTrail`.
- Introduce `NCDominio` union and `AccionCorrectiva` / `ACStatus` types.
- Register `/nonconformities/:id` and `/nonconformities/new` routes with `RoleGuard`.
- Full i18n coverage for all new keys in es-PE / en-US.

**Non-Goals:**
- State machine transition flow beyond annulment (those transitions belong to M2-S05 or later).
- File upload for evidencia (UI-only, not wired to a real storage backend; mock URL suffices).
- QE linking from NC detail (belongs to M4).
- Pagination within AC section (NCs are expected to have ≤20 ACs in MVP; virtualization deferred).

## Decisions

### D1 — Extend NCStatus with ANULADA rather than a separate field

The spec requires ANULADA to show as a state badge and appear in `getNCPermissions` gating. Adding it to the `NCStatus` union is the cleanest extension: it fits the existing machine, `getNCPermissions` already receives the full NC, and handlers and fixtures just need a new state value.

Alternative: use a boolean `anulada: boolean` field. Rejected — breaks the single-state invariant and requires every consumer to check two things.

### D2 — Add NCDominio as a new union type (not repurpose NCTipo)

The form calls for `NC-CAL | NC-SST | NC-ADU | NC-OPE | NC-PRV` as a "dominio" dimension distinct from the existing `NCTipo` (`PROCESO | PRODUCTO | SERVICIO | SISTEMA | SST`). These are orthogonal: dominio is the organizational/regulatory bucket; tipo is the nature of the defect. Adding `NCDominio` and a `dominio` field to `NoConformidad` keeps both concepts clean.

The `requiereIPER` checkbox is derived: always `true` when `dominio === 'NC-SST'`, never editable by the user in that case. The form should force-set the value and disable the checkbox.

### D3 — Duplicate detection handled entirely in NCForm, not in the hook

`useCreateNonconformity` already shows a `toast.warning` when `warning === 'POSIBLE_DUPLICADO'` (from S02 spec). For the modal UX, `NCForm` will:
1. Call `mutate()` normally.
2. In `onSuccess`, inspect `data.warning`. If `POSIBLE_DUPLICADO`, open a local `useState` modal with `data.ncsSimilares` — do NOT navigate away.
3. The modal offers "Vincular a NC existente" (navigates to that NC) or "Guardar como nueva NC" (calls a second mutation with a `forzar: true` flag or navigates to the newly created NC).

This keeps the hook stateless and the modal logic self-contained in the form.

### D4 — ACSection is a standalone component, not a page section embedded via route

ACs are fetched as part of the `useNonconformity` detail response (`accionesCorrectivas` embedded). `ACSection` receives the NC detail and `ncId` as props; it uses `useCreateAccionCorrectiva(ncId)`, `useUpdateAccionCorrectiva(ncId)`, and `useCerrarAccionCorrectiva(ncId)`. No separate route or query key for AC list.

### D5 — AnularNCModal is a controlled modal triggered from NonconformityDetailPage

`NonconformityDetailPage` holds `useState<boolean>(false)` for modal visibility. The modal renders a RHF mini-form with a single `justificacion` textarea validated via a local Zod schema (`z.string().min(20)`). On submit, calls `useAnularNonconformity` then navigates to `/nonconformities` on success.

### D6 — Date inputs use native `<input type="date">` with ISO conversion at boundaries

Consistent with the approach validated in M2-S03. The `value` attribute receives an ISO date string sliced to `YYYY-MM-DD`, and the browser renders in locale format. `onChange` converts back to ISO before storing in RHF. No external date-picker library added.

### D7 — GET /api/users handler returns one fixture user per role

The responsable picker in ACSection needs a user list. A minimal `GET /api/users` handler returns six fixture users (one per role) to keep the mock realistic without adding noise. These users are added to a shared `users.fixtures.ts` file (or appended to the existing mocks index).

### D8 — NCPermissions extended with four new flags

`canAnular`, `canAsignarAC`, `canCerrarAC`, and `canVerAuditTrail` are added to the `NCPermissions` interface. This is a **breaking change** to the interface — all call sites of `getNCPermissions` return an object that now requires these four additional booleans. The implementation in `ncPermissions.ts` must be updated in the same commit.

Role matrix for new flags:
| Role | canAnular | canAsignarAC | canCerrarAC | canVerAuditTrail |
|---|---|---|---|---|
| OPERARIO | false | false | false | false |
| SUPERVISOR | false | true | false | true |
| JEFE_CALIDAD_SYST | true | true | true | true |
| AUDITOR_INTERNO | false | false | false | true |
| ALTA_DIRECCION | true | false | false | true |
| JEFE_CONTROL_DOCUMENTARIO | false | false | false | true |

`canAnular` is only meaningful when `nc.estado` is not `CERRADA`, `VERIFICADA`, or already `ANULADA`.

## Risks / Trade-offs

- **AccionCorrectiva types gap** → S02 referenced `AccionCorrectiva`, `ACStatus`, `CreateACInput`, etc. but they were never formally specified. This change must define them authoritatively in `nonconformity-types`. Risk of mismatch with S02 handler fixtures is low because fixtures used string literals. Mitigation: define types here, verify handler fixture shapes match.

- **NCPermissions breaking change** → Adding four required flags breaks any existing test that constructs an `NCPermissions` object directly. Mitigation: update `getNCPermissions` and all tests in the same task.

- **Duplicate modal UX complexity** → The "forzar: true" path requires either a second endpoint variant or a flag in the existing POST body. The MSW handler must handle this. Mitigation: define the `forzar` flag in `createNCSchema` as optional boolean and add a branch in the handler.

- **No real file upload** → `CerrarACInput.evidenciaUrl` accepts an optional URL string. The UI shows a file input but the mock handler returns a fake URL. Users testing the feature will see this inconsistency. Mitigation: document as MVP limitation; add a note in the form.

## Migration Plan

No database or API contract migration needed — backend does not exist yet. All changes are frontend-only against MSW.

Deployment order within this change:
1. Extend types (`nonconformity-types`) — must come before all other files.
2. Update `getNCPermissions` and its tests — must come before any component that uses permissions.
3. Add `users.fixtures.ts` and `GET /api/users` handler.
4. Implement `NCForm`, `AnularNCModal`, `ACSection`.
5. Implement `NonconformityDetailPage` and `NonconformityNewPage`.
6. Register routes.
7. Add i18n keys.
