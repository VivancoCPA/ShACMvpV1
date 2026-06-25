## Why

M1 (Control Documentario) requires a UI for creating and editing documents in `BORRADOR` state. Without this form, users cannot enter new documents into the system, making the document list (M1-S03) a read-only view with no way to populate it. This is the core data-entry flow that unblocks the rest of the M1 workflow.

## What Changes

- New `DocumentFormPage` component that handles both create (`/documents/new`) and edit (`/documents/:id/edit`) modes, detected from the route
- New `DocumentForm` component with React Hook Form + Zod validation for all document fields (titulo, tipo, area, version, revisorId, aprobadorId, fechaVigencia, fechaRevisionProxima, descripcion)
- New `FileUploadField` component with drag-and-drop, simulated upload progress, and inline file validation (type and size)
- New `useDocumentForm` hook encapsulating submit logic, cache invalidation, and post-submit navigation
- New `documentForm.schema.ts` Zod schema
- MSW handler additions: `POST /api/documents/:id/upload` endpoint for file upload simulation
- Fixture additions: 4–5 mock users for revisorId/aprobadorId selects
- Router additions: two new guarded routes (`/documents/new`, `/documents/:id/edit`)
- i18n additions: `form.*` key block in `documents` namespace (es-PE + en-US)
- DocumentsPage: "Nuevo documento" button
- DocumentList: "Editar" row action (visible only for `BORRADOR` documents)

## Capabilities

### New Capabilities

- `document-form`: Create and edit document form — full CRUD form for `BORRADOR` documents, including file upload, Zod validation, and permission guards per role
- `document-file-upload`: Simulated file upload field — drag-and-drop FileUploadField with progress simulation, inline validation, and archivoUrl/hashArchivo mock response

### Modified Capabilities

- `document-permissions`: Edit action and route guards for form access — adds create/edit role rules (`JEFE_CONTROL_DOCUMENTARIO`, `JEFE_CALIDAD_SYST` for create; adds `SUPERVISOR` for edit) that extend the existing permission matrix

## Impact

- **New files**: `DocumentFormPage.tsx`, `DocumentForm.tsx`, `FileUploadField.tsx`, `useDocumentForm.ts`, `documentForm.schema.ts`
- **Modified files**: `documents.handlers.ts`, `documents.fixtures.ts`, `router/index.tsx`, `DocumentsPage.tsx`, `DocumentList.tsx`, `es-PE.json`, `en-US.json`
- **MSW**: new `POST /api/documents/:id/upload` handler; `POST /api/documents` already handled — verify it returns `codigo` and `archivoUrl`
- **Dependencies**: no new packages — React Hook Form, Zod, TanStack Query, MSW v2, react-i18next, Sonner all already installed
- **No breaking changes** to existing document list, hooks, or types
