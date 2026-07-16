## Context

`src/mocks/fixtures/users.fixtures.ts` exports `userFixtures: User[]` (8
entries) and a derived `USER_NOMBRE_MAP: Record<string, string>`. It was
built as a "cast of characters" for display purposes but was never kept in
sync with `src/mocks/fixtures/auth.fixtures.ts` (`authFixtures: MockUser[]`,
~11 entries), which is the catalog actually served by `GET /api/users`
(`users.handlers.ts`) and used for `/auth/login`. Only 4 IDs
(`user-004`, `user-005`, `user-auditor-001`, `user-autor-001`) exist in both
files — and even those don't always share the same `area` string.

Confirmed direct consumers of `userFixtures`/`USER_NOMBRE_MAP` (verified
against current source, 2026-07-14):

| Site | Access pattern | Failure mode when ID is real/non-legacy |
| --- | --- | --- |
| `qualityEventPermissions.ts:131` (`resolveRolSegundaFirma`) | `userFixtures.find(u => u.id === primerFirmanteId)` | `firmante` is `undefined` → function silently falls through to `'SUPERVISOR'`, **skipping** the RN-QE-004 escalation to `ALTA_DIRECCION` |
| `NonconformityDetailPage.tsx:230` | `userFixtures.find(u => u.id === nc.detectadoPorId)` | `u` is `undefined` → the "Detectado por" row is omitted from the DOM entirely |
| `QEHeaderSection.tsx:30` | `userFixtures.find(...)` | "Reportado por" renders blank/falls back to raw ID |
| `QEInvestigationSection.tsx:208` | `userFixtures.find(...)` | "Causa raíz aprobada por" renders blank/raw ID |
| `QualityEventForm.tsx:373` | `USER_NOMBRE_MAP[qe.reportadoPorId] ?? qe.reportadoPorId` | Falls back to raw ID string in read-only view |
| `quality-events.handlers.ts:337` | `USER_NOMBRE_MAP[responsableId] ?? 'Usuario'` | **Persists** the literal string `'Usuario'` into the AC record — permanent data corruption in the mock store |
| `nonconformities.handlers.ts:356` | same pattern | same corruption |
| `incidents.handlers.ts:359-360` | `userFixtures.find(...)`, then reads `.nombre`/`.apellido` | Persists `undefined`/raw ID fragments into the AC record |
| `quality-events.fixtures.ts:9,365` (`nombrePor`) | `USER_NOMBRE_MAP[id] ?? id` | Used by `REPORTEROS_ROTACION` (`['user-001','user-002','user-003','user-005','user-008']`) — note `user-005` already has a real `authFixtures` login, so a naive "only fix real accounts" approach would still need to resolve it correctly here |

The `REPORTEROS_ROTACION` case is the reason the resolver can't simply be
"authFixtures or bust": it mixes one real-login ID (`user-005`) with four
login-less legacy IDs, and both must resolve correctly from the same call
site without the caller knowing which bucket an ID falls into.

## Goals / Non-Goals

**Goals:**
- Single source of truth for resolving a user ID to a display name in all
  mock code (fixtures, handlers, components).
- Zero behavior change for the 4 already-synced IDs and for real,
  non-legacy `authFixtures` accounts used going forward.
- Fix the 3 data-corruption sites (`responsableNombre` persistence) so they
  store a real, resolved name.
- Fix the 1 silent-escalation-skip site (RN-QE-004 second signature).
- Remove the parallel catalog (`users.fixtures.ts`) entirely — no partial
  deprecation, no re-export shim left behind.

