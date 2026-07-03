## REMOVED Requirements

### Requirement: qualityEventCierreSchema Zod schema
**Reason**: The schema bundled `cerradoPorId` and `cierreFirmaSupervisorId` into the same object as the user-entered form fields (`resultadoCierre`, `plazoVerificacionDias`), but the UI never collects signer IDs as form input — they are derived from the authenticated user at signature time via two separate `PATCH /:id/firmar-cierre` calls. Bundling them made the schema unusable for either the closure-form submission or the signature submission as actually implemented in `quality-event-cierre`.
**Migration**: Use `qualityEventCierreFormSchema` (below) for the closure form; use `firmarCierreSchema` (below) for each signature submission.

---

## ADDED Requirements

### Requirement: qualityEventCierreFormSchema Zod schema
The system SHALL export a `qualityEventCierreFormSchema` Zod object schema from `src/features/quality-events/schemas/qualityEventCierre.schema.ts` with the following fields:
- `resultadoCierre`: `z.string().min(100, 'Mínimo 100 caracteres').max(500)`
- `plazoVerificacionDias`: `z.number().int().min(1).default(60)`

The schema SHALL also export `QualityEventCierreFormInput` as `z.infer<typeof qualityEventCierreFormSchema>`.

#### Scenario: qualityEventCierreFormSchema rejects resultadoCierre shorter than 100 characters
- **WHEN** a developer calls `qualityEventCierreFormSchema.safeParse({ resultadoCierre: 'Muy corto', plazoVerificacionDias: 60 })`
- **THEN** `success` is `false` and the error path includes `resultadoCierre`

#### Scenario: qualityEventCierreFormSchema applies default plazoVerificacionDias of 60 when not provided
- **WHEN** a developer calls `qualityEventCierreFormSchema.parse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido' })`
- **THEN** the parsed result has `plazoVerificacionDias` equal to `60`

#### Scenario: qualityEventCierreFormSchema accepts a valid full payload
- **WHEN** a developer calls `qualityEventCierreFormSchema.safeParse({ resultadoCierre: 'Resultado de cierre con descripción suficientemente larga para superar el mínimo de cien caracteres requerido por el schema', plazoVerificacionDias: 90 })`
- **THEN** `success` is `true`

#### Scenario: qualityEventCierreFormSchema rejects resultadoCierre over 500 characters
- **WHEN** a developer calls `qualityEventCierreFormSchema.safeParse({ resultadoCierre: 'x'.repeat(501), plazoVerificacionDias: 60 })`
- **THEN** `success` is `false` and the error path includes `resultadoCierre`

---

### Requirement: firmarCierreSchema Zod schema
The system SHALL export a `firmarCierreSchema` Zod object schema from `src/features/quality-events/schemas/firmarCierre.schema.ts` with the following fields:
- `rol`: `z.enum(['JEFE_CALIDAD_SYST', 'SUPERVISOR', 'ALTA_DIRECCION'])`
- `pin`: `z.string().length(4, 'El PIN debe tener 4 dígitos')`

The schema SHALL also export `FirmarCierreInput` as `z.infer<typeof firmarCierreSchema>`.

#### Scenario: firmarCierreSchema rejects an invalid rol
- **WHEN** a developer calls `firmarCierreSchema.safeParse({ rol: 'OPERARIO', pin: '1234' })`
- **THEN** `success` is `false` and the error path includes `rol`

#### Scenario: firmarCierreSchema rejects a pin with fewer than 4 characters
- **WHEN** a developer calls `firmarCierreSchema.safeParse({ rol: 'JEFE_CALIDAD_SYST', pin: '12' })`
- **THEN** `success` is `false` and the error path includes `pin`

#### Scenario: firmarCierreSchema accepts a valid payload
- **WHEN** a developer calls `firmarCierreSchema.safeParse({ rol: 'SUPERVISOR', pin: '1234' })`
- **THEN** `success` is `true`

---

### Requirement: verificacionEficaciaSchema Zod schema
The system SHALL export a `verificacionEficaciaSchema` Zod object schema from `src/features/quality-events/schemas/verificacionEficacia.schema.ts` with the following fields:
- `resultado`: `z.enum(['EFECTIVO', 'NO_EFECTIVO'])`
- `evidencia`: `z.string().trim().min(1, 'La evidencia es obligatoria')`

The schema SHALL also export `VerificacionEficaciaInput` as `z.infer<typeof verificacionEficaciaSchema>`.

#### Scenario: verificacionEficaciaSchema rejects empty evidencia
- **WHEN** a developer calls `verificacionEficaciaSchema.safeParse({ resultado: 'EFECTIVO', evidencia: '   ' })`
- **THEN** `success` is `false` and the error path includes `evidencia`

#### Scenario: verificacionEficaciaSchema rejects an invalid resultado
- **WHEN** a developer calls `verificacionEficaciaSchema.safeParse({ resultado: 'PARCIAL', evidencia: 'Texto' })`
- **THEN** `success` is `false` and the error path includes `resultado`

#### Scenario: verificacionEficaciaSchema accepts a valid NO_EFECTIVO payload
- **WHEN** a developer calls `verificacionEficaciaSchema.safeParse({ resultado: 'NO_EFECTIVO', evidencia: 'Se detectó recurrencia del defecto' })`
- **THEN** `success` is `true`
