## 1. Types & Zod Schema

- [x] 1.0 Add `DocConfidencialidad = 'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO'` type to `src/types/api.types.ts`; add `confidencialidad: DocConfidencialidad` (required) and `rolesAutorizados?: UserRole[]` (optional) to the `Documento` interface
- [x] 1.1 Create `src/features/documents/schemas/documentForm.schema.ts` with `documentFormSchema` enforcing all field rules: titulo min/max, tipo enum, area min/max, version regex, confidencialidad enum (default `'INTERNO'`), rolesAutorizados (conditional min(1) when RESTRINGIDO, otherwise optional), revisorId/aprobadorId uuid optional, fechaVigencia/fechaRevisionProxima date optional, descripcion max optional
- [x] 1.2 Export `DocumentFormInput` type inferred from the schema
- [x] 1.3 Update `src/features/documents/schemas/createDocument.schema.ts` to add `confidencialidad` (required, default `'INTERNO'`) and `rolesAutorizados` (conditional min(1) for RESTRINGIDO); update `CreateDocumentInput` type
- [x] 1.4 Update `src/features/documents/schemas/updateDocument.schema.ts` to add `confidencialidad?` and `rolesAutorizados?` (conditional min(1) for RESTRINGIDO); update `UpdateDocumentInput` type

## 2. MSW Fixtures & Handlers

- [x] 2.1 Add 4–5 mock users to `src/mocks/fixtures/documents.fixtures.ts` (id, nombre completo) for use in revisorId/aprobadorId selects
- [x] 2.2 Add `confidencialidad` field to all existing mock documents using varied values (`PUBLICO`, `INTERNO`, `CONFIDENCIAL`, `RESTRINGIDO`); add `rolesAutorizados: [...]` array on RESTRINGIDO fixtures
- [x] 2.3 Add `POST /api/documents/:id/upload` handler in `src/mocks/handlers/documents.handlers.ts` — delay 800 ms, returns `{ archivoUrl: '/mock/uploads/{id}/{filename}', hashArchivo: '<64-char hex>' }`, add comment warning that multipart body is not parsed
- [x] 2.4 Verify `POST /api/documents` handler returns `codigo` field in format `{tipo}-CD-00{n}`; patch it if missing

## 3. FileUploadField Component

- [x] 3.1 Create `src/features/documents/components/FileUploadField.tsx` with props: `value: File | null`, `onChange(file: File | null): void`, `existingFileUrl?: string`, `disabled?: boolean`
- [x] 3.2 Implement drag-and-drop drop zone (dragover/dragleave/drop events) and click-to-open file input (hidden `<input type="file" accept=".pdf,.docx,.xlsx">`)
- [x] 3.3 Implement inline validation: reject files with unsupported MIME type (show `t('documents:form.error_file_type')`), reject files > 10 485 760 bytes (show `t('documents:form.error_file_size')`)
- [x] 3.4 Implement simulated progress bar: `setTimeout` cascade 0→25→50→75→100 over ~1.5 s; clean up timeouts in useEffect return
- [x] 3.5 Display selected file name and size after valid selection; render replace/clear button to reset to empty state
- [x] 3.6 Handle `existingFileUrl` prop: extract filename from URL and display it with a "Reemplazar archivo" link that resets to drop zone
- [x] 3.7 Apply full dark mode variants (`dark:`) to all Tailwind classes; use design system tokens (canvas/hairline/coral/muted)

## 4. useDocumentForm Hook

- [x] 4.1 Create `src/features/documents/hooks/useDocumentForm.ts` — accepts `mode: 'create' | 'edit'` and `documentId?: string`
- [x] 4.2 Set up React Hook Form with `zodResolver(documentFormSchema)` and `defaultValues` (empty for create, fetched document for edit)
- [x] 4.3 Watch `fechaVigencia` field; when it changes reset `fechaRevisionProxima` to empty if it was auto-filled
- [x] 4.4 Implement `onSubmit` handler: auto-fill `fechaRevisionProxima` = `fechaVigencia + 365 days` if empty; call `POST /api/documents` (create) or `PATCH /api/documents/:id` (edit)
- [x] 4.5 After successful create: handle file upload if `archivo` field is set (use `archivoId` from response to call `POST /api/documents/:id/upload`); show `toast.success(t('documents:form.success_create'))`; navigate to `/documents`
- [x] 4.6 After successful edit: call `POST /api/documents/:id/upload` if new file selected; invalidate `queryClient.invalidateQueries(['documents'])`; show `toast.success(t('documents:form.success_edit'))`; navigate to `/documents`

## 5. DocumentForm Component

