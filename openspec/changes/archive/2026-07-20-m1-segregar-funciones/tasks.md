## 1. Schema validation (RN-DOC-019)

- [x] 1.1 In `src/features/documents/schemas/documentForm.schema.ts`, extend the existing `.superRefine()` to add: when `data.revisorId` and `data.aprobadorId` are both non-empty and equal, call `ctx.addIssue` with `path: ['aprobadorId']` and a literal Spanish message (e.g. "El Revisor y el Aprobador no pueden ser la misma persona"), following the same style already used for the `rolesAutorizados` issue in the same function.
- [x] 1.2 Confirm `FieldError` in `DocumentForm.tsx` renders `errors.aprobadorId.message` directly (no `t()` lookup) — resolves the Open Question in `design.md`. If confirmed, no i18n key is needed for this message since the codebase's existing cross-field validation message (`rolesAutorizados`) follows the same literal-string pattern; do not introduce an unused i18n key.

## 2. Tests

- [x] 2.1 Create `src/features/documents/schemas/documentForm.schema.test.ts` if it does not already exist, or extend it if it does.
- [x] 2.2 Add test: `revisorId === aprobadorId` (both set, non-empty) fails validation with the error path `['aprobadorId']`.
- [x] 2.3 Add test: `revisorId !== aprobadorId` (different UUIDs) passes validation for this rule.
- [x] 2.4 Add test: `revisorId` set and `aprobadorId` empty (or vice versa) passes validation for this rule (no false positive on partially-filled forms).
- [x] 2.5 Add test: both `revisorId` and `aprobadorId` empty passes validation for this rule.

## 3. Manual verification

- [x] 3.1 Run the app, open the create-document form, assign the same user as Revisor and Aprobador, and confirm the inline error appears below the Aprobador field and submission is blocked. Verified live via Playwright against the dev server (MSW): error "El Revisor y el Aprobador no pueden ser la misma persona." rendered under Aprobador, no POST sent.
- [ ] 3.2 **BLOCKED — unrelated pre-existing bug, not this change's validation logic.** Attempted live verification in edit mode on `doc-003` (BORRADOR): discovered that `DocumentFormPage` in edit mode silently discards ALL user edits on submit — the PUT payload always contains the original, unedited document values, reproduced even for a plain `titulo` text edit (unrelated to revisorId/aprobadorId) and with real keyboard events (not a Playwright `fill()`/`selectOption()` artifact). Ruled out the `reset()` pre-population effect in `useDocumentForm.ts:88-92` as the cause (instrumented with temporary logging — it fires exactly twice on initial mount, both before any user edit, never again). Root cause not yet found; likely a desync between the native uncontrolled `<input>`/`<select>` DOM value and React Hook Form's internally tracked field value, specific to edit mode. Since `documentFormSchema` (including this new rule) is the same schema instance used for both create and edit with no mode-specific branching, and it's already verified via 5 passing unit tests plus the live create-mode check in 3.1, RN-DOC-019 itself is confirmed correctly implemented — this blocked item concerns a separate, pre-existing defect unrelated to segregation of duties. Flagged to the user; needs its own investigation/fix outside this change.
- [x] 3.3 Confirm assigning two different users (including two different users who both hold `ALTA_DIRECCION`) does not trigger the error and the form submits normally. Verified live in create mode: document created successfully ("Documento creado exitosamente") with two different users.
- [x] 3.4 Run the full documents test suite (`npm test` scoped to `features/documents`) and confirm no existing fixture/test regresses. 131/131 tests passed across 11 files.

## 4. Spec sync

- [x] 4.1 After implementation is verified, run `/opsx:sync` (or the archive flow) to merge the `document-form` delta spec in this change into `openspec/specs/document-form/spec.md`.
