## ADDED Requirements

### Requirement: aprobarCausaRaiz pure function
`src/features/quality-events/api/quality-events.api.ts` SHALL export `aprobarCausaRaiz(id: string, pin: string): Promise<QualityEvent>`, which calls `POST /api/quality-events/:id/aprobar-causa-raiz` with body `{ pin }` and returns the updated QE from the `ApiResponse` envelope.

#### Scenario: Sends only the PIN
- **WHEN** `aprobarCausaRaiz('qe-1', '1234')` is called
- **THEN** a `POST /api/quality-events/qe-1/aprobar-causa-raiz` request is sent with body `{ pin: '1234' }`

### Requirement: QualityEventUpdateInput excludes the approval fields
`QualityEventUpdateInput` in `qualityEvent.types.ts` SHALL NOT include `causaRaizAprobadaPorId` or `causaRaizFirmadaEn`. Those fields remain on `QualityEvent` as read-only data written only by the approval endpoint.

#### Scenario: Type rejects approval fields
- **WHEN** a developer passes `{ causaRaizFirmadaEn: '...' }` as `QualityEventUpdateInput`
- **THEN** `tsc --noEmit` reports a type error
