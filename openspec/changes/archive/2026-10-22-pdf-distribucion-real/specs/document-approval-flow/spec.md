## MODIFIED Requirements

### Requirement: DocumentSignatureModal
The `DocumentSignatureModal` SHALL render a modal with:
- An accessible overlay (`aria-modal='true'`, `aria-labelledby`, focus trap, Escape closes).
- A PIN input (type=password) with label `documents:signature.passwordLabel` and visible legal text `documents:signature.legalText`.
- A Zod schema enforcing: `pin` required, exactly 4 numeric digits (`^\d{4}$`) — matching the format enforced server-side when the PIN is configured (`SetPinValidator`, `POST /api/auth/set-pin`).
- On submit: POST `/documents/:id/sign` with `{ pin }` — the payload SHALL NOT include a client-supplied `timestamp`; the backend records its own `Timestamp = DateTime.UtcNow` server-side on every resulting audit trail entry.
- On any error response (401 wrong PIN, 422 business-rule error such as missing original file or PDF conversion failure, or any other non-2xx result): error message displayed inline below the PIN field, using the server's localized message when present — modal stays open, no toast.
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
