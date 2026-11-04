## ADDED Requirements

### Requirement: Periodic review actions are role-gated in MSW
`PATCH /api/documents/:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }` (from `PUBLICADO`) or `{ estado: 'BORRADOR' }` (from `EN_REVISION_PERIODICA`), and `PATCH /api/documents/:id/confirmar-revision`, SHALL reject with `403` when the requesting user (resolved via `getUserFromRequest`) does not have role `JEFE_CALIDAD_SYST` or `JEFE_CONTROL_DOCUMENTARIO` — mirroring `canManagePeriodicReview` from `permissions.ts`. This gate applies regardless of the requesting user's relationship (autor/revisor/aprobador) to the document. Before this requirement, neither handler validated any permission for these transitions.

#### Scenario: JEFE_CONTROL_DOCUMENTARIO who is the document's aprobador starts periodic review
- **WHEN** a `JEFE_CONTROL_DOCUMENTARIO` who is the document's `aprobadorId` sends `PATCH /:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }` on a `PUBLICADO` document
- **THEN** the handler responds `200`

#### Scenario: SUPERVISOR cannot start periodic review via MSW
- **WHEN** a `SUPERVISOR` sends `PATCH /:id/status` with `{ estado: 'EN_REVISION_PERIODICA' }` on a `PUBLICADO` document
- **THEN** the handler responds `403`

#### Scenario: OPERARIO cannot confirm periodic review via MSW
- **WHEN** an `OPERARIO` sends `PATCH /:id/confirmar-revision`
- **THEN** the handler responds `403`

#### Scenario: JEFE_CALIDAD_SYST who is the document's autor confirms periodic review
- **WHEN** a `JEFE_CALIDAD_SYST` who is the document's `autorId` sends `PATCH /:id/confirmar-revision` on a `PUBLICADO` document
- **THEN** the handler responds `200`
