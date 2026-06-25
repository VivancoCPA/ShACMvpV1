## Why

M1 Control Documentario requires a shared type layer before any API, UI, or mock work can begin. Without strict TypeScript types, Zod schemas, state-transition constants, and a permissions helper, every subsequent spec risks diverging from the business rules defined in CLAUDE.md — especially RN-DOC-001..006 and the RBAC matrix.

## What Changes

- Add `src/types/documents.types.ts` — `DocStatus`, `DocType`, `DocRole` unions; `Documento`, `VersionEntry`, `AuditTrailEntry` (document-scoped), and `DocFilters` interfaces.
- Add `src/features/documents/schemas/createDocument.schema.ts`, `updateDocument.schema.ts`, `changeDocumentStatus.schema.ts` — Zod schemas + inferred input types.
- Add `src/features/documents/constants.ts` — `QUERY_KEYS.documents`, `DOC_STATUS_COLORS`, `DOC_STATUS_TRANSITIONS`.
- Add `src/features/documents/permissions.ts` — `getDocumentPermissions(estado, rol)` implementing the full RBAC matrix for M1.
- Add Vitest unit tests co-located with each source file.

No API clients, MSW handlers, hooks, or React components are created in this spec.

## Capabilities

### New Capabilities

- `document-types`: Core TypeScript types for the document domain (`DocStatus`, `DocType`, `DocRole`, `Documento`, `VersionEntry`, `AuditTrailEntry`, `DocFilters`).
- `document-schemas`: Zod validation schemas for create, update, and status-change operations, enforcing business rules at the input boundary.
- `document-constants`: Query key factory, status color map, and state-transition adjacency map reflecting the M1 lifecycle.
- `document-permissions`: Pure function `getDocumentPermissions` returning a permissions object for a given state × role combination, enforcing the full M1 RBAC matrix including RN-DOC-003 (OBSOLETO read-only for all).

### Modified Capabilities

## Impact

- `src/types/` — new file consumed by all future M1 hooks, components, and API clients.
- `src/features/documents/` — new subdirectory with schemas, constants, and permissions helpers; downstream specs (Spec 2+) import from here.
- No breaking changes to existing code (scaffold only; no existing document feature code).
