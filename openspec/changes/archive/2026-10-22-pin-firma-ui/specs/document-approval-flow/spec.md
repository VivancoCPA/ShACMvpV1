## MODIFIED Requirements

### Requirement: DocumentSignatureModal
The `DocumentSignatureModal` SHALL render a modal with:
- An accessible overlay (`aria-modal='true'`, `aria-labelledby`, focus trap, Escape closes).
- When `useAuthStore`'s current `user.tienePinFirma` is `true`: a PIN input (type=password) with label `documents:signature.pinLabel` ("PIN de firma (4 dígitos)"), placeholder `documents:signature.pinPlaceholder` ("••••"), and visible legal text `documents:signature.legalText`.
- When `user.tienePinFirma` is `false`: the PIN input is NOT rendered. Instead, the modal SHALL show the notice `documents:signature.noPinConfigured` with a link to `/perfil`, and the submit button SHALL be disabled (no request is sent).
- A Zod schema enforcing: `pin` required, exactly 4 numeric digits (`^\d{4}$`) — matching the format enforced server-side when the PIN is configured (`SetPinValidator`, `POST /api/auth/set-pin`).
- On submit: POST `/documents/:id/sign` with `{ pin }` — the payload SHALL NOT include a client-supplied `timestamp`; the backend records its own `Timestamp = DateTime.UtcNow` server-side on every resulting audit trail entry.
- On a response with `errorCode: 'PIN_NO_CONFIGURADO'` (the PIN was reset between opening the modal and submitting): the modal SHALL switch to the same "no PIN configured" notice described above, instead of attempting to show a generic or 401 error.
- On 401 response: error message `documents:signature.errorInvalid` ("PIN incorrecto") displayed inline below the PIN field — modal stays open, no toast.
- On any other error response: the backend's error message SHALL be displayed inline (not silently dropped) — modal stays open, no toast.
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

#### Scenario: User without a configured PIN sees the setup notice instead of the field
- **WHEN** `DocumentSignatureModal` opens for a user whose `tienePinFirma` is `false`
- **THEN** no PIN input is rendered; instead a notice with a link to `/perfil` is shown, and the submit button is disabled

#### Scenario: PIN reset mid-session surfaces the same notice
- **WHEN** the backend responds to `POST /:id/sign` with `errorCode: 'PIN_NO_CONFIGURADO'`
- **THEN** the modal shows the same "no PIN configured" notice with a link to `/perfil`, instead of a generic error

#### Scenario: Non-401, non-PIN-related error is still visible
- **WHEN** the backend responds with an error other than 401 or `PIN_NO_CONFIGURADO` (e.g. a 409 conflict)
- **THEN** the backend's error message is displayed inline in the modal, not silently dropped
