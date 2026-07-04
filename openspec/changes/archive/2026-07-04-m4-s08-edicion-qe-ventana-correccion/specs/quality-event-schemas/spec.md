## ADDED Requirements

### Requirement: qualityEventEditReporteInicialSchema Zod schema
The system SHALL export a `qualityEventEditReporteInicialSchema` Zod object schema (built with `.strict()`, no passthrough) from `src/features/quality-events/schemas/qualityEventEditReporteInicial.schema.ts`, covering exactly the fields editable under RN-QE-010: `descripcion` (string, min 10 / max 2000, matching `qualityEventCreateSchema`'s constraint), `areaAfectada` (string, min 1), `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `fechaHoraEvento` (ISO datetime string, must not be a future date), `mineralInvolucrado` (string, optional), and the origin-specific fields (`incidenteId`, `ncId`, `hallazgoAuditoriaRef`, `reporteExternoRef`), all optional at the schema level (presence is enforced by which origin the QE already has, not re-validated here). The schema SHALL export `QualityEventEditReporteInicialInput` as `z.infer<typeof qualityEventEditReporteInicialSchema>`. Because the schema is `.strict()`, `safeParse` SHALL reject any payload containing `numero`, `origen`, `tipo`, `fechaHoraReporte`, `reportadoPorId`, or `severidad`.

#### Scenario: Valid payload with only RN-QE-010 fields parses successfully
- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaAfectada: 'Almacén Norte', turno: 'TARDE', fechaHoraEvento: '2026-05-01T08:00:00Z' })`
- **THEN** `success` is `true`

#### Scenario: Payload containing numero is rejected
- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z', numero: 'QE-2026-010' })`
- **THEN** `success` is `false`

#### Scenario: Payload containing severidad is rejected
- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Descripción corregida del evento', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z', severidad: 'CRITICA' })`
- **THEN** `success` is `false`

#### Scenario: descripcion shorter than 10 characters is rejected
- **WHEN** a developer calls `qualityEventEditReporteInicialSchema.safeParse({ descripcion: 'Corto', areaAfectada: 'Almacén', turno: 'DIA', fechaHoraEvento: '2026-05-01T08:00:00Z' })`
- **THEN** `success` is `false`

---

### Requirement: qualityEventEditSeveridadSchema Zod schema
The system SHALL export a `qualityEventEditSeveridadSchema` Zod object schema (`.strict()`) from `src/features/quality-events/schemas/qualityEventEditSeveridad.schema.ts` with exactly one field: `severidad` (`QESeverity` enum). The schema SHALL export `QualityEventEditSeveridadInput` as `z.infer<typeof qualityEventEditSeveridadSchema>`.

#### Scenario: Valid severidad value parses successfully
- **WHEN** a developer calls `qualityEventEditSeveridadSchema.safeParse({ severidad: 'CRITICA' })`
- **THEN** `success` is `true`

#### Scenario: Invalid severidad value is rejected
- **WHEN** a developer calls `qualityEventEditSeveridadSchema.safeParse({ severidad: 'URGENTE' })`
- **THEN** `success` is `false`

#### Scenario: Extra field is rejected
- **WHEN** a developer calls `qualityEventEditSeveridadSchema.safeParse({ severidad: 'ALTA', mineralInvolucrado: 'Cobre' })`
- **THEN** `success` is `false`

---

### Requirement: qualityEventEditMineralSchema Zod schema
The system SHALL export a `qualityEventEditMineralSchema` Zod object schema (`.strict()`) from `src/features/quality-events/schemas/qualityEventEditMineral.schema.ts` with exactly one field: `mineralInvolucrado` (string, min 1). The schema SHALL export `QualityEventEditMineralInput` as `z.infer<typeof qualityEventEditMineralSchema>`.

#### Scenario: Valid mineralInvolucrado value parses successfully
- **WHEN** a developer calls `qualityEventEditMineralSchema.safeParse({ mineralInvolucrado: 'Cobre' })`
- **THEN** `success` is `true`

#### Scenario: Empty mineralInvolucrado is rejected
- **WHEN** a developer calls `qualityEventEditMineralSchema.safeParse({ mineralInvolucrado: '' })`
- **THEN** `success` is `false`

#### Scenario: Extra field is rejected
- **WHEN** a developer calls `qualityEventEditMineralSchema.safeParse({ mineralInvolucrado: 'Cobre', severidad: 'ALTA' })`
- **THEN** `success` is `false`