**Non-Goals:**
- No change to any `RN-*` business rule, state machine, or role/permission
  matrix. `resolveRolSegundaFirma`'s comparison logic (`rol === 'SUPERVISOR'
  && area === areaAfectada`) is unchanged — only its data source changes.
- No migration of the 4 legacy IDs (`user-001/002/003/008`) to real
  `authFixtures` logins — confirmed out of scope by decision in proposal.md
  §2.
- No fix for the broader `TS2739` typing gap (~30 files with incomplete
  `User` literals) — tracked separately.
- No change to `GET /api/users` response shape or any production DTO.

## Decisions

### D1 — `resolveUserDisplayName` lives in a new fixtures-layer module, not a `utils/`

Location: `src/mocks/fixtures/userIdentity.fixtures.ts`, exporting:
- `seedLegacyNames: Record<string, { nombre: string; apellido: string }>`
  (the 4-entry fallback map)
- `resolveUserDisplayName(id: string): string`

Rationale: the function's only two data sources (`authFixtures`,
`seedLegacyNames`) are both fixture-layer concerns, and every current
consumer already imports fixtures from `src/mocks/fixtures/*`. Putting it in
`src/utils/` would suggest it's safe for production code to import, which it
is not (it's mock-only, keyed to mock IDs). Naming follows the existing
`*.fixtures.ts` convention so it sorts next to `auth.fixtures.ts` and the
file it replaces.

Alternative considered: add `resolveUserDisplayName` as a method on
`authFixtures`'s module (`auth.fixtures.ts`) directly. Rejected — that file
already has the `getUsersStore()` mutable-store concern from M6; keeping
name resolution as its own module keeps `auth.fixtures.ts` focused on the
login/session credential catalog.

### D2 — Resolution order is `authFixtures` → `seedLegacyNames` → raw ID, no caching

```ts
export function resolveUserDisplayName(id: string): string {
  const real = getUsersStore().find((u) => u.id === id)
  if (real) return `${real.nombre} ${real.apellido}`

  const legacy = seedLegacyNames[id]
  if (legacy) return `${legacy.nombre} ${legacy.apellido}`

  return id
}
```

Rationale: `authFixtures` is read through `getUsersStore()` (the existing
mutable-store accessor from `auth.fixtures.ts:167`), not a static import —
this matters because M6 admin CRUD can deactivate/rename a user at runtime,
and every resolution site should see that live state, matching the
cross-domain mutable-store pattern already established for MSW (never
import a static fixture array directly when a live store accessor exists).
The raw-ID fallback is intentionally kept (never throw) so a genuinely
unmapped ID degrades to today's "shows the ID" behavior instead of crashing
a page — but per proposal.md CA-05/CA-06, hitting that fallback during
verification is a signal of a missed consumer, not an accepted outcome.

Alternative considered: memoize resolved names in a `Map`. Rejected —
premature; the fixture arrays are small (≤15 entries) and MSW handlers
already run behind a simulated 400ms latency, so a `.find()` per call is not
a real cost.

### D3 — `seedLegacyNames` is a bare name map, not `User`-shaped

```ts
export const seedLegacyNames: Record<string, { nombre: string; apellido: string }> = {
  'user-001': { nombre: 'Ricardo', apellido: 'Flores' },
  'user-002': { nombre: 'Carlos', apellido: 'Mendoza' },
  'user-003': { nombre: 'María', apellido: 'Castro' },
  'user-008': { nombre: 'Roberto', apellido: 'Silva' },
}
```

Rationale: these 4 IDs are only ever read for display purposes inside
`REPORTEROS_ROTACION`-style seed generation. Modeling them as a full `User`
(with `rol`, `area`, `email`, etc.) would resurrect the exact "parallel
catalog that can drift" problem this change is removing — a shape mismatch
would be a type error, not a silent runtime failure, but it's still
unnecessary surface. Per proposal.md §3, this is confirmed with the user as
the intended minimal shape.

### D4 — Every consumer is rewired to call `resolveUserDisplayName`; no consumer keeps a local `.find()` over any user array

All 8 call sites plus the 2 fixture-generation helpers switch from
`userFixtures.find(...)`/`USER_NOMBRE_MAP[...]` to
`resolveUserDisplayName(id)`. Where a site needs more than the name (e.g.
`resolveRolSegundaFirma` needs `rol` and `area`, not just a display string),
it reads directly from `getUsersStore()` instead of calling
`resolveUserDisplayName` — the helper is display-name-only by design (see
proposal.md, `resolveUserDisplayName(id: string): string`). This keeps a
clean boundary: "give me a name" vs. "give me a user record" are different
needs and the second one was already being met correctly by reading real
user objects, just from the wrong catalog.

Concretely, `resolveRolSegundaFirma` changes from
`userFixtures.find(u => u.id === primerFirmanteId)` to
`getUsersStore().find(u => u.id === primerFirmanteId)` — same shape
(`MockUser` has `rol`/`area`), correct data source.

### D5 — `src/mocks/fixtures/index.ts` swaps its re-export, no transitional alias

`export { userFixtures, USER_NOMBRE_MAP } from './users.fixtures'` is
deleted and replaced with
`export { resolveUserDisplayName, seedLegacyNames } from './userIdentity.fixtures'`.
No deprecated re-export of the old names is kept, per the "no partial
deprecation" goal — grep confirms zero consumers outside the 8 sites +
fixtures listed in proposal.md, so a compile-time break is the correct
signal if a consumer was missed.

## Risks / Trade-offs

- **[Risk] A consumer of `userFixtures`/`USER_NOMBRE_MAP` was missed in the
  diagnosis** → Mitigation: deleting `users.fixtures.ts` outright turns any
  missed consumer into a TypeScript compile error (`tsc -p
  tsconfig.app.json`, CA-05) rather than a silent runtime gap — this is the
  reason the file is deleted rather than left in place unused.
- **[Risk] `resolveRolSegundaFirma`'s `area` string comparison depends on
  `authFixtures.area` matching `qe.areaAfectada` exactly, and area strings
  differ between the old and new catalogs (e.g. `'Operaciones'` vs.
  `'Almacén Norte'`)** → Mitigation: this comparison logic is unchanged by
  this design (D4) and is explicitly a non-goal; CA-01 requires manual
  verification with 2 real non-legacy accounts precisely to catch any area-
  string mismatch surfaced by switching data sources, without this change
  attempting to fix the matching rule itself.
- **[Risk] Existing unit test `qualityEventPermissions.test.ts` mocks
  `userFixtures` directly (`vi.mock` or similar) and will fail to compile
  once the import is removed** → Mitigation: explicitly called out in
  proposal.md Impact section and covered in tasks.md; test is updated to
  mock `authFixtures`/`getUsersStore()` instead, not skipped.
- **[Trade-off] Reading through `getUsersStore()` on every resolution call
  (no memoization) is slightly less efficient than a static map lookup** →
  Accepted: MSW mock latency (400ms/handler) dwarfs this, and correctness
  under live M6 admin mutations matters more than micro-optimizing an
  in-memory `.find()` over ≤15 items.

## Migration Plan

1. Add `seedLegacyNames.fixtures.ts` and `userIdentity.fixtures.ts`
   (additive, no existing code touched yet).
2. Rewire the 8 consumer sites + 2 fixture-generation helpers to the new
   helper, one domain at a time (M4 quality-events, then M2
   nonconformities, then M3 incidents) so each domain can be manually
   re-verified independently before moving to the next.
3. Update `qualityEventPermissions.test.ts` to mock the new source.
4. Delete `users.fixtures.ts` and its `index.ts` re-export in the same
   commit as the last consumer rewire, so there is never a window where
   both catalogs are live and a straggler import could silently pick the
   old one back up.
5. Run `tsc -p tsconfig.app.json` (CA-05) and the full test suite, then
   manually re-verify all 6 acceptance criteria in a real browser session
   with non-legacy accounts.

No rollback beyond `git revert` is needed — this is a mock-only, dev-time
data change with no persisted state, deployed backend, or external
dependency affected.

## Open Questions

None — all decisions in this design were either directly specified by the
user in proposal.md §2/§3 or resolved by reading the current source
(REPORTEROS_ROTACION's mixed real/legacy ID list, confirmed call sites and
line numbers).