- [x] 5.1 Create `src/features/documents/components/DocumentForm.tsx` — receives `defaultValues`, `onSubmit`, `mode`, `isLoading`, `mockUsers` props; no routing logic inside
- [x] 5.2 Render all fields: titulo (text input), tipo (select with 7 enum values), area (text input), version (text input), confidencialidad (select with 4 values, disabled when role is not JEFE_CONTROL_DOCUMENTARIO or ALTA_DIRECCION), rolesAutorizados (multi-select, visible only when confidencialidad === 'RESTRINGIDO'), revisorId (select from mockUsers), aprobadorId (select from mockUsers), fechaVigencia (date input), fechaRevisionProxima (date input), descripcion (textarea), archivo (FileUploadField)
- [x] 5.3 Display inline validation errors below each field using `errors.*` from `useFormState`
- [x] 5.4 Disable `descripcion` field when `mode === 'edit'` and document estado is not `BORRADOR` (passed as `descriptionLocked` prop)
- [x] 5.5 Render Cancel button (`type="button"`) that calls `navigate('/documents')` without submitting; render Save button (`type="submit"`) with loading state
- [x] 5.6 Apply full dark mode variants and design system tokens to all field wrappers, labels, inputs, and error messages

## 6. DocumentFormPage

- [x] 6.1 Create `src/features/documents/pages/DocumentFormPage.tsx` — reads `useParams()` to get `id`, determines mode (`id` present → edit, absent → create)
- [x] 6.2 In edit mode: call `useDocument(id)` with `staleTime: 0`; show loading skeleton while fetching
- [x] 6.3 In edit mode: if `documento.estado !== 'BORRADOR'`, render inline error card with `t('documents:form.error_not_borrador')` and a back button; do NOT render `DocumentForm`
- [x] 6.4 Wire `useDocumentForm` hook, pass result props to `DocumentForm`; pass `mockUsers` from fixtures for select population
- [x] 6.5 Apply PageWrapper/page layout consistent with existing document pages

## 7. Router & Role Guards

- [x] 7.1 Add route `/documents/new` in `src/router/index.tsx` wrapped in `<RoleGuard requiredRoles={['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST']}>` rendering `<DocumentFormPage />`
- [x] 7.2 Add route `/documents/:id/edit` in `src/router/index.tsx` wrapped in `<RoleGuard requiredRoles={['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST', 'SUPERVISOR']}>` rendering `<DocumentFormPage />`

## 8. DocumentsPage & DocumentList Updates

- [x] 8.1 Add "Nuevo documento" primary button to `src/features/documents/pages/DocumentsPage.tsx` that navigates to `/documents/new`; conditionally render only when user role is `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST` (read from `authStore`)
- [x] 8.2 Add "Editar" row action in `src/features/documents/components/DocumentList.tsx` that navigates to `/documents/:id/edit`; render the action only when `documento.estado === 'BORRADOR'` and user has edit permission

## 9. i18n Keys

- [x] 9.1 Add `form` section to `src/i18n/locales/es-PE.json` under `documents` namespace with all required keys: `title_create`, `title_edit`, `field_titulo`, `field_tipo`, `field_area`, `field_version`, `field_revisor`, `field_aprobador`, `field_vigencia`, `field_revision`, `field_archivo`, `field_descripcion`, `btn_save`, `btn_cancel`, `success_create`, `success_edit`, `error_not_borrador`, `error_file_size`, `error_file_type`, `generating_code`, `upload_drag`, `upload_hint`, `upload_replace`, `field_confidencialidad`, `field_roles_autorizados`, `confidencialidad_publico`, `confidencialidad_interno`, `confidencialidad_confidencial`, `confidencialidad_restringido`, `hint_restringido`
- [x] 9.2 Add matching `form` section to `src/i18n/locales/en-US.json` with English translations for all the same keys (including the new confidencialidad keys)
- [x] 9.3 Add `actions.new_document` key to both locale files under `documents` namespace

## 10. Acceptance Criteria Verification

- [x] 10.1 CA-01: `/documents/new` renders form with empty fields and `version` defaulting to `v1.0`
- [x] 10.2 CA-02: Submit without `titulo` shows inline error, no API call made
- [x] 10.3 CA-03: Valid create submit → `POST /api/documents` → `toast.success` → redirect `/documents`
- [x] 10.4 CA-04: `/documents/:id/edit` pre-populates all fields from `useDocument(id)` response
- [x] 10.5 CA-05: Edit route with non-BORRADOR document shows error card, form not rendered
- [x] 10.6 CA-06: File selection triggers simulated progress bar to 100%
- [x] 10.7 CA-07: File > 10 MB shows `error_file_size` error, no API call
- [x] 10.8 CA-08: Cancel button navigates to `/documents` without triggering submit
- [x] 10.9 CA-09: OPERARIO navigating to `/documents/new` or `/documents/:id/edit` is redirected to `/no-autorizado`
- [x] 10.10 CA-10: All form elements have correct `dark:` Tailwind variants (test by toggling dark mode)
- [x] 10.11 CA-11: Switching locale to `en-US` renders all labels and messages in English
- [x] 10.12 CA-12: `confidencialidad` select appears with 4 options in the form
- [x] 10.13 CA-13: Selecting RESTRINGIDO reveals the `rolesAutorizados` multi-select
- [x] 10.14 CA-14: Changing from RESTRINGIDO to another value hides the field and clears its value
- [x] 10.15 CA-15: JEFE_CALIDAD_SYST sees `confidencialidad` disabled showing INTERNO
- [x] 10.16 CA-16: Submit with RESTRINGIDO and empty `rolesAutorizados` shows inline validation error
