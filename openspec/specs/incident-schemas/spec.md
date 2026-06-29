# Spec: incident-schemas

## Purpose

Zod validation schemas for the incident domain. Covers incident creation, investigation phase updates, and corrective action creation. All schemas are co-located under `src/features/incidents/schemas/`.

---

## Requirements

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

---

### Requirement: updateIncidentInvestigacionSchema Zod schema
The system SHALL export an `updateIncidentInvestigacionSchema` Zod object schema from `src/features/incidents/schemas/createIncident.schema.ts` with all optional fields for the investigation phase:
- `personalInvolucrado`: `z.array(z.string()).optional()`
- `testigos`: `z.array(z.string()).optional()`
- `equiposInvolucrados`: `z.array(z.string()).optional()`
- `condicionesEntorno`: `z.array(z.enum([...CondicionEntornoValues])).optional()`
- `atencionMedicaRequerida`: `z.boolean().optional()`
- `atencionMedicaDescripcion`: `z.string().max(500).optional()`
- `notificacionAmbientalRequerida`: `z.boolean().optional()`

The schema SHALL also export `UpdateIncidentInvestigacionInput` as `z.infer<typeof updateIncidentInvestigacionSchema>`.

#### Scenario: updateIncidentInvestigacionSchema accepts empty object
- **WHEN** a developer calls `updateIncidentInvestigacionSchema.safeParse({})`
- **THEN** `success` is `true`

#### Scenario: updateIncidentInvestigacionSchema rejects invalid CondicionEntorno value
- **WHEN** a developer calls `updateIncidentInvestigacionSchema.safeParse({ condicionesEntorno: ['INVALIDO'] })`
- **THEN** `success` is `false` and the error path includes `['condicionesEntorno', 0]`

#### Scenario: updateIncidentInvestigacionSchema accepts valid condicionesEntorno array
- **WHEN** a developer calls `updateIncidentInvestigacionSchema.safeParse({ condicionesEntorno: ['ILUMINACION', 'EPP'] })`
- **THEN** `success` is `true`

---

### Requirement: createACIncidenteSchema Zod schema
The system SHALL export a `createACIncidenteSchema` Zod object schema from `src/features/incidents/schemas/createAC.schema.ts` with the following fields:
- `descripcion`: `z.string().min(10).max(1000)`
- `responsableId`: `z.string().min(1)`
- `fechaLimite`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — ISO date string (YYYY-MM-DD)

The schema SHALL also export `CreateACIncidenteInput` as `z.infer<typeof createACIncidenteSchema>`.

#### Scenario: createACIncidenteSchema rejects descripcion shorter than 10 characters
- **WHEN** a developer calls `createACIncidenteSchema.safeParse({ descripcion: 'Corto', responsableId: 'u1', fechaLimite: '2025-12-31' })`
- **THEN** `success` is `false` and the error path includes `['descripcion']`

#### Scenario: createACIncidenteSchema rejects invalid fechaLimite format
- **WHEN** a developer calls `createACIncidenteSchema.safeParse({ descripcion: 'Descripción de acción correctiva válida', responsableId: 'u1', fechaLimite: '31/12/2025' })`
- **THEN** `success` is `false` and the error path includes `['fechaLimite']`

#### Scenario: createACIncidenteSchema accepts valid payload
- **WHEN** a developer calls `createACIncidenteSchema.safeParse({ descripcion: 'Descripción de acción correctiva válida', responsableId: 'user-uuid', fechaLimite: '2025-12-31' })`
- **THEN** `success` is `true`
