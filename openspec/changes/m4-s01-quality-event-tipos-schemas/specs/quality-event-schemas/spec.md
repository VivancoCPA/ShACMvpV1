# Spec: quality-event-schemas

## Purpose

Zod validation schemas for the Quality Event domain. Covers QE creation (discriminated by origin), root-cause analysis blocks (5 Porqués and Ishikawa), and the closure block. All schemas are co-located under `src/features/quality-events/schemas/`.

---

## ADDED Requirements

### Requirement: cincoPorquesSchema Zod schema
The system SHALL export a `cincoPorquesSchema` Zod schema from `src/features/quality-events/schemas/qualityEventCreate.schema.ts` that validates an array of exactly 5 `CincoPorques` entries. Each entry SHALL have `pregunta` (`z.string().min(1)`) and `respuesta` (`z.string().min(1)`). The schema SHALL use `z.array(...).length(5)` to enforce exactly five entries. The schema SHALL also export `CincoPorquesInput` as `z.infer<typeof cincoPorquesSchema>`.

#### Scenario: cincoPorquesSchema rejects array with fewer than 5 entries
- **WHEN** a developer calls `cincoPorquesSchema.safeParse([{ pregunta: '¿Por qué?', respuesta: 'Porque...' }])`
- **THEN** `success` is `false` and the error indicates the array length constraint

#### Scenario: cincoPorquesSchema rejects array with more than 5 entries
- **WHEN** a developer calls `cincoPorquesSchema.safeParse(Array(6).fill({ pregunta: '¿Por qué?', respuesta: 'Porque...' }))`
- **THEN** `success` is `false` and the error indicates the array length constraint

#### Scenario: cincoPorquesSchema accepts exactly 5 entries
- **WHEN** a developer calls `cincoPorquesSchema.safeParse(Array(5).fill({ pregunta: '¿Por qué ocurrió?', respuesta: 'Porque fallaron los controles' }))`
- **THEN** `success` is `true`

#### Scenario: cincoPorquesSchema rejects entries with empty pregunta
- **WHEN** a developer calls `cincoPorquesSchema.safeParse([...4 valid entries, { pregunta: '', respuesta: 'Respuesta' }])`
- **THEN** `success` is `false` and the error path includes the entry at index 4 and field `pregunta`

---

### Requirement: ishikawaSchema Zod schema
The system SHALL export an `ishikawaSchema` Zod schema from `src/features/quality-events/schemas/qualityEventCreate.schema.ts` that validates an array of `Ishikawa` entries. Each entry SHALL have `categoria` (`z.enum(['METODO','MAQUINA','MATERIAL','MANO_DE_OBRA','MEDICION','MEDIO_AMBIENTE'])`) and `causa` (`z.string().min(5)`). The array SHALL have at minimum 1 entry (`z.array(...).min(1)`). The schema SHALL also export `IshikawaInput` as `z.infer<typeof ishikawaSchema>`.

#### Scenario: ishikawaSchema rejects empty array
- **WHEN** a developer calls `ishikawaSchema.safeParse([])`
- **THEN** `success` is `false`

#### Scenario: ishikawaSchema rejects entry with invalid categoria
- **WHEN** a developer calls `ishikawaSchema.safeParse([{ categoria: 'PERSONA', causa: 'Falta de capacitación' }])`
- **THEN** `success` is `false` and the error path includes `[0].categoria`

#### Scenario: ishikawaSchema rejects entry with causa shorter than 5 characters
- **WHEN** a developer calls `ishikawaSchema.safeParse([{ categoria: 'METODO', causa: 'Err' }])`
- **THEN** `success` is `false` and the error path includes `[0].causa`

#### Scenario: ishikawaSchema accepts valid entries across multiple categories
- **WHEN** a developer calls `ishikawaSchema.safeParse([{ categoria: 'METODO', causa: 'Procedimiento desactualizado' }, { categoria: 'MANO_DE_OBRA', causa: 'Personal no capacitado en el proceso' }])`
- **THEN** `success` is `true`

---

### Requirement: qualityEventCreateSchema Zod schema
The system SHALL export a `qualityEventCreateSchema` Zod discriminated union schema from `src/features/quality-events/schemas/qualityEventCreate.schema.ts`, discriminated on the `origen` field. Each branch SHALL include the shared base fields and origin-specific required fields:

**Shared base fields (all origins):**
- `origen`: the discriminant key (`QEOrigin` literal per branch)
- `tipo`: `z.enum(['CALIDAD','SST','ADUANERO','OPERACIONAL'])`
- `severidad`: `z.enum(['BAJA','MEDIA','ALTA','CRITICA'])`
- `descripcion`: `z.string().min(10).max(2000)`
- `areaAfectada`: `z.string().min(1)`
- `turno`: `z.enum(['DIA','TARDE','NOCHE'])`
- `fechaHoraEvento`: `z.string().datetime({ message: 'Fecha/hora inválida' })`
- `mineralInvolucrado`: `z.string().optional()`

