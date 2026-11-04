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
En state `BORRADOR`, el panel SHALL mostrar, resolviendo el `docRole` del actor sobre ESTE documento con la misma precedencia que el backend (`AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD (rol global) → OPERARIO`, vía `resolveDocRoleForUser` compartido con `DocumentDetailPage`), no un flag de rol global suelto:
- "Enviar a revisión" solo si `docRole === 'AUTOR'` o `docRole === 'JEFE_CALIDAD'` → modal de confirmación → `PATCH /documents/:id/status` con `{ estado: 'EN_REVISION' }`.
- "Eliminar" con la misma condición que "Enviar a revisión".

Si el documento no tiene `revisorId` o no tiene `aprobadorId` asignado, el panel SHALL mostrar un aviso ("Asigna revisor y aprobador para poder enviar a revisión") con un enlace a `/documents/:id/edit`, y el botón "Enviar a revisión" SHALL estar deshabilitado con un `title` explicando el motivo.

#### Scenario: AUTOR puede enviar a revisión un BORRADOR propio con revisor y aprobador asignados
- **WHEN** `estado === 'BORRADOR'`, el usuario es el autor, y el documento tiene `revisorId` y `aprobadorId`
- **THEN** el botón "Enviar a revisión" está visible y habilitado

#### Scenario: AUTOR no puede eliminar BORRADOR
- **WHEN** `estado === 'BORRADOR'` y el usuario no es `AUTOR` ni `JEFE_CALIDAD` para este documento
- **THEN** "Eliminar" no se muestra

#### Scenario: JEFE_CALIDAD que es revisor o aprobador asignado de este BORRADOR no ve "Enviar a revisión"
- **WHEN** `estado === 'BORRADOR'` y el usuario tiene rol global `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` pero es el `revisorId` o `aprobadorId` asignado de este documento (no el autor)
- **THEN** el `docRole` resuelto es `REVISOR`/`APROBADOR`, y ni "Enviar a revisión" ni "Eliminar" se muestran — mismo resultado que rechazaría el backend con `403`

#### Scenario: Aviso cuando falta revisor o aprobador
- **WHEN** `estado === 'BORRADOR'` y el documento no tiene `revisorId` o no tiene `aprobadorId`
- **THEN** se muestra el aviso con enlace a editar, y "Enviar a revisión" aparece deshabilitado con un tooltip explicando el motivo

#### Scenario: REVISOR sees no actions for BORRADOR
- **WHEN** `estado === 'BORRADOR'` y el `docRole` resuelto del usuario es `REVISOR`
- **THEN** no se renderiza ningún botón de acción

### Requirement: EN_REVISION state actions
En state `EN_REVISION`, el panel SHALL mostrar, con el mismo `docRole` resuelto que `BORRADOR state actions`:
- "Aprobar revisión" para el `revisorId` asignado (`docRole === 'REVISOR'`) → `PATCH /documents/:id/status` con `{ estado: 'EN_APROBACION' }`.
- "Rechazar" para el `revisorId` asignado → `DocumentRejectModal`.
- "Cancelar revisión" solo si `docRole === 'JEFE_CALIDAD'` — un `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` que es el `revisorId` o `aprobadorId` asignado de ESTE documento resuelve a `REVISOR`/`APROBADOR`, no a `JEFE_CALIDAD`, y no ve "Cancelar revisión" (mismo criterio que el backend, que exige `CanEdit`).

#### Scenario: Revisor can approve review
- **WHEN** `estado === 'EN_REVISION'` y el usuario es el `revisorId` asignado
- **THEN** "Aprobar revisión" está visible

#### Scenario: JEFE_CALIDAD_SYST que no es revisor ni aprobador de este documento puede cancelar revisión
- **WHEN** `estado === 'EN_REVISION'`, el usuario tiene rol global `JEFE_CALIDAD_SYST`, y no es `revisorId` ni `aprobadorId` de este documento
- **THEN** "Cancelar revisión" está visible

#### Scenario: JEFE_CALIDAD_SYST que es el aprobador asignado de este documento no ve "Cancelar revisión"
- **WHEN** `estado === 'EN_REVISION'`, el usuario tiene rol global `JEFE_CALIDAD_SYST`, y es el `aprobadorId` asignado de este documento
- **THEN** el `docRole` resuelto es `APROBADOR`, y "Cancelar revisión" no se muestra

