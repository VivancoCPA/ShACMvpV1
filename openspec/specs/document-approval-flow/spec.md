# document-approval-flow

Role-based document action panel and approval modals for M1 Control Documentario. Implements the full state × role action matrix via `DocumentActionPanel`, `DocumentSignatureModal`, `DocumentRejectModal`, and the `useDocumentActions` hook. All mutations are gated by confirmation and managed through TanStack Query.

## Requirements

### Requirement: DocumentActionPanel role-based action rendering
The `DocumentActionPanel` component SHALL display only actions permitted for the current user's role and the document's estado, as resolved by `getDocumentPermissions()`. The panel SHALL render as an inline, non-sticky button row in the page header, next to the document title — the same placement pattern used for the "Editar" action in `IncidentDetailPage`. When no actions are available, it SHALL render the i18n message `documents:detail.noActionsAvailable`. Every mutating action SHALL open a confirmation modal before executing — no direct mutations on click.

#### Scenario: No actions shown for OBSOLETO documents
- **WHEN** `documento.estado === 'OBSOLETO'`
- **THEN** the panel displays `t('documents:detail.noActionsAvailable')` and no action buttons

#### Scenario: No actions shown for OPERARIO on any state
- **WHEN** the user's role is `OPERARIO`
- **THEN** no action buttons are visible (OPERARIO has no write permissions)

#### Scenario: Actions gated by confirmation modal
- **WHEN** the user clicks any mutating action button
- **THEN** a modal opens asking for confirmation before the mutation is sent

#### Scenario: Actions render inline in the header, not in a sticky sidebar
- **WHEN** the document detail page renders with at least one available action
- **THEN** the action buttons appear inline next to the document title in the header, and no sticky right-column panel is present in the layout

### Requirement: BORRADOR state actions
In state `BORRADOR`, the panel SHALL show:
- "Enviar a revisión" for `AUTOR` and `JEFE_CALIDAD_SYST` → confirmation modal → PATCH `/documents/:id/status` with `{ estado: 'EN_REVISION' }`.
- "Eliminar" for `AUTOR` and `JEFE_CALIDAD_SYST` → confirmation modal → DELETE `/documents/:id` → navigate to `/documentos` on success.

#### Scenario: AUTOR can send BORRADOR document to review
- **WHEN** `estado === 'BORRADOR'` and user is the document author
- **THEN** "Enviar a revisión" button is visible and clickable

#### Scenario: AUTOR can delete BORRADOR document
- **WHEN** `estado === 'BORRADOR'` and user is the document author
- **THEN** "Eliminar" button is visible; after confirmation and success the user is navigated to `/documentos`

#### Scenario: REVISOR sees no actions for BORRADOR
- **WHEN** `estado === 'BORRADOR'` and user role is `REVISOR`
- **THEN** no action buttons are rendered

### Requirement: EN_REVISION state actions
In state `EN_REVISION`, the panel SHALL show:
- "Aprobar revisión" for `JEFE_CALIDAD_SYST` and the assigned revisor → PATCH `/documents/:id/status` with `{ estado: 'EN_APROBACION' }`.
- "Rechazar" for `JEFE_CALIDAD_SYST` and the assigned revisor → `DocumentRejectModal`.
- "Cancelar revisión" for `JEFE_CALIDAD_SYST` only → PATCH `/documents/:id/status` with `{ estado: 'BORRADOR' }`.

#### Scenario: Revisor can approve review
- **WHEN** `estado === 'EN_REVISION'` and user is the assigned revisor
- **THEN** "Aprobar revisión" button is visible

#### Scenario: JEFE_CALIDAD_SYST can cancel review
- **WHEN** `estado === 'EN_REVISION'` and user role is `JEFE_CALIDAD_SYST`
- **THEN** "Cancelar revisión" button is visible

#### Scenario: AUTOR sees no actions for EN_REVISION
- **WHEN** `estado === 'EN_REVISION'` and user is the document author (not the revisor)
- **THEN** no action buttons are rendered

