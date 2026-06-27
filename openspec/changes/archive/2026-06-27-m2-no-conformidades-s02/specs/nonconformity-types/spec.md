# nonconformity-types

Delta spec for M2-S02. Extends the `NoConformidad` interface with domain classification, embedded corrective actions, and domain-specific fields. All changes are additive — no breaking changes to M2-S01 definitions.

## ADDED Requirements

### Requirement: NCDominio union type
The system SHALL define `NCDominio` as a TypeScript string literal union in `src/features/nonconformities/types/nonconformity.types.ts` covering the four organizational business areas: `'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'`. This determines the `numero` prefix (NC-CAL, NC-SST, NC-ADU, NC-OPE).

#### Scenario: NCDominio has exactly four values
- **WHEN** a developer assigns a `NCDominio` value
- **THEN** TypeScript accepts only `'CALIDAD'`, `'SST'`, `'ADUANERO'`, or `'OPERACIONAL'` and rejects any other string

#### Scenario: NCDominio is orthogonal to NCTipo
- **WHEN** a developer constructs a `NoConformidad` with `dominio='SST'` and `tipo='PROCESO'`
- **THEN** TypeScript accepts the combination without error, since both fields are independent

### Requirement: ACStatus union type
The system SHALL define `ACStatus` as a TypeScript string literal union: `'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'VENCIDA'`.

#### Scenario: ACStatus covers all corrective action lifecycle states
- **WHEN** a developer assigns an `ACStatus` value
- **THEN** TypeScript accepts only the four defined values and rejects any other string

### Requirement: AccionCorrectiva interface
The system SHALL define an `AccionCorrectiva` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required fields: `id` (string), `ncId` (string), `descripcion` (string), `responsableId` (string), `plazoFecha` (ISO 8601 string), `estado` (ACStatus), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `descripcionEvidencia` (string), `evidenciaUrl` (string), `fechaCierre` (ISO 8601 string).

#### Scenario: AccionCorrectiva requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectiva` without `plazoFecha`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectiva accepts absence of optional evidence fields
- **WHEN** a developer constructs an `AccionCorrectiva` with `descripcionEvidencia` and `evidenciaUrl` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: fechaCierre is only set when estado is COMPLETADA or VENCIDA
- **WHEN** a developer reads `accionCorrectiva.fechaCierre` on an AC in estado PENDIENTE
- **THEN** TypeScript allows `fechaCierre` to be `undefined` without narrowing error

### Requirement: NCNotificacionComercioExterior interface
The system SHALL define an `NCNotificacionComercioExterior` interface in `src/features/nonconformities/types/nonconformity.types.ts` with required fields: `fecha` (ISO 8601 string), `referencia` (string), `descripcion` (string).

#### Scenario: NCNotificacionComercioExterior requires all three fields
- **WHEN** a developer constructs an `NCNotificacionComercioExterior` without `referencia`
- **THEN** TypeScript emits a compile error for the missing field

### Requirement: CreateACInput, UpdateACInput, and CerrarACInput types
The system SHALL define `CreateACInput` as `{ descripcion: string; responsableId: string; plazoFecha: string }`, `UpdateACInput` as `Partial<Pick<AccionCorrectiva, 'descripcion' | 'responsableId' | 'plazoFecha' | 'estado'>>`, and `CerrarACInput` as `{ descripcionEvidencia: string; evidenciaUrl?: string }` in `src/features/nonconformities/types/nonconformity.types.ts`.

#### Scenario: CreateACInput rejects payload missing descripcion
- **WHEN** a developer assigns a `CreateACInput` without `descripcion`
- **THEN** TypeScript emits a compile error

#### Scenario: CerrarACInput requires descripcionEvidencia
- **WHEN** a developer assigns a `CerrarACInput` without `descripcionEvidencia`
- **THEN** TypeScript emits a compile error

## MODIFIED Requirements

### Requirement: NoConformidad interface
The system SHALL define a `NoConformidad` interface with the following required fields: `id`, `numero` (format `NC-[DOMINIO_ABBR]-YYYY-NNN` where DOMINIO_ABBR is CAL, SST, ADU, or OPE), `dominio` (NCDominio), `origen`, `tipo`, `severidad`, `estado`, `descripcion`, `areaAfectada`, `reportadoPorId`, `fechaDeteccion`, `fechaReporte`, `accionesCorrectivas` (AccionCorrectiva[]), `documentosVinculados`, `adjuntos`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include the following optional fields: `mineralInvolucrado`, `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `responsableInvestigacionId`, `accionInmediata`, `accionInmediataFecha`, `correccion`, `correccionEvidenciaUrl`, `causaRaiz`, `corregidoPorId`, `verificadoPorId`, `fechaVerificacion`, `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `qeGeneradoId`, `requiereIPER` (boolean — only meaningful when `dominio === 'SST'`), `notificacionComercioExterior` (NCNotificacionComercioExterior — only meaningful when `dominio === 'ADUANERO'`).

#### Scenario: NoConformidad requires dominio field
- **WHEN** a developer constructs a `NoConformidad` without `dominio`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: NoConformidad requires accionesCorrectivas array
- **WHEN** a developer constructs a `NoConformidad` without `accionesCorrectivas`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: NoConformidad accepts empty accionesCorrectivas
- **WHEN** a developer constructs a `NoConformidad` with `accionesCorrectivas: []`
- **THEN** TypeScript accepts the object without error

#### Scenario: requiereIPER is optional regardless of dominio
- **WHEN** a developer constructs a `NoConformidad` with `dominio='CALIDAD'` and `requiereIPER` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: numero format includes dominio abbreviation
- **WHEN** a developer reads `noConformidad.numero` on an SST non-conformity
- **THEN** the value matches the pattern `NC-SST-YYYY-NNN` (e.g., `'NC-SST-2025-001'`)

#### Scenario: NoConformidad rejects missing required fields from M2-S01
- **WHEN** a developer constructs a `NoConformidad` without `numero` or `areaAfectada`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: qeGeneradoId is typed as string or undefined
- **WHEN** a developer reads `noConformidad.qeGeneradoId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

### Requirement: NCFilters interface
The system SHALL define an `NCFilters` interface for list queries with the following optional fields: `estado` (NCStatus), `tipo` (NCTipo), `severidad` (NCSeveridad), `dominio` (NCDominio), `origen` (NCOrigen), `areaAfectada` (string), `reportadoPorId` (string), `search` (string), `fechaDesde` (ISO 8601 date string), `fechaHasta` (ISO 8601 date string), `page` (number), `pageSize` (number).

#### Scenario: NCFilters accepts dominio as an optional filter
- **WHEN** a developer passes `{ dominio: 'SST' }` as `NCFilters`
- **THEN** TypeScript accepts it without error or casting

#### Scenario: NCFilters accepts date range fields
- **WHEN** a developer passes `{ fechaDesde: '2025-01-01', fechaHasta: '2025-12-31' }` as `NCFilters`
- **THEN** TypeScript accepts it without error

#### Scenario: NCFilters with no fields is valid
- **WHEN** a developer passes an empty object `{}` as `NCFilters`
- **THEN** TypeScript accepts it without error
