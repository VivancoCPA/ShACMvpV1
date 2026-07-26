## MODIFIED Requirements

### Requirement: qualityEventCreateSchema Zod schema

The system SHALL export a `qualityEventCreateSchema` Zod discriminated union schema from `src/features/quality-events/schemas/qualityEventCreate.schema.ts`, discriminated on the `origen` field. Each branch SHALL include the shared base fields and origin-specific required fields:

**Shared base fields (all origins):**
- `origen`: the discriminant key (`QEOrigin` literal per branch)
- `tipo`: `z.enum(['CALIDAD','SST','ADUANERO','OPERACIONAL'])`
- `severidad`: `z.enum(['BAJA','MEDIA','ALTA','CRITICA'])`
- `descripcion`: `z.string().min(10).max(2000)`
- `areaId`: `z.string().min(1)` — FK to `Area.id` (M6-S08 administered area catalog); referential integrity against the catalog is not validated at the schema level (see `area-admin-mocks` Non-Goals)
- `turno`: `z.enum(['DIA','TARDE','NOCHE'])`
- `fechaHoraEvento`: `z.string().datetime({ message: 'Fecha/hora inválida' })`
- `mineralInvolucrado`: `z.string().optional()`

**Origin-specific required fields:**
- `O1_INCIDENTE_CAMPO`: `incidenteId: z.string().min(1, 'Se requiere el incidente vinculado')`
- `O2_NC_DETECTADA`: `ncId: z.string().min(1, 'Se requiere la no conformidad vinculada')`
- `O3_HALLAZGO_AUDITORIA`: `hallazgoCodigo: z.string().min(1, 'Se requiere el código del hallazgo')` and `normativaVinculada: z.object({ norma: z.enum(['ISO_9001_2015', 'ISO_45001_2018', 'OTRA']), clausula: z.string().min(1, 'Se requiere la cláusula incumplida'), normaOtraDetalle: z.string().min(1).optional() }).refine((v) => v.norma !== 'OTRA' || !!v.normaOtraDetalle, { message: 'Se requiere el detalle de la normativa cuando norma es OTRA', path: ['normaOtraDetalle'] })` — both required (RN-QE-010: registro obligatorio de la cláusula de norma incumplida para hallazgos de auditoría).
- `O4_REPORTE_EXTERNO`: `reporteExternoRef: z.object({ nombreCliente: z.string().min(1), fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })`

The schema SHALL also export `QualityEventCreateInput` as `z.infer<typeof qualityEventCreateSchema>`.

#### Scenario: qualityEventCreateSchema O1 branch rejects when incidenteId is absent

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Descripción del evento de calidad', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `incidenteId`

#### Scenario: qualityEventCreateSchema O1 branch accepts when incidenteId is present

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Descripción del evento de calidad', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', incidenteId: 'inc-001' })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema O2 branch rejects when ncId is absent

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O2_NC_DETECTADA', tipo: 'CALIDAD', severidad: 'MEDIA', descripcion: 'Descripción del evento de calidad', areaId: 'area-002', turno: 'TARDE', fechaHoraEvento: '2025-06-01T14:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `ncId`

#### Scenario: qualityEventCreateSchema O3 branch rejects when normativaVinculada is absent

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'CALIDAD', severidad: 'BAJA', descripcion: 'Descripción del evento de calidad', areaId: 'area-003', turno: 'NOCHE', fechaHoraEvento: '2025-06-01T22:00:00Z', hallazgoCodigo: 'HAL-2026-010' })`
- **THEN** `success` is `false` and the error path includes `normativaVinculada`

#### Scenario: qualityEventCreateSchema O3 branch rejects when hallazgoCodigo is absent

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'CALIDAD', severidad: 'BAJA', descripcion: 'Descripción del evento de calidad', areaId: 'area-003', turno: 'NOCHE', fechaHoraEvento: '2025-06-01T22:00:00Z', normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' } })`
- **THEN** `success` is `false` and the error path includes `hallazgoCodigo`

#### Scenario: qualityEventCreateSchema O3 branch rejects normativaVinculada with norma OTRA and no normaOtraDetalle

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'OPERACIONAL', severidad: 'MEDIA', descripcion: 'Descripción del evento de calidad', areaId: 'area-004', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', hallazgoCodigo: 'HAL-2026-011', normativaVinculada: { norma: 'OTRA', clausula: '3.2' } })`
- **THEN** `success` is `false` and the error path includes `normativaVinculada.normaOtraDetalle`