#### Scenario: AUTOR sees no actions for EN_REVISION
- **WHEN** `estado === 'EN_REVISION'` y el usuario es el autor del documento (no el revisor)
- **THEN** no se renderiza ningún botón de acción

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
In state `PUBLICADO`, any user whose global role is `JEFE_CALIDAD_SYST` or `JEFE_CONTROL_DOCUMENTARIO` (per `canManagePeriodicReview`) SHALL see:
- "Iniciar revisión periódica" → PATCH `/documents/:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }`.
- "Crear nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

In state `EN_REVISION_PERIODICA`, `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` (and the assigned author) SHALL see:
- "Iniciar nueva versión" → navigate to `/documentos/nuevo?baseId=:id`.

"Iniciar revisión periódica" SHALL be authorized by `canManagePeriodicReview(user.rol)`, not by `resolveDocRoleForUser`/`getDocumentPermissions(...).canStartReview` — the button SHALL appear for a `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` even when that user is also the document's `autorId`, `revisorId`, or `aprobadorId`.

#### Scenario: JEFE_CALIDAD_SYST can start periodic review from PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `JEFE_CALIDAD_SYST`
- **THEN** "Iniciar revisión periódica" button is visible

#### Scenario: JEFE_CALIDAD_SYST who is also the aprobador can start periodic review
- **WHEN** `estado === 'PUBLICADO'`, user role is `JEFE_CALIDAD_SYST`, and that user is also the document's `aprobadorId`
- **THEN** "Iniciar revisión periódica" button is visible (same as any other `JEFE_CALIDAD_SYST`)

#### Scenario: JEFE_CONTROL_DOCUMENTARIO who is also the autor can start periodic review
- **WHEN** `estado === 'PUBLICADO'`, user role is `JEFE_CONTROL_DOCUMENTARIO`, and that user is also the document's `autorId`
- **THEN** "Iniciar revisión periódica" button is visible

#### Scenario: Crear nueva versión navigates with baseId param
- **WHEN** the user clicks "Crear nueva versión" from PUBLICADO or "Iniciar nueva versión" from EN_REVISION_PERIODICA
- **THEN** router navigates to `/documentos/nuevo?baseId=<documento.id>`

#### Scenario: OPERARIO sees no actions for PUBLICADO
- **WHEN** `estado === 'PUBLICADO'` and user role is `OPERARIO`
- **THEN** no action buttons are rendered

#### Scenario: SUPERVISOR sees no "Iniciar revisión periódica" button
- **WHEN** `estado === 'PUBLICADO'` and user role is `SUPERVISOR`
- **THEN** "Iniciar revisión periódica" button is not rendered

### Requirement: DocumentSignatureModal
The `DocumentSignatureModal` SHALL render a modal with:
- An accessible overlay (`aria-modal='true'`, `aria-labelledby`, focus trap, Escape closes).
- When `useAuthStore`'s current `user.tienePinFirma` is `true`: a PIN input (type=password) with label `documents:signature.pinLabel` ("PIN de firma (4 dígitos)"), placeholder `documents:signature.pinPlaceholder` ("••••"), and visible legal text `documents:signature.legalText`.
- When `user.tienePinFirma` is `false`: the PIN input is NOT rendered. Instead, the modal SHALL show the notice `documents:signature.noPinConfigured` with a link to `/perfil`, and the submit button SHALL be disabled (no request is sent).
- A Zod schema enforcing: `pin` required, exactly 4 numeric digits (`^\d{4}$`) — matching the format enforced server-side when the PIN is configured (`SetPinValidator`, `POST /api/auth/set-pin`).
- On submit: POST `/documents/:id/sign` with `{ pin }` — the payload SHALL NOT include a client-supplied `timestamp`; the backend records its own `Timestamp = DateTime.UtcNow` server-side on every resulting audit trail entry.
- On a response with `errorCode: 'PIN_NO_CONFIGURADO'` (the PIN was reset between opening the modal and submitting): the modal SHALL switch to the same "no PIN configured" notice described above, instead of attempting to show a generic or 401 error.
- On 401 response: error message `documents:signature.errorInvalid` ("PIN incorrecto") displayed inline below the PIN field — modal stays open, no toast.
- On any other error response (e.g. 422 business-rule error such as missing original file or PDF conversion failure, 409 conflict): the backend's localized error message SHALL be displayed inline (not silently dropped) — modal stays open, no toast.
- On success: modal closes + `toast.success` + query invalidation for `['document', id]` and `['documents']`.
- Form managed via React Hook Form + Zod resolver (no useState for fields).

