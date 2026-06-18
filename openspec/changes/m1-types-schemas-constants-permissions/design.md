## Context

M1 Control Documentario is the first active feature module of SHAC. Before any API, hook, or component work can happen, a shared type layer must exist that all downstream code imports from. This spec establishes that layer: TypeScript types, Zod schemas, state-transition constants, and a pure permissions helper.

The backend (.NET 10) does not yet exist; MSW will handle all data in development. This spec does NOT create MSW handlers — it only creates the contracts those handlers will later satisfy.

Current state: `src/features/documents/` is an empty directory. `src/types/` contains only global types.

## Goals / Non-Goals

**Goals:**
- Define the complete TypeScript type surface for the document domain (`DocStatus`, `DocType`, `DocRole`, `Documento`, `VersionEntry`, `AuditTrailEntry`, `DocFilters`).
- Provide Zod schemas for the three document mutation surfaces: create, update, status-change.
- Encode the M1 state machine and RBAC matrix as importable constants / pure functions.
- Achieve 100% permission-matrix coverage in Vitest unit tests.
- Enforce RN-DOC-001..006 at the type/schema/permission level wherever possible.

**Non-Goals:**
- API clients (`*.api.ts`), TanStack Query hooks, MSW handlers — deferred to Spec 2.
- React components, pages, or UI — deferred to Spec 3+.
- `AuditTrailEntry` mutations or persistence — read-only shape definition only.
- Run-time enforcement of RN-DOC-004 (PIN/password flow) — UI concern.

## Decisions

### D1 — Single types file vs. co-located types
**Decision:** Place domain types in `src/types/documents.types.ts` (global types dir) rather than inside `src/features/documents/`.
**Rationale:** `Documento` is imported by QE (`documentosVinculados`), dashboard, and future modules. Co-locating in `features/documents/` would force cross-feature imports from a sibling feature directory, violating the layering convention. Global `src/types/` is already the project's convention for shared domain types.

### D2 — Union types vs. TypeScript enums for DocStatus / DocType
**Decision:** Use string literal union types (`type DocStatus = 'BORRADOR' | ...`) not `enum`.
**Rationale:** String unions serialize identically to JSON backend values, are narrowable without import ceremony, and align with the existing `QEStatus` type in CLAUDE.md. Enums introduce indirection with no benefit in a pure frontend codebase.

### D3 — Permissions as a pure function vs. record lookup table
**Decision:** `getDocumentPermissions(estado, rol)` is a pure function with an explicit `switch` or nested record; NOT a flat `PERMISSIONS[estado][rol]` two-level lookup.
**Rationale:** A pure function is easier to test exhaustively (jest/vitest parameterized test table), is type-safe on both inputs, and makes it trivial to add logging or future role-override logic. The RBAC matrix has only 5 states × 5 roles = 25 cells — no need for dynamic dispatch.

### D4 — Zod schema location
**Decision:** Schemas live in `src/features/documents/schemas/` (three separate files, one per operation).
**Rationale:** Follows the project convention in CLAUDE.md. Separating by operation keeps files small, makes tree-shaking trivial, and avoids re-exporting a monolithic schema barrel that would pull Zod into every consumer.

### D5 — `DOC_STATUS_TRANSITIONS` shape
**Decision:** `Record<DocStatus, DocStatus[]>` — each key maps to the array of valid next states.
**Rationale:** Allows O(1) validation (`transitions[current].includes(next)`) and is self-documenting. The state machine has 6 states with sparse transitions; a full adjacency matrix would be wasteful.

## Risks / Trade-offs

- **[Risk] Type drift with backend** → Mitigation: types are the single source of truth; when the .NET API is built, its DTOs must match these types. A future Spec will add an API integration test to catch drift.
- **[Risk] Permission matrix correctness** → Mitigation: unit tests cover all 25 state×role cells explicitly; CI enforces green tests.
- **[Risk] `EN_REVISION_PERIODICA` state missing from RBAC table in CLAUDE.md** → Mitigation: treat it identically to `EN_REVISION` for permission purposes (same actors, same actions). Document this in a code comment.
