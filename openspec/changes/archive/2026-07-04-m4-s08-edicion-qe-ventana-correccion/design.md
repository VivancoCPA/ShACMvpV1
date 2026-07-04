## Context

M4-S03 shipped `QualityEventList` with an Acciones column that already renders a `Ver` icon for every row, but the "Editar" icon was left unspecified — it doesn't exist in any archived M4 spec, even though `quality-event-permissions` already defines a `puedeEditarCabecera` flag (ABIERTO-only, creator/Supervisor-or-JefeCalidad) that nothing currently consumes for an edit affordance. SHAC-PRD-003-ADD-04 introduces three separate edit rules (RN-QE-010/011/012) that don't map cleanly onto the existing single-flag model: RN-QE-010 is time-boxed and role-scoped to the reporter/supervisor, while RN-QE-011/012 are role-scoped to `JEFE_CALIDAD_SYST` with no time limit and a different state ceiling (`< CERRADO` vs. `ABIERTO`-only). This design reconciles the three rules into one icon and one (or two) edit surfaces, without touching the existing `puedeEditarCabecera` flag or any other consumer of `getQualityEventPermissions`.

No backend exists; this module is 100% MSW-mocked, so "server-side" enforcement below means the MSW handler layer.

## Goals / Non-Goals

**Goals:**
- One deterministic function (`puedeEditarQE`) that decides whether the Acciones icon renders at all, matching the three-row truth table in the proposal exactly.
- A single icon and a single flow even when a user qualifies under both RN-QE-010 and RN-QE-011/012 simultaneously (double-role case).
- Field-level enforcement that mirrors the icon-visibility rule exactly, both client-side (disabled/hidden inputs) and MSW-side (payload rejection), so manipulating the request body cannot unlock a field the UI wouldn't have allowed.
- Reuse of the existing `QualityEventForm` component for the RN-QE-010 (and combined) path instead of building a parallel form, since the field set largely overlaps the creation form.

**Non-Goals:**
- Does not change `getValidQETransitions`, the QE state machine, or any existing transition button.
- Does not touch `puedeEditarCabecera` or any other existing `QEPermissions` flag — `puedeEditarQE` is additive and lives alongside it.
- Does not implement a real ≤2-minute/≤2-hour notification delivery mechanism (SMS/email/push) — as with RN-QE-005 at creation, this only means "compute `requiereNotificacionUrgente`-equivalent flag and show/append the same in-app affordance already used for creation," not a new notification channel.
- Does not add area-based row filtering to `QEListFilters` (out of scope, unrelated to editing).

## Decisions

### 1. `puedeEditarQE` is a thin boolean wrapper over a richer internal resolver

`puedeEditarQE(qe: QualityEvent, usuario: UsuarioActual, ahora: Date = new Date()): boolean` lives in `src/features/quality-events/utils/qualityEventPermissions.ts`, alongside `getQualityEventPermissions`. Internally it delegates to a non-exported `resolveQEEditAccess(qe, usuario, ahora)` that returns:

```ts
interface QEEditAccess {
  reporteInicial: boolean; // RN-QE-010
  severidad: boolean;      // RN-QE-011
  mineral: boolean;        // RN-QE-012
}
```

`puedeEditarQE` returns `reporteInicial || severidad || mineral`. The richer shape is exported too (as `resolveQEEditAccess`) because the list row and the icon's click handler both need to know *which* rules matched, not just whether at least one did — that routing decision (full form vs. reduced modal vs. combined) can't be made from a single boolean without re-deriving the same three checks a second time at the call site.

`ahora` defaults to `new Date()` so every existing call site keeps the exact 2-arg shape the proposal specifies (`puedeEditarQE(qe, usuario)`), while tests pass a fixed third argument — the same pattern `estaVencidaVerificacion(qe, hoy)` already uses, just with a default so production code never has to thread "now" through the component tree.

**Alternative considered:** a single flat boolean with no internal breakdown, and re-deriving the window/role checks again in the click handler. Rejected — duplicating the RN-QE-010 time-window arithmetic in two places is exactly the kind of drift this consolidation is meant to prevent.

### 2. `usuario` shape