**Origin-specific required fields:**
- `O1_INCIDENTE_CAMPO`: `incidenteId: z.string().min(1, 'Se requiere el incidente vinculado')`
- `O2_NC_DETECTADA`: `ncId: z.string().min(1, 'Se requiere la no conformidad vinculada')`
- `O3_HALLAZGO_AUDITORIA`: `hallazgoAuditoriaRef: z.string().min(1, 'Se requiere referencia al hallazgo de auditoría')`
- `O4_REPORTE_EXTERNO`: `reporteExternoRef: z.object({ nombreCliente: z.string().min(1), fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })`

The schema SHALL also export `QualityEventCreateInput` as `z.infer<typeof qualityEventCreateSchema>`.

#### Scenario: qualityEventCreateSchema O1 branch rejects when incidenteId is absent
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `incidenteId`

#### Scenario: qualityEventCreateSchema O1 branch accepts when incidenteId is present
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', incidenteId: 'inc-001' })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema O2 branch rejects when ncId is absent
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O2_NC_DETECTADA', tipo: 'CALIDAD', severidad: 'MEDIA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Control', turno: 'TARDE', fechaHoraEvento: '2025-06-01T14:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `ncId`

#### Scenario: qualityEventCreateSchema O3 branch rejects when hallazgoAuditoriaRef is absent
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'CALIDAD', severidad: 'BAJA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Operaciones', turno: 'NOCHE', fechaHoraEvento: '2025-06-01T22:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `hallazgoAuditoriaRef`

#### Scenario: qualityEventCreateSchema O4 branch rejects when reporteExternoRef is absent
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O4_REPORTE_EXTERNO', tipo: 'ADUANERO', severidad: 'CRITICA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Importación', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `reporteExternoRef`

#### Scenario: qualityEventCreateSchema O4 branch accepts valid reporteExternoRef
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O4_REPORTE_EXTERNO', tipo: 'ADUANERO', severidad: 'CRITICA', descripcion: 'Descripción del evento de calidad', areaAfectada: 'Importación', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', reporteExternoRef: { nombreCliente: 'Minera ABC', fechaRecepcion: '2025-06-01' } })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema rejects fechaHoraEvento as non-datetime string
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', ..., fechaHoraEvento: '01/06/2025', incidenteId: 'inc-001' })`
- **THEN** `success` is `false` and the error path includes `fechaHoraEvento`

#### Scenario: qualityEventCreateSchema rejects descripcion shorter than 10 characters
- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Corto', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', incidenteId: 'inc-001' })`
- **THEN** `success` is `false` and the error path includes `descripcion`

---

### Requirement: qualityEventCierreSchema Zod schema
The system SHALL export a `qualityEventCierreSchema` Zod object schema from `src/features/quality-events/schemas/qualityEventCierre.schema.ts` with the following fields:
- `resultadoCierre`: `z.string().min(100, 'Mínimo 100 caracteres').max(500)`
- `cerradoPorId`: `z.string().min(1)`
- `cierreFirmaSupervisorId`: `z.string().min(1)`
- `plazoVerificacionDias`: `z.number().int().min(1).default(60)`

The schema SHALL also export `QualityEventCierreInput` as `z.infer<typeof qualityEventCierreSchema>`.

#### Scenario: qualityEventCierreSchema rejects resultadoCierre shorter than 100 characters
- **WHEN** a developer calls `qualityEventCierreSchema.safeParse({ resultadoCierre: 'Muy corto', cerradoPorId: 'jc-1', cierreFirmaSupervisorId: 'sup-1', plazoVerificacionDias: 60 })`
- **THEN** `success` is `false` and the error path includes `resultadoCierre`

#### Scenario: qualityEventCierreSchema rejects when cerradoPorId is absent
- **WHEN** a developer calls `qualityEventCierreSchema.safeParse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido', cierreFirmaSupervisorId: 'sup-1', plazoVerificacionDias: 60 })`
- **THEN** `success` is `false` and the error path includes `cerradoPorId`

#### Scenario: qualityEventCierreSchema rejects when cierreFirmaSupervisorId is absent
- **WHEN** a developer calls `qualityEventCierreSchema.safeParse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido', cerradoPorId: 'jc-1', plazoVerificacionDias: 60 })`
- **THEN** `success` is `false` and the error path includes `cierreFirmaSupervisorId`

#### Scenario: qualityEventCierreSchema applies default plazoVerificacionDias of 60 when not provided
- **WHEN** a developer calls `qualityEventCierreSchema.parse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido', cerradoPorId: 'jc-1', cierreFirmaSupervisorId: 'sup-1' })`
- **THEN** the parsed result has `plazoVerificacionDias` equal to `60`

#### Scenario: qualityEventCierreSchema accepts valid full payload
- **WHEN** a developer calls `qualityEventCierreSchema.safeParse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido por el schema', cerradoPorId: 'jc-1', cierreFirmaSupervisorId: 'sup-1', plazoVerificacionDias: 30 })`
- **THEN** `success` is `true`