#### Scenario: Modal is accessible with focus trap and Escape
- **WHEN** `DocumentSignatureModal` opens
- **THEN** focus moves to the PIN input, tabbing is trapped within the modal, and pressing Escape closes it without submitting

#### Scenario: Malformed PIN shows inline validation error
- **WHEN** user submits with a PIN that is not exactly 4 numeric digits (e.g. shorter, longer, or containing non-digit characters)
- **THEN** the Zod error message appears inline below the input field (no toast)

#### Scenario: Wrong PIN shows inline error without closing modal
- **WHEN** the backend returns 401 for an invalid PIN
- **THEN** an error message appears inline below the input field; the modal remains open

#### Scenario: Missing original file shows inline error without closing modal
- **WHEN** the backend returns a business-rule error (422) because the document has no original file to convert
- **THEN** the server's error message appears inline below the input field, the modal remains open, and no toast is shown

#### Scenario: PDF conversion failure shows inline error without closing modal
- **WHEN** the backend returns a business-rule error (422) because the PDF conversion failed
- **THEN** the server's error message appears inline below the input field, the modal remains open, and no toast is shown

#### Scenario: Valid PIN signs, publishes, and closes modal
- **WHEN** the backend validates the PIN successfully and the document is published
- **THEN** the document state transitions to PUBLICADO, the modal closes, a success toast fires, and queries are invalidated

#### Scenario: No useState for form fields
- **WHEN** the modal form is implemented
- **THEN** field values are controlled by React Hook Form (no `useState` managing the PIN value)

#### Scenario: Signed payload matches the backend command contract
- **WHEN** the form is submitted with a valid PIN
- **THEN** the request body sent to `POST /documents/:id/sign` is exactly `{ pin: <value> }` — no `password` key and no `timestamp` key, matching `FirmarPublicarDocumentoCommand(string Pin)`

#### Scenario: User without a configured PIN sees the setup notice instead of the field
- **WHEN** `DocumentSignatureModal` opens for a user whose `tienePinFirma` is `false`
- **THEN** no PIN input is rendered; instead a notice with a link to `/perfil` is shown, and the submit button is disabled

#### Scenario: PIN reset mid-session surfaces the same notice
- **WHEN** the backend responds to `POST /:id/sign` with `errorCode: 'PIN_NO_CONFIGURADO'`
- **THEN** the modal shows the same "no PIN configured" notice with a link to `/perfil`, instead of a generic error

#### Scenario: Non-401, non-PIN-related error is still visible
- **WHEN** the backend responds with an error other than 401 or `PIN_NO_CONFIGURADO` (e.g. a 409 conflict)
- **THEN** the backend's error message is displayed inline in the modal, not silently dropped

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
El handler MSW de `PATCH /documents/:id/status` SHALL:
- Validar que la transición de estado solicitada está permitida por la máquina de estados de M1.
- En la transición `BORRADOR → EN_REVISION`, validar que el documento tenga `revisorId` y `aprobadorId` asignados; si falta alguno, SHALL responder con un error de validación por campo (mismo contrato que el backend real: `400`, con el nombre del campo faltante), sin cambiar el estado del documento.
- Aplicar RN-DOC-001: al transicionar a `PUBLICADO`, buscar el fixture con el mismo `codigo` y `estado === 'PUBLICADO'` y ponerlo en `OBSOLETO`.
- Agregar una entrada `AuditTrailEntry` con la acción, `userId` y timestamp al audit trail en memoria del documento.
- Retornar el documento actualizado envuelto en `ApiResponse<Documento>`.

The MSW handler for `POST /documents/:id/sign` SHALL:
- Accept a request body of `{ pin: string }` — the handler SHALL NOT expect or read a `password` or `timestamp` key, matching the real backend's `FirmarPublicarDocumentoCommand`.
- Validate the `pin` against the fixture for the logged-in user.
- On success: set `estado → PUBLICADO`, set `hashArchivo → 'sha256-mock-' + id`, apply RN-DOC-001 (obsolete previous version).
- On invalid PIN: return 401 `{ success: false, message: 'Credenciales inválidas' }`.

The MSW handler for `DELETE /documents/:id` SHALL:
- Allow deletion only if `estado === 'BORRADOR'` or `estado === 'EN_REVISION'`.
- Return 204 on success.

