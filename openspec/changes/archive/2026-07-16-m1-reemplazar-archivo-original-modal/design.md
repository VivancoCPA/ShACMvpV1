## Context

`DocumentDetailPage.tsx:191-199` renders "Reemplazar archivo original" gated by `perms.canReplaceArchivoOriginal`, and today it navigates to `/documents/:id/edit`. `DocumentFormPage.tsx:56-64` computes `canReplaceOriginalOnly` and, when true, allows reaching the edit route in `EN_REVISION` with every field except the archivo original disabled (`DocumentForm`'s `restrictToArchivoOriginal` prop). The actual file upload already goes through a dedicated endpoint independent of the rest of the form: `useDocumentForm.ts`'s `onSubmit` does a `PUT /api/documents/:id` for the full payload (all fields, even disabled ones, since RHF still holds their current values) **and**, separately, if `archivoOriginalFile` is set, `POST /api/documents/:id/archivo-original` as multipart `FormData`. The MSW handler for that POST (`documents.handlers.ts:991-1022`) already updates `archivoOriginalUrl`/`archivoOriginalNombre` and appends `ARCHIVO_ORIGINAL_ACTUALIZADO` to `auditTrail` (RN-DOC-018) — this is the exact behavior CA-DOC-7 (already in `document-detail/spec.md`) requires, and it works regardless of who calls it.

This means the "restricted edit mode" only exists to shuttle the user to a form that happens to contain the file input — the redundant full-document `PUT` it also fires on every archivo-original-only replace is pure waste (and a `DocumentFormPage` quirk unrelated to the actual RN-DOC-018 requirement). A dedicated modal can call the existing `POST /api/documents/:id/archivo-original` endpoint directly and skip the PUT and the edit-route detour entirely.

## Goals / Non-Goals

**Goals:**
- "Reemplazar archivo original" opens a modal scoped to just the file upload, in both `BORRADOR` and `EN_REVISION`, without navigating to `/documents/:id/edit`.
- The modal calls the existing `POST /api/documents/:id/archivo-original` endpoint directly (no new MSW handler needed).
- `DocumentFormPage`/`DocumentForm` revert to being strictly `BORRADOR`-only, matching the already-existing (unchanged) `document-form` spec requirement "Edit mode blocks non-BORRADOR documents" — `restrictToArchivoOriginal`, `canReplaceOriginalOnly`, and the related props/UI are removed as dead code once the modal takes over.
- `documentReplaceOriginal.test.tsx` is rewritten to assert the modal flow.

**Non-Goals:**
- No change to `permissions.ts` (`canViewArchivoOriginal`/`canReplaceArchivoOriginal` gating is already correct — AUTOR/JEFE_CALIDAD only, blocked when `archivoOriginalBloqueado`).
- No change to the MSW handler for `POST /api/documents/:id/archivo-original` or its audit trail entry — already correct.
- No change to RN-DOC-013/015/016 confidencialidad or freeze/lock rules.
- No new router route.

## Decisions

**1. New modal component `DocumentReplaceArchivoOriginalModal.tsx`, calling the archivo-original endpoint directly — not reusing `DocumentForm`.**
The modal renders only a file input (can reuse the same underlying file-input UI primitive `DocumentForm` uses for `archivoOriginalFile`, e.g. by extracting/sharing the small file-picker bit if trivial, but does not render `DocumentForm` itself or go through react-hook-form/Zod for the full document schema). On confirm, it calls a new `useReplaceArchivoOriginal(documentId)` mutation hook (in `useDocumentActions.ts`) that POSTs `FormData` with the file directly to `/api/documents/:id/archivo-original` (same call `useDocumentForm.ts` already makes), then invalidates `QUERY_KEYS.documents.detail(documentId)` so the detail page re-renders with the new `archivoOriginalUrl`/`archivoOriginalNombre` and the new audit trail entry, and closes the modal.
*Alternative considered*: keep routing through `DocumentForm` in a stripped-down mode. Rejected — that's the current design being replaced; it drags in the full Zod schema and a redundant `PUT` for no benefit, and the proposal explicitly calls for a modal that exposes no other metadata field.

**2. Modal shows the current file name before replacing.**
If `documento.archivoOriginalUrl` is set, the modal displays `documento.archivoOriginalNombre` (already present on `Documento`) above the upload control, e.g. "Archivo actual: `REG-CD-001-v1.0.docx` — subir uno nuevo lo reemplazará", satisfying the proposal's requirement to make the replacement explicit.

**3. `DocumentDetailPage.tsx` owns modal open/close state.**
A local `showReplaceOriginalModal` boolean (sibling to the existing `showPdfPreview`-style local state pattern already used in `DocumentActionPanel.tsx`) replaces the `onClick={() => navigate(...)}` handler at line 194. On successful replace, the modal's `onSuccess` closes itself; no navigation occurs — the user stays on the detail page and sees the updated file name/audit entry inline.

**4. Revert `DocumentFormPage`/`DocumentForm` to BORRADOR-only, remove restricted-mode plumbing.**
Delete `canReplaceOriginalOnly` and its branch in `DocumentFormPage.tsx`, the `restrictToArchivoOriginal`/`existingArchivoOriginalNombre`/`archivoOriginalBloqueado` props threaded into `DocumentForm` purely for that mode (keep whichever of these `DocumentForm` still legitimately needs for its own BORRADOR-only archivo-original field, e.g. showing the frozen badge — only remove what existed solely to support the EN_REVISION detour), and the `form.info_solo_archivo_original` banner. The edit-blocked screen (`form.error_not_borrador`) becomes unconditional again for any non-BORRADOR document, per the unchanged `document-form` spec.

## Risks / Trade-offs

- **[Risk]** `useReplaceArchivoOriginal` duplicates a bit of the multipart-FormData-POST logic already inlined in `useDocumentForm.ts` → **Mitigation**: acceptable per-project convention (no premature shared abstraction for two call sites); if `useDocumentForm.ts`'s inline POST and the new hook drift, that's a two-call-site duplication, not a three-plus one that would justify extraction.
- **[Risk]** Removing `restrictToArchivoOriginal` from `DocumentForm` could be mistaken for a regression by anyone reading git blame later → **Mitigation**: the proposal and this design record why (dedicated modal supersedes it); no code comment needed beyond what's already in the rewritten test file.
- **[Risk]** `documentReplaceOriginal.test.tsx` currently encodes the *old* contract as a regression test; rewriting it risks silently dropping the original regression coverage (SUPERVISOR-as-Revisor dead-end) it also carries → **Mitigation**: keep the first `describe` block (`archivo original access by role`, RN-DOC-013) unchanged — it's still valid and unrelated to navigation — and only rewrite the second block (`RN-DOC-018` navigation assertion) to open-modal assertions.

## Migration Plan

No data migration. Frontend-only change (component/hook rewiring); the MSW handler and `Documento` shape are untouched. Rollout is a normal frontend deploy; rollback is reverting the commit.
