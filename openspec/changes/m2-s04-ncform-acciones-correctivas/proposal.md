## Why

M2 Spec 4 completes the authoring and operational side of the No Conformidades module. After Specs 1–3 delivered types, schemas, API layer, MSW infrastructure, and the read-only NCList, the system still has no way to create a new NC, view its detail, manage Acciones Correctivas, or annul a NC — leaving the module functionally incomplete for all roles.

## What Changes

- Add `NonconformityDetailPage` page component at `/nonconformities/:id` with skeleton loading, error retry, NC header (readonly), contextual action buttons, AC section, and collapsible audit trail.
- Add `NCForm` component for create (`/nonconformities/new`) and edit flows, using React Hook Form + existing Zod schemas from M2-S01, with all domain-aware UX (NC-SST IPER warning, NC-ADU notification warning, duplicate-detection modal).
- Add `ACSection` component embedding the Acciones Correctivas list inline in the detail page, with inline create form and per-AC state transition buttons.
- Add `AnularNCModal` component for the annulment flow requiring justified free text.
- Extend `nonconformity-types` with `AccionCorrectiva`, `ACStatus`, `CreateACInput`, `UpdateACInput`, and `CerrarACInput` types needed by ACSection and hooks — these were referenced in S02 specs but not formally required yet.
- Extend `nc-msw-handlers` with `GET /api/users` (user picker mock) and verify AC sub-resource handlers are present.
- Register routes `/nonconformities/:id` and `/nonconformities/new` in the router with `RoleGuard`.
- Add i18n keys for all new UI strings in `es-PE.json` and `en-US.json`.

## Capabilities

### New Capabilities

- `nc-detail-page`: Full NC detail view — header, contextual actions, AC section, audit trail, annulment modal.
- `nc-form`: Create/edit NC form with domain-aware validations, duplicate detection modal, and business rule warnings.
- `ac-section`: Inline Acciones Correctivas management inside NC detail — create, state transitions, evidence closure modal.

### Modified Capabilities

- `nonconformity-types`: Adding `AccionCorrectiva` interface, `ACStatus` union, and `CreateACInput` / `UpdateACInput` / `CerrarACInput` input types referenced but not formally specified in S02.
- `nc-msw-handlers`: Adding `GET /api/users` handler and verifying coverage for AC sub-resource endpoints.
- `routing`: Adding `/nonconformities/:id` and `/nonconformities/new` routes with RoleGuard.

## Impact

- **New files**: `NonconformityDetailPage.tsx`, `NCForm.tsx`, `ACSection.tsx`, `AnularNCModal.tsx` (all in `src/features/nonconformities/`), plus page-level `NonconformityNewPage.tsx` if the create form warrants its own page wrapper.
- **Modified files**: `nonconformity.types.ts` (new AC types), `nonconformities.handlers.ts` (GET /api/users), `App.tsx` or router config (new routes), `es-PE.json` / `en-US.json` (new keys).
- **Dependencies already available**: `getNCPermissions`, all query hooks (`useNonconformity`, `useCreateNonconformity`, `useAnularNonconformity`, `useCreateAccionCorrectiva`, `useUpdateAccionCorrectiva`, `useCerrarAccionCorrectiva`), `DeadlineBadge`, `FilterBar`, `Pagination`, `NCStatusBadge`, `SeverityBadge`.
- No breaking changes to existing NCList or filter functionality.