`UsuarioActual` is `Pick<User, 'id' | 'rol' | 'areasAsignadas'>` (the shape already available on `authStore.user`) — no new user-fixture lookups are introduced. `areasAsignadas: string[]` is a dedicated field on `User` (relevant only for `rol === 'SUPERVISOR'`) that lists the areas a Supervisor is assigned to oversee for QE purposes — distinct from `area`, which is the user's own home department and is NOT used for this check. `resolveRolSegundaFirma`'s existing `id`+`area` match for "is this user the area's Supervisor" is a separate business rule (dual-signature escalation) and is intentionally left untouched by this decision.

### 3. RN-QE-010 window check

```ts
function ventanaReporteInicialAbierta(qe: QualityEvent, ahora: Date): boolean {
  if (qe.estado !== 'ABIERTO') return false;
  const transcurridoMs = ahora.getTime() - new Date(qe.fechaHoraReporte).getTime();
  return transcurridoMs <= 2 * 60 * 60 * 1000;
}
```
`reporteInicial` is `true` when this window is open **and** (`usuario.id === qe.reportadoPorId` **or** (`usuario.rol === 'SUPERVISOR' && (usuario.areasAsignadas ?? []).includes(qe.areaAfectada)`)).

### 4. RN-QE-011 / RN-QE-012 checks

```ts
const ANTES_DE_CERRADO: QEStatus[] = ['ABIERTO', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE'];
```
`severidad` is `true` when `usuario.rol === 'JEFE_CALIDAD_SYST' && ANTES_DE_CERRADO.includes(qe.estado)`. `mineral` is the same role/state check plus `(qe.tipo === 'CALIDAD' || qe.tipo === 'OPERACIONAL')`. `EN_VERIFICACION`, `CERRADO`, `VERIFICADO`, and `REABIERTO`-as-audit-marker are excluded — "cualquier estado anterior a CERRADO" is read as the five states strictly before `CERRADO` in the happy-path lifecycle; once a cycle reopens, `estado` returns to `EN_INVESTIGACION`, which is still in the allowed set, so a reopened QE remains editable by `JEFE_CALIDAD_SYST` as expected.

### 5. Icon routing (single icon, up to three destinations)

The Acciones column computes `resolveQEEditAccess(qe, usuario)` once per row. If none of the three flags are true, no icon renders (RN-QE-010/011/012 truth table from the proposal). If at least one is true, exactly one icon renders, and its `onClick` routes by flag combination:

| `reporteInicial` | `severidad`/`mineral` | Destination |
|---|---|---|
| `true` | `false` | `QualityEventForm` in edit mode, RN-QE-010 field set only (`severidad` locked) |
| `true` | `true` | Same `QualityEventForm` edit mode, RN-QE-010 field set **plus** `severidad` and/or `mineralInvolucrado` unlocked per whichever of RN-QE-011/012 matched |
| `false` | `true` | `QEEditSeveridadMineralModal` (new, reduced — only `severidad` and/or `mineralInvolucrado`, whichever flag(s) matched) |

This satisfies the double-role acceptance criterion (single icon, single combined form) without introducing a fourth "combined modal" component — the combined case is just `QualityEventForm`'s edit mode with one extra field unlocked, since `mineralInvolucrado` is already part of the RN-QE-010 field set and `severidad` is the only field RN-QE-011 adds that RN-QE-010 doesn't already cover.

**Alternative considered:** always open the full form and just vary which fields are locked, even for the modal-only case. Rejected — a `JEFE_CALIDAD_SYST` who is neither creator nor area Supervisor and well past the 2h window has no business seeing `descripcion`/`areaAfectada`/`turno`/`fechaHoraEvento` as visually-present-but-locked fields; the reduced modal keeps the surface area honest about what's actually being changed.

### 6. `QualityEventForm` edit mode