#### Scenario: qualityEventCreateSchema O3 branch accepts a valid ISO normativaVinculada

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'CALIDAD', severidad: 'BAJA', descripcion: 'Descripción del evento de calidad', areaId: 'area-003', turno: 'NOCHE', fechaHoraEvento: '2025-06-01T22:00:00Z', hallazgoCodigo: 'HAL-2026-010', normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' } })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema O3 branch accepts a valid OTRA normativaVinculada with normaOtraDetalle

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O3_HALLAZGO_AUDITORIA', tipo: 'OPERACIONAL', severidad: 'MEDIA', descripcion: 'Descripción del evento de calidad', areaId: 'area-004', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', hallazgoCodigo: 'HAL-2026-011', normativaVinculada: { norma: 'OTRA', clausula: '3.2', normaOtraDetalle: 'Auditoría Operacional' } })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema O4 branch rejects when reporteExternoRef is absent

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O4_REPORTE_EXTERNO', tipo: 'ADUANERO', severidad: 'CRITICA', descripcion: 'Descripción del evento de calidad', areaId: 'area-005', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z' })`
- **THEN** `success` is `false` and the error path includes `reporteExternoRef`

#### Scenario: qualityEventCreateSchema O4 branch accepts valid reporteExternoRef

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O4_REPORTE_EXTERNO', tipo: 'ADUANERO', severidad: 'CRITICA', descripcion: 'Descripción del evento de calidad', areaId: 'area-005', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', reporteExternoRef: { nombreCliente: 'Minera ABC', fechaRecepcion: '2025-06-01' } })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCreateSchema rejects fechaHoraEvento as non-datetime string

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', ..., fechaHoraEvento: '01/06/2025', incidenteId: 'inc-001' })`
- **THEN** `success` is `false` and the error path includes `fechaHoraEvento`

#### Scenario: qualityEventCreateSchema rejects descripcion shorter than 10 characters

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Corto', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', incidenteId: 'inc-001' })`
- **THEN** `success` is `false` and the error path includes `descripcion`

#### Scenario: qualityEventCreateSchema rejects missing areaId

- **WHEN** a developer calls `qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', tipo: 'SST', severidad: 'ALTA', descripcion: 'Descripción del evento de calidad', turno: 'DIA', fechaHoraEvento: '2025-06-01T08:00:00Z', incidenteId: 'inc-001' })`
- **THEN** `success` is `false` and the error path includes `areaId`

---

### Requirement: qualityEventEditReporteInicialSchema Zod schema

The system SHALL export a `qualityEventEditReporteInicialSchema` Zod object schema (built with `.strict()`, no passthrough) from `src/features/quality-events/schemas/qualityEventEditReporteInicial.schema.ts`, covering exactly the fields editable under RN-QE-014: `descripcion` (string, min 10 / max 2000, matching `qualityEventCreateSchema`'s constraint), `areaId` (string, min 1 — FK to `Area.id`), `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `fechaHoraEvento` (ISO datetime string, must not be a future date), `mineralInvolucrado` (string, optional), and the origin-specific fields (`incidenteId`, `ncId`, `hallazgoCodigo`, `normativaVinculada`, `reporteExternoRef`), all optional at the schema level (presence is enforced by which origin the QE already has, not re-validated here). The schema SHALL export `QualityEventEditReporteInicialInput` as `z.infer<typeof qualityEventEditReporteInicialSchema>`. Because the schema is `.strict()`, `safeParse` SHALL reject any payload containing `numero`, `origen`, `tipo`, `fechaHoraReporte`, `reportadoPorId`, or `severidad`.

#### Scenario: Valid payload with only RN-QE-014 fields parses successfully

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaId: 'area-001', turno: 'TARDE', fechaHoraEvento: '2026-05-01T08:00:00Z' })`
- **THEN** `success` is `true`

#### Scenario: Valid payload editing hallazgoCodigo and normativaVinculada for an O3 QE parses successfully

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del hallazgo', areaId: 'area-006', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z', hallazgoCodigo: 'HAL-2026-001', normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.2' } })`
- **THEN** `success` is `true`

#### Scenario: Payload containing numero is rejected

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z', numero: 'QE-2026-010' })`
- **THEN** `success` is `false`

#### Scenario: Payload containing severidad is rejected

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z', severidad: 'CRITICA' })`
- **THEN** `success` is `false`

#### Scenario: descripcion shorter than 10 characters is rejected

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Corto', areaId: 'area-001', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z' })`
- **THEN** `success` is `false`

#### Scenario: Payload containing areaAfectada instead of areaId is rejected

- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaAfectada: 'Almacén Norte', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z' })`
- **THEN** `success` is `false`, since `.strict()` rejects the unknown key `areaAfectada` and `areaId` is absent
