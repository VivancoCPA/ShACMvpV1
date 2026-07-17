## Why

"Reemplazar archivo original" on `DocumentDetailPage` currently navigates to `/documents/:id/edit` (`DocumentDetailPage.tsx:194`), a route that legitimately only supports `BORRADOR` documents. To let the button work in `EN_REVISION` too (RN-DOC-018), a "restricted edit mode" was bolted onto `DocumentFormPage` (`DocumentFormPage.tsx:60`) that reaches the edit route in `EN_REVISION` with every field disabled except the archivo original upload. This couples an unrelated full metadata-edit form to a single-purpose file-replace action, and it already caused one adjacent bug (Revisor/Aprobador could reach `/no-autorizado` via a button that should never have rendered for them, fixed separately in `permissions.ts`). The main spec `openspec/specs/document-detail/spec.md` was already updated with the target design (a dedicated modal, no navigation to `/edit`) via a direct sync; this proposal formalizes that already-decided design into an implementable change.

## What Changes

- Add a dedicated modal component for replacing the archivo original file, scoped exclusively to the file upload — no other document metadata field is exposed.
- `DocumentDetailPage.tsx`'s "Reemplazar archivo original" button stops navigating to `/documents/:id/edit`; it opens the new modal instead.
- Revert `DocumentFormPage.tsx`'s restricted-edit-mode addition: the edit form goes back to being strictly `BORRADOR`-only, matching the existing (unchanged) `document-form` spec requirement "Edit mode blocks non-BORRADOR documents". It is no longer responsible for uploading or replacing the archivo original.
- Rewrite `src/router/documentReplaceOriginal.test.tsx`, which currently asserts the old navigate-to-edit behavior, to cover the new modal flow instead.
- No changes to `permissions.ts` (`canViewArchivoOriginal`/`canReplaceArchivoOriginal` gating logic is already correct) or to RN-DOC-013/015/016 confidencialidad/freeze guards.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `document-detail`: formalizes the "Reemplazar archivo original dedicated action (RN-DOC-018)" requirement (scenarios CA-DOC-5/6/7) already present in the main spec — this delta is a no-op confirmation so the change has a traceable target for implementation, not a new design decision.

## Impact

- `src/features/documents/components/` — new dedicated modal component (e.g. `DocumentReplaceArchivoOriginalModal.tsx`)
- `src/features/documents/pages/DocumentDetailPage.tsx` (archivo original button wiring)
- `src/features/documents/pages/DocumentFormPage.tsx` (remove restricted-edit-mode, revert to BORRADOR-only)
- `src/router/documentReplaceOriginal.test.tsx` (rewrite for modal flow)
- Possibly `src/features/documents/hooks/useDocumentActions.ts` if a new mutation hook is needed for the modal's replace action (reuse existing archivo-original replace mutation if one already exists)
- No breaking changes; no new routes; no RBAC changes.
