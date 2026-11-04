## ADDED Requirements

### Requirement: MSW endpoint POST /api/documents/:id/sign validates a per-user PIN
`documents.handlers.ts` SHALL register `http.post('/api/documents/:id/sign', ...)`, accepting `{ pin }`. It SHALL look up the authenticated user via the cross-domain mutable store `getUsersStore()` (from `auth.fixtures.ts`), never a static import. If that user's `pin` is `undefined` (no PIN configured), the handler SHALL respond 422 with `errorCode: 'PIN_NO_CONFIGURADO'`, without publishing the document. If `pin` is configured but `body.pin` does not match it, the handler SHALL respond 401. Only when `body.pin === user.pin` SHALL the handler proceed with the existing publish logic (estado `EN_APROBACION` required, obsoletize the previous `PUBLICADO` version of the same `codigo`, etc.). The handler SHALL NOT compare against any fixed module-level constant (e.g. a hardcoded `MOCK_PIN`).

#### Scenario: User without a configured PIN cannot sign
- **WHEN** `POST /api/documents/:id/sign` is requested by a user whose `MockUser.pin` is `undefined`
- **THEN** the response status is 422 with `errorCode: 'PIN_NO_CONFIGURADO'`, and the document's `estado` does not change

#### Scenario: Wrong PIN is rejected
- **WHEN** `POST /api/documents/:id/sign` is requested with a `pin` that does not match the signing user's configured `pin`
- **THEN** the response status is 401, and the document's `estado` does not change

#### Scenario: Correct PIN signs and publishes
- **WHEN** `POST /api/documents/:id/sign` is requested with a `pin` that matches the signing user's configured `pin`, for a document in `EN_APROBACION`
- **THEN** the response is 200 with `estado: 'PUBLICADO'`
