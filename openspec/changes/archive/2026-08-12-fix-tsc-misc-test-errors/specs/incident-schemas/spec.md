## MODIFIED Requirements

### Requirement: createIncidentSchema Zod schema
The system SHALL export a `createIncidentSchema` Zod object schema from `src/features/incidents/schemas/createIncident.schema.ts` with the following fields:
- `tipo`: `z.enum(['ACCIDENTE','INCIDENTE','CUASI_ACCIDENTE','CONDICION_INSEGURA'])`
- `descripcion`: `z.string().min(20, 'Mínimo 20 caracteres').max(2000)`
- `areaId`: `z.string().min(1, 'Área requerida')`
- `turno`: `z.enum(['DIA','TARDE','NOCHE','TODOS'])`
- `fechaEvento`: `z.string().datetime({ message: 'Fecha inválida' })`
- `huboLesionados`: `z.boolean()`
- `numPersonasAfectadas`: `z.number().int().min(1).optional()`
- `severidad`: `z.enum(['BAJA','MEDIA','ALTA','CRITICA']).optional()` — auto-calculated but user-adjustable
- `evidencias`: `z.array(z.custom<IncidentEvidencia>()).optional()` — each item is a fully-built `IncidentEvidencia` (from `src/features/incidents/types/incident.types.ts`), constructed client-side before calling `createIncident`; the schema SHALL NOT type this field as `z.array(z.unknown())`, since every caller always supplies the fully-typed shape and the looser type only hid a real type gap without adding validation value.

The schema SHALL include a `.refine()` that fails when `huboLesionados` is `true` and `numPersonasAfectadas` is absent or less than 1, with message `'Indicar número de personas afectadas'` at path `['numPersonasAfectadas']`.

The schema SHALL also export `CreateIncidentInput` as `z.infer<typeof createIncidentSchema>`.

#### Scenario: createIncidentSchema rejects descripcion shorter than 20 characters
- **WHEN** a developer calls `createIncidentSchema.safeParse({ tipo: 'INCIDENTE', descripcion: 'Corto', areaId: 'a1', turno: 'DIA', fechaEvento: '2025-06-01T08:00:00Z', huboLesionados: false })`
- **THEN** `success` is `false` and the error path includes `['descripcion']`

#### Scenario: createIncidentSchema refine fails when huboLesionados is true and numPersonasAfectadas is absent
- **WHEN** a developer calls `createIncidentSchema.safeParse({ tipo: 'ACCIDENTE', descripcion: 'Descripción de prueba con más de veinte caracteres', areaId: 'a1', turno: 'DIA', fechaEvento: '2025-06-01T08:00:00Z', huboLesionados: true })`
- **THEN** `success` is `false` and the error path includes `['numPersonasAfectadas']` with message `'Indicar número de personas afectadas'`

#### Scenario: createIncidentSchema passes when huboLesionados is false and numPersonasAfectadas is absent
- **WHEN** a developer calls `createIncidentSchema.safeParse({ tipo: 'CONDICION_INSEGURA', descripcion: 'Descripción de al menos veinte caracteres válida', areaId: 'a1', turno: 'TARDE', fechaEvento: '2025-06-01T08:00:00Z', huboLesionados: false })`
- **THEN** `success` is `true`

#### Scenario: createIncidentSchema passes when huboLesionados is true and numPersonasAfectadas is provided
- **WHEN** a developer calls `createIncidentSchema.safeParse({ tipo: 'ACCIDENTE', descripcion: 'Descripción de al menos veinte caracteres válida', areaId: 'a1', turno: 'NOCHE', fechaEvento: '2025-06-01T08:00:00Z', huboLesionados: true, numPersonasAfectadas: 2 })`
- **THEN** `success` is `true`

#### Scenario: createIncidentSchema rejects invalid tipo value
- **WHEN** a developer calls `createIncidentSchema.safeParse({ tipo: 'OTRO_TIPO', ... })`
- **THEN** `success` is `false` and the error path includes `['tipo']`

#### Scenario: evidencias is typed as IncidentEvidencia array, not unknown
- **WHEN** a developer reads `CreateIncidentInput['evidencias']`
- **THEN** TypeScript infers the element type as `IncidentEvidencia`, not `unknown`, so property access like `.descripcion` type-checks without a cast
