## MODIFIED Requirements

### Requirement: getFuncionalidades and asistirCausaRaizIA pure functions
`src/features/quality-events/api/quality-events.api.ts` SHALL export two functions, both returning `data` from the `ApiResponse` envelope:
- `getFuncionalidades(): Promise<Funcionalidades>`, which calls `GET /api/config/funcionalidades`;
- `asistirCausaRaizIA(id: string, metodo: AnalisisCausaRaizMetodo): Promise<SugerenciaCausaRaizIA>`, which calls `POST /api/quality-events/:id/asistente-ia` with body `{ metodo }`.

The types SHALL be:
- `SugerenciaCausaRaizIA = { causaRaizProbable: string; cincoPorques?: CincoPorques[] | null; ishikawa?: Ishikawa[] | null; accionesSugeridas: AccionSugeridaIA[]; modelo: string; generadoEn: string }` — only the list of the requested method has a value;
- `AccionSugeridaIA = { descripcion: string; tipo: 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA'; rolResponsableSugerido: string; plazoDiasHabiles: number }`.

#### Scenario: Calls the assistant endpoint with the method
- **WHEN** `asistirCausaRaizIA('qe-1', 'ISHIKAWA')` is called
- **THEN** a `POST /api/quality-events/qe-1/asistente-ia` request is sent with body `{ metodo: 'ISHIKAWA' }`

### Requirement: QualityEventUpdateInput carries origenIA
`QualityEventUpdateInput` SHALL include an optional `origenIA?: { causaRaiz?: OrigenIAValor; cincoPorques?: OrigenIAValor; ishikawa?: OrigenIAValor }`, with `OrigenIAValor = 'IA' | 'IA_EDITADO'`.

#### Scenario: Type accepts origenIA
- **WHEN** a developer passes `{ causaRaizDefinitiva: '...', origenIA: { causaRaiz: 'IA', ishikawa: 'IA_EDITADO' } }` as `QualityEventUpdateInput`
- **THEN** `tsc --noEmit` reports no error
