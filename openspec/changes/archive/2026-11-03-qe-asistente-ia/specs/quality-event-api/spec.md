## ADDED Requirements

### Requirement: getFuncionalidades and asistirCausaRaizIA pure functions
`src/features/quality-events/api/quality-events.api.ts` SHALL export two functions, both returning `data` from the `ApiResponse` envelope:
- `getFuncionalidades(): Promise<Funcionalidades>`, which calls `GET /api/config/funcionalidades`;
- `asistirCausaRaizIA(id: string): Promise<SugerenciaCausaRaizIA>`, which calls `POST /api/quality-events/:id/asistente-ia` with no body.

The types SHALL be:
- `SugerenciaCausaRaizIA = { causaRaizProbable: string; cincoPorques: CincoPorques[]; accionesSugeridas: AccionSugeridaIA[]; modelo: string; generadoEn: string }`;
- `AccionSugeridaIA = { descripcion: string; tipo: 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA'; rolResponsableSugerido: string; plazoDiasHabiles: number }`.

#### Scenario: Calls the assistant endpoint
- **WHEN** `asistirCausaRaizIA('qe-1')` is called
- **THEN** a `POST /api/quality-events/qe-1/asistente-ia` request is sent

### Requirement: QualityEventUpdateInput carries origenIA
`QualityEventUpdateInput` SHALL include an optional `origenIA?: { causaRaiz?: OrigenIAValor; cincoPorques?: OrigenIAValor }`, with `OrigenIAValor = 'IA' | 'IA_EDITADO'`.

#### Scenario: Type accepts origenIA
- **WHEN** a developer passes `{ causaRaizDefinitiva: '...', origenIA: { causaRaiz: 'IA' } }` as `QualityEventUpdateInput`
- **THEN** `tsc --noEmit` reports no error