### Requirement: EN_APROBACION state actions
In state `EN_APROBACION`, the panel SHALL show:
- "Firmar y publicar" for `APROBADOR` (assigned aprobadorId) and `JEFE_CALIDAD_SYST` → `DocumentSignatureModal`.
- "Rechazar" for `APROBADOR` and `JEFE_CALIDAD_SYST` → `DocumentRejectModal`.

#### Scenario: Aprobador can sign in EN_APROBACION
- **WHEN** `estado === 'EN_APROBACION'` and user is the assigned aprobador
- **THEN** "Firmar y publicar" button is visible

#### Scenario: Signing opens DocumentSignatureModal (not direct mutation)
- **WHEN** the aprobador clicks "Firmar y publicar"
- **THEN** `DocumentSignatureModal` opens; no mutation is sent until PIN is submitted and validated

### Requirement: PUBLICADO and EN_REVISION_PERIODICA state actions
In state `PUBLICADO`, `JEFE_CALIDAD_SYST` SHALL see:
- "Iniciar revisión periódica" → PATCH `/documents/:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }`.
- "Crear nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

In state `EN_REVISION_PERIODICA`, `JEFE_CALIDAD_SYST` SHALL see:
- "Iniciar nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

#### Scenario: JEFE_CALIDAD_SYST can start periodic review from PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `JEFE_CALIDAD_SYST`
- **THEN** "Iniciar revisión periódica" button is visible

#### Scenario: Crear nueva versión navigates with baseId param
- **WHEN** the user clicks "Crear nueva versión" from PUBLICADO or "Iniciar nueva versión" from EN_REVISION_PERIODICA
- **THEN** router navigates to `/documentos/nuevo?baseId=<documento.id>`

#### Scenario: OPERARIO sees no actions for PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `OPERARIO`
- **THEN** no action buttons are rendered

### Requirement: DocumentSignatureModal
The `DocumentSignatureModal` SHALL render a modal with:
- An accessible overlay (`aria-modal='true'`, `aria-labelledby`, focus trap, Escape closes).
- A password input (type=password) with label `documents:signature.passwordLabel` and visible legal text `documents:signature.legalText`.
- A Zod schema enforcing: password required, min 6 characters.
- On submit: POST `/documents/:id/sign` with `{ password, timestamp: new Date().toISOString() }`.
- On 401 response: error message displayed inline below the password field — modal stays open, no toast.
- On success: modal closes + `toast.success` + query invalidation for `['document', id]` and `['documents']`.
- Form managed via React Hook Form + Zod resolver (no useState for fields).

#### Scenario: Modal is accessible with focus trap and Escape
- **WHEN** `DocumentSignatureModal` opens
- **THEN** focus moves to the password input, tabbing is trapped within the modal, and pressing Escape closes it without submitting

#### Scenario: Short password shows inline validation error
- **WHEN** user submits with a password shorter than 6 characters
- **THEN** the Zod error message appears inline below the input field (no toast)

#### Scenario: Wrong password shows inline error without closing modal
- **WHEN** MSW returns 401 for invalid password
- **THEN** an error message appears inline below the input field; the modal remains open

#### Scenario: Valid password signs, publishes, and closes modal
- **WHEN** MSW validates the password successfully
- **THEN** the document state transitions to PUBLICADO, the modal closes, a success toast fires, and queries are invalidated

#### Scenario: No useState for form fields
- **WHEN** the modal form is implemented
- **THEN** field values are controlled by React Hook Form (no `useState` managing password value)

### Requirement: DocumentRejectModal
The `DocumentRejectModal` SHALL render a modal with:
- A `motivo` Textarea (min 20 / max 500 chars, required).
- A `notificarAutor` checkbox, default checked.
- Submit: PATCH `/documents/:id/status` with `{ estado: 'BORRADOR', motivo, notificarAutor }`.
- Confirm button styled with `bg-error`.
- On success: `toast.success` + navigate to `/documentos` + query invalidation.
- Form managed via React Hook Form + Zod resolver.

