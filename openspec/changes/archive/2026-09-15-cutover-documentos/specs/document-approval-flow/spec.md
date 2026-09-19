## MODIFIED Requirements

### Requirement: DocumentSignatureModal
The `DocumentSignatureModal` SHALL render a modal with:
- An accessible overlay (`aria-modal='true'`, `aria-labelledby`, focus trap, Escape closes).
- A PIN input (type=password) with label `documents:signature.passwordLabel` and visible legal text `documents:signature.legalText`.
- A Zod schema enforcing: `pin` required, exactly 4 numeric digits (`^\d{4}$`) — matching the format enforced server-side when the PIN is configured (`SetPinValidator`, `POST /api/auth/set-pin`).
- On submit: POST `/documents/:id/sign` with `{ pin }` — the payload SHALL NOT include a client-supplied `timestamp`; the backend records its own `Timestamp = DateTime.UtcNow` server-side on every resulting audit trail entry.
- On 401 response: error message displayed inline below the PIN field — modal stays open, no toast.
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

#### Scenario: Valid PIN signs, publishes, and closes modal
- **WHEN** the backend validates the PIN successfully
- **THEN** the document state transitions to PUBLICADO, the modal closes, a success toast fires, and queries are invalidated

#### Scenario: No useState for form fields
- **WHEN** the modal form is implemented
- **THEN** field values are controlled by React Hook Form (no `useState` managing the PIN value)

#### Scenario: Signed payload matches the backend command contract
- **WHEN** the form is submitted with a valid PIN
- **THEN** the request body sent to `POST /documents/:id/sign` is exactly `{ pin: <value> }` — no `password` key and no `timestamp` key, matching `FirmarPublicarDocumentoCommand(string Pin)`

### Requirement: Status change MSW handlers
The MSW handler for `PATCH /documents/:id/status` SHALL:
- Validate that the requested state transition is permitted by the M1 state machine.
- Apply RN-DOC-001: when transitioning to PUBLICADO, find the fixture with the same `codigo` and `estado === 'PUBLICADO'` and set it to `OBSOLETO`.
- Append an `AuditTrailEntry` with the action, userId, and timestamp to the document's in-memory audit trail.
- Return the updated document wrapped in `ApiResponse<Documento>`.

The MSW handler for `POST /documents/:id/sign` SHALL:
- Accept a request body of `{ pin: string }` — the handler SHALL NOT expect or read a `password` or `timestamp` key, matching the real backend's `FirmarPublicarDocumentoCommand`.
- Validate the `pin` against the fixture for the logged-in user.
- On success: set `estado → PUBLICADO`, set `hashArchivo → 'sha256-mock-' + id`, apply RN-DOC-001 (obsolete previous version).
- On invalid PIN: return 401 `{ success: false, message: 'Credenciales inválidas' }`.

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
- **WHEN** POST /documents/:id/sign is called with `{ pin }` valid and another document with the same `codigo` is already in estado `PUBLICADO`
- **THEN** that previous document's estado is set to `OBSOLETO` before returning, and only the newly signed document has estado `PUBLICADO`

#### Scenario: POST sign with invalid PIN returns 401
- **WHEN** POST /documents/:id/sign is called with an incorrect `pin`
- **THEN** MSW returns HTTP 401 with `{ success: false, message: 'Credenciales inválidas' }`

#### Scenario: DELETE rejected for PUBLICADO document
- **WHEN** DELETE /documents/:id is called and `estado === 'PUBLICADO'`
- **THEN** MSW returns an error response (not 204)
