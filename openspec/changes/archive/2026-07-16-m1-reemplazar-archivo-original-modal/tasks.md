## 1. Modal component

- [x] 1.1 Create `DocumentReplaceArchivoOriginalModal.tsx` in `src/features/documents/components/`: file-input-only modal (`role="dialog"`, `aria-modal`), showing the current `archivoOriginalNombre` (if any) before accepting a new file, with confirm/cancel actions.
- [x] 1.2 Add i18n keys for the modal's title, current-file label, confirm/cancel labels (reuse existing `archivo.original.reemplazar` key for the trigger button; add new keys only for modal-specific copy) in `en-US.json` and `es-PE.json`.

## 2. Data layer

- [x] 2.1 Add `useReplaceArchivoOriginal(documentId)` mutation hook in `useDocumentActions.ts`: POSTs `FormData` (field `archivoOriginal`) to `/api/documents/:id/archivo-original` (same call already inlined in `useDocumentForm.ts`), invalidates `QUERY_KEYS.documents.detail(documentId)` and `QUERY_KEYS.documents.all` on success.

## 3. Wire the modal into DocumentDetailPage

- [x] 3.1 In `DocumentDetailPage.tsx`, replace the `onClick={() => navigate(`/documents/${documento.id}/edit`)}` handler (line ~194) on the "Reemplazar archivo original" button with local modal-open state, gated by the existing `perms.canReplaceArchivoOriginal` check (unchanged).
- [x] 3.2 Render `DocumentReplaceArchivoOriginalModal` conditionally on that state, wired to `useReplaceArchivoOriginal`; on success, show a toast and close the modal (no navigation).

## 4. Revert DocumentFormPage/DocumentForm to BORRADOR-only

- [x] 4.1 In `DocumentFormPage.tsx`, remove `canReplaceOriginalOnly` and its branch; `canEditFull` (renamed back to the single edit-permission check if appropriate) alone gates the not-BORRADOR block, so any non-BORRADOR document unconditionally shows `form.error_not_borrador`.
- [x] 4.2 Remove the `form.info_solo_archivo_original` banner and its i18n keys (now unused).
- [x] 4.3 Remove `restrictToArchivoOriginal` (and any prop that existed solely to support it) from `DocumentForm.tsx`'s props and field-disabling logic, keeping whatever archivo-original-in-BORRADOR behavior `DocumentForm` still legitimately needs (e.g. the frozen/`archivoOriginalBloqueado` badge).

## 5. Tests

- [x] 5.1 In `permissions.test.ts` / `DocumentActionPanel.test.tsx`, confirm existing coverage of `canReplaceArchivoOriginal` gating still passes unchanged (no logic change expected there).
- [x] 5.2 Rewrite the `RN-DOC-018` `describe` block in `src/router/documentReplaceOriginal.test.tsx`: assert clicking "Reemplazar archivo original" in `EN_REVISION` opens the modal (no route change to `/documents/:id/edit`), and that submitting a file closes the modal and shows the updated file name. Keep the first `describe` block (RN-DOC-013 role visibility) unchanged.
- [x] 5.3 Add/verify a unit or component test for `DocumentReplaceArchivoOriginalModal` covering: displays current file name when present, calls the mutation with the selected file, closes on success.

## 6. Manual verification

- [x] 6.1 Run the dev server, log in as an Autor of a document in `EN_REVISION`, replace the archivo original via the modal, and confirm the audit trail shows `ARCHIVO_ORIGINAL_ACTUALIZADO` without leaving the detail page.
- [x] 6.2 Confirm a Revisor/Aprobador never sees the "Reemplazar archivo original" button, and that navigating to `/documents/:id/edit` directly for a non-BORRADOR document still shows the blocked screen.