#### Scenario: PATCH status applies RN-DOC-001 on PUBLICADO transition
- **WHEN** se llama `PATCH /documents/:id/status` con `{ estado: 'PUBLICADO' }` y otro documento con el mismo `codigo` ya está `PUBLICADO`
- **THEN** el estado del documento anterior pasa a `OBSOLETO` y el actual pasa a `PUBLICADO`

#### Scenario: PATCH status adds AuditTrailEntry
- **WHEN** MSW procesa un cambio de estado
- **THEN** el `auditTrail` del documento gana una nueva entrada con la acción, `userId` y timestamp correctos

#### Scenario: Enviar a revisión sin revisor o aprobador es rechazado por MSW
- **WHEN** se llama `PATCH /documents/:id/status` con `{ estado: 'EN_REVISION' }` sobre un `BORRADOR` sin `revisorId` o sin `aprobadorId`
- **THEN** MSW responde con un error `400` identificando el campo faltante, y el documento permanece en `BORRADOR`

#### Scenario: POST sign applies RN-DOC-001 — previous PUBLICADO version becomes OBSOLETO
- **WHEN** POST /documents/:id/sign is called with `{ pin }` valid and another document with the same `codigo` is already in estado `PUBLICADO`
- **THEN** that previous document's estado is set to `OBSOLETO` before returning, and only the newly signed document has estado `PUBLICADO`

#### Scenario: POST sign with invalid PIN returns 401
- **WHEN** POST /documents/:id/sign is called with an incorrect `pin`
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

### Requirement: Nueva versión — autor y herencia condicionada (MSW)
El handler MSW de `POST /documents/:id/nueva-version` SHALL replicar la misma regla que el backend real: `autorId` del nuevo documento SHALL ser el actor que hace la solicitud (`getUserFromRequest`), nunca el `autorId` del documento origen. `revisorId`/`aprobadorId` SHALL heredarse del origen solo si son distintos del nuevo `autorId` y siguen siendo candidatos elegibles (activo, rol elegible para ese tipo de asignación, con asignación activa en la empresa activa) — en caso contrario SHALL quedar `null`/`undefined`, reutilizando la misma lógica de elegibilidad que el handler de `GET /documents/candidatos-asignacion`, sin duplicarla. El handler SHALL rechazar con `403` si el actor no es el `autorId` del documento origen ni tiene rol `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`.

#### Scenario: MSW asigna el autor correcto
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` que era el revisor del documento origen crea una nueva versión vía MSW
- **THEN** el nuevo documento tiene `autorId` igual a ese usuario, y `revisorId: undefined`

#### Scenario: MSW rechaza la creación sin permiso
- **WHEN** un usuario que no es autor del origen ni JCA/JCD solicita `POST /documents/:id/nueva-version` vía MSW
- **THEN** la respuesta es un error `403`, sin crear ningún documento nuevo

### Requirement: Pista "¿Olvidaste tu PIN?" en DocumentSignatureModal
Mientras el campo PIN esté visible (`!noPinConfigured`), `DocumentSignatureModal` SHALL mostrar siempre, debajo del campo y de su mensaje de error si lo hay, un enlace con el texto `documents:signature.forgotPinLink` hacia `/perfil#pin-firma`. El enlace `signature.configurePinLink` del estado sin PIN SHALL apuntar también a `/perfil#pin-firma`. El focus trap del modal SHALL incluir los enlaces (`a[href]`) en el ciclo de Tab, y al abrir el modal el primer elemento enfocado SHALL seguir siendo el input del PIN.

#### Scenario: Pista visible con PIN configurado
- **WHEN** un aprobador con `tienePinFirma === true` abre el modal de firma
- **THEN** se ve el enlace "¿Olvidaste tu PIN?" con `href="/perfil#pin-firma"` y el foco inicial está en el input del PIN

#### Scenario: Pista visible tras PIN incorrecto
- **WHEN** el usuario envía un PIN incorrecto y el servidor responde 401 `PIN_INCORRECTO`
- **THEN** se ve "PIN incorrecto." bajo el campo y el enlace "¿Olvidaste tu PIN?" sigue visible

#### Scenario: Sin PIN configurado
- **WHEN** el usuario no tiene PIN configurado
- **THEN** no se ve la pista "¿Olvidaste tu PIN?", y se ve el aviso de configurar PIN con un enlace a `/perfil#pin-firma`

#### Scenario: El enlace entra en el ciclo de Tab
- **WHEN** el usuario recorre el modal con Tab
- **THEN** el enlace "¿Olvidaste tu PIN?" recibe el foco en su turno, y el ciclo sigue cerrado (del último elemento vuelve al primero)