`QualityEventForm` gains an optional `qe?: QualityEvent` prop (or is mounted at a new route `/quality-events/:id/editar` that loads it via `useQualityEvent(id)` — either works; recommend the route so the icon's `onClick` is a plain `navigate()` like the existing `Ver` action, keeping `QualityEventList` free of modal-state management for this path). When `qe` is present:
- The form initializes via `useForm` with `defaultValues` from the loaded QE instead of empty defaults.
- `numero`, `origen`, `tipo`, `fechaHoraReporte` (labeled "Fecha de reporte"), and the reporter's display name render as read-only text, never as editable inputs — not merely `disabled` form fields, so no payload can reintroduce them.
- Submit calls `useEditarReporteInicial().mutate({ id, data })` instead of `useCreateQualityEvent`, with `data` restricted by `qualityEventEditReporteInicialSchema` (a strict Zod object with no passthrough, so any extra key — including `numero`/`origen`/`fechaHoraReporte`/`reportadoPorId` — is stripped before the request leaves the client, and rejected again server-side per Decision 8).
- On success, navigates back to `/quality-events/:id` (not to a freshly-created id) and shows `toast.success`.

### 7. `QEEditSeveridadMineralModal`

New component, `src/features/quality-events/components/QEEditSeveridadMineralModal.tsx`, rendered inline from `QualityEventList` (a lightweight modal, not a route, since it only ever touches 1–2 fields). Renders `severidad` select when `access.severidad`, `mineralInvolucrado` select when `access.mineral`, each defaulting to the QE's current value. On submit, fires one or both of `useEditarSeveridad().mutate(...)` / `useEditarMineral().mutate(...)` (sequential, not parallel, so audit-trail ordering is deterministic), then closes and invalidates the QE detail/list queries. Shows the same RN-QE-005 warning banner pattern as `QualityEventForm` when the new `severidad` value is `CRITICA`.

### 8. MSW endpoints re-validate everything

`PATCH /:id/editar-reporte-inicial`, `PATCH /:id/editar-severidad`, `PATCH /:id/editar-mineral` each independently re-check the role/state/time-window/tipo conditions from Decisions 3–4 against the fixture QE and the `X-User-*` mock-auth context already used by other QE endpoints (same pattern as the existing `firmar-cierre` handler's role check) — a client that skips the UI and calls the endpoint directly with a stripped-down or forged body still gets a 422/403, never a silent field write. `editar-reporte-inicial` additionally 422s if the request body contains any of `numero`, `origen`, `tipo`, `fechaHoraReporte`, `reportadoPorId` (defense in depth beyond the Zod strict-object stripping on the client).

### 9. Audit trail entries carry a diff

All three endpoints append a `QEAuditTrailEntry` whose `campoModificado`/`valorAnterior`/`valorNuevo` are set per changed field (`QE_REPORTE_INICIAL_EDITADO` may append multiple entries in one request — one per changed field — or a single entry summarizing all changed fields; recommend one entry per changed field, consistent with how `quality-event-audit-trail`'s existing fixtures already model a "campo editado" entry as single-field). `QE_SEVERIDAD_EDITADA` and `QE_MINERAL_EDITADO` are always single-field by construction.

## Risks / Trade-offs

- [Two time sources: client checks the 2h window for icon visibility, MSW re-checks it for the mutation] → Both read from the same `fechaHoraReporte` and compute the same threshold; because MSW handlers run in-process in the same browser tab (no real network clock skew), there's no practical drift, but if `ventanaReporteInicialAbierta` is ever duplicated instead of imported into the handler, the two could diverge — task list should call out reusing the same function from `qualityEventPermissions.ts` in the handler.
- [Combined-role field-unlock logic lives in the click-handler routing table, not inside `QualityEventForm` itself] → If `QualityEventForm` is later reused elsewhere without going through `QEList`'s routing, the "unlock severidad when combined" behavior could be missed. Mitigation: `QualityEventForm` derives its own unlocked-field set from `resolveQEEditAccess(qe, usuario)` internally when `qe` is present, rather than trusting a prop passed down from the list — the list's routing table only decides *which component* to open, not which fields within it are unlocked.
- [Reduced modal duplicates some of `QualityEventForm`'s CRITICA-banner and mineral-select markup] → Acceptable, small (two fields); extracting a shared `SeveridadSelect`/`MineralSelect` pair is a reasonable follow-up but not required for this change.

## Open Questions

- Whether `QE_REPORTE_INICIAL_EDITADO` should append one audit entry per changed field or a single multi-field entry — resolved above in favor of one-per-field for consistency with existing fixtures, but confirm against the actual fixture data once `quality-event-audit-trail`'s delta spec is drafted.