#### Scenario: Motivo below minimum length shows validation error
- **WHEN** user submits motivo with fewer than 20 characters
- **THEN** the Zod validation error is shown below the textarea

#### Scenario: notificarAutor is checked by default
- **WHEN** DocumentRejectModal opens
- **THEN** the `notificarAutor` checkbox is checked

#### Scenario: Successful rejection returns to list
- **WHEN** the PATCH succeeds
- **THEN** a success toast fires, the user is navigated to `/documentos`, and document queries are invalidated

### Requirement: Status change MSW handlers
The MSW handler for `PATCH /documents/:id/status` SHALL:
- Validate that the requested state transition is permitted by the M1 state machine.
- Apply RN-DOC-001: when transitioning to PUBLICADO, find the fixture with the same `codigo` and `estado === 'PUBLICADO'` and set it to `OBSOLETO`.
- Append an `AuditTrailEntry` with the action, userId, and timestamp to the document's in-memory audit trail.
- Return the updated document wrapped in `ApiResponse<Documento>`.

The MSW handler for `POST /documents/:id/sign` SHALL:
- Validate the password against the fixture for the logged-in user.
- On success: set `estado → PUBLICADO`, set `hashArchivo → 'sha256-mock-' + id`, apply RN-DOC-001 (obsolete previous version).
- On invalid password: return 401 `{ success: false, message: 'Credenciales inválidas' }`.

The MSW handler for `DELETE /documents/:id` SHALL:
- Allow deletion only if `estado === 'BORRADOR'` or `estado === 'EN_REVISION'`.
- Return 204 on success.

#### Scenario: PATCH status applies RN-DOC-001 on PUBLICADO transition
- **WHEN** PATCH /documents/:id/status is called with `{ estado: 'PUBLICADO' }` and another document with the same `codigo` is already PUBLICADO
- **THEN** the previous document's estado is set to OBSOLETO and the current document is set to PUBLICADO

#### Scenario: PATCH status adds AuditTrailEntry
- **WHEN** a status change is processed by MSW
- **THEN** the document's auditTrail array gains one new entry with the correct accion, userId, and timestamp

#### Scenario: POST sign applies RN-DOC-001 — previous PUBLICADO version becomes OBSOLETO
- **WHEN** POST /documents/:id/sign is called with a valid password and another document with the same `codigo` is already in estado `PUBLICADO`
- **THEN** that previous document's estado is set to `OBSOLETO` before returning, and only the newly signed document has estado `PUBLICADO`

#### Scenario: POST sign with invalid password returns 401
- **WHEN** POST /documents/:id/sign is called with an incorrect password
- **THEN** MSW returns HTTP 401 with `{ success: false, message: 'Credenciales inválidas' }`

#### Scenario: DELETE rejected for PUBLICADO document
- **WHEN** DELETE /documents/:id is called and `estado === 'PUBLICADO'`
- **THEN** MSW returns an error response (not 204)

### Requirement: useDocumentActions hook
The `useDocumentActions` hook SHALL encapsulate five TanStack Query mutations/queries:
- `useChangeStatus`: PATCH `/documents/:id/status`.
- `useSignDocument`: POST `/documents/:id/sign`.
- `useDeleteDocument`: DELETE `/documents/:id`, navigates to `/documentos` on success.
- `useGetDownloadUrl`: GET `/documents/:id/download-url`, returns the signed URL object.
- `useRegisterAccess`: POST `/documents/:id/audit/access`.
Each mutation SHALL invalidate `['document', id]` and `['documents']` on success.

#### Scenario: useChangeStatus invalidates queries on success
- **WHEN** a status change mutation succeeds
- **THEN** both `['document', id]` and `['documents']` query keys are invalidated

#### Scenario: useDeleteDocument navigates after success
- **WHEN** the delete mutation succeeds
- **THEN** the app navigates to `/documentos`

#### Scenario: No direct axios calls in components
- **WHEN** any document action is triggered from a component
- **THEN** it goes through a hook in `useDocumentActions` (never raw axios in a component)
