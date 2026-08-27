## MODIFIED Requirements

### Requirement: NoConformidad interface
The system SHALL define a `NoConformidad` interface with the following required fields: `id`, `numero` (format `NC-[DOMINIO_ABBR]-YYYY-NNN` where DOMINIO_ABBR is CAL, SST, ADU, OPE, or PRV), `dominio` (NCDominio), `titulo` (string), `origen`, `tipo`, `severidad`, `estado`, `descripcion`, `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `empresaId` (string — FK to `Empresa.id`, required and immutable after creation per RN-EMP-001), `reportadoPorId`, `fechaDeteccion`, `fechaReporte`, `requiereIPER` (boolean — only meaningful when `dominio === 'NC-SST'`), `accionesCorrectivas` (AccionCorrectiva[]), `documentosVinculados`, `adjuntos`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include the following optional fields: `detectadoPor` (string or undefined), `justificacionAnulacion` (string or undefined), `mineralInvolucrado`, `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `responsableInvestigacionId`, `accionInmediata`, `accionInmediataFecha`, `correccion`, `correccionEvidenciaUrl`, `causaRaiz`, `corregidoPorId`, `verificadoPorId`, `fechaVerificacion`, `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `qeGeneradoId`, `notificacionComercioExterior` (NCNotificacionComercioExterior — only meaningful when `dominio === 'NC-ADU'`). The interface SHALL NOT include an `areaAfectada` field — it is replaced by `areaId`.

`documentosVinculados` SHALL be typed as `DocumentoVinculadoResumen[]` (`{ id: string; codigo: string; titulo: string; estado: DocStatus }`), not `string[]` — a non-conformity's linked documents carry enough summary data to render a badge/label without a second lookup. This is a breaking change from the previous `string[]` (raw id list) shape. `DocumentoVinculadoResumen` SHALL be declared locally in `src/features/nonconformities/types/nonconformity.types.ts` (same pattern as the equivalent local declaration in `qualityEvent.types.ts` — each feature module owns its own copy of this DTO shape, no cross-feature type import).

`empresaId` SHALL NOT appear in any update/edit Zod schema or form payload type for `NoConformidad` — it is set only once, at creation time, by the MSW create handler. No production UI in this phase exposes `empresaId` for editing (multi-company UI is Fase 2-4).

#### Scenario: NoConformidad rejects missing required fields
- **WHEN** a developer constructs a `NoConformidad` without `numero` or `areaId`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: NoConformidad requires dominio field
- **WHEN** a developer constructs a `NoConformidad` without `dominio`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: NoConformidad requires accionesCorrectivas array
- **WHEN** a developer constructs a `NoConformidad` without `accionesCorrectivas`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: NoConformidad accepts justificacionAnulacion when estado is ANULADA
- **WHEN** a developer reads `nc.justificacionAnulacion` on a `NoConformidad` with `estado === 'ANULADA'`
- **THEN** TypeScript infers the type as `string | undefined` without narrowing errors

#### Scenario: NoConformidad accepts empty accionesCorrectivas
- **WHEN** a developer constructs a `NoConformidad` with `accionesCorrectivas: []`
- **THEN** TypeScript accepts the object without error

#### Scenario: NoConformidad accepts valid optional fields as undefined
- **WHEN** a developer constructs a `NoConformidad` with `mineralInvolucrado` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: numero format includes dominio abbreviation
- **WHEN** a developer reads `noConformidad.numero` on an SST non-conformity
- **THEN** the value matches the pattern `NC-SST-YYYY-NNN` (e.g., `'NC-SST-2025-001'`)

#### Scenario: qeGeneradoId is typed as string or undefined
- **WHEN** a developer reads `noConformidad.qeGeneradoId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

#### Scenario: resultadoVerificacion is a two-value union
- **WHEN** a developer assigns `resultadoVerificacion`
- **THEN** TypeScript accepts only `'EFECTIVO'` or `'NO_EFECTIVO'` and rejects any other string

#### Scenario: NoConformidad no longer has an areaAfectada field
- **WHEN** a developer attempts to read or assign `nc.areaAfectada`
- **THEN** TypeScript emits a compile error, as the property does not exist on `NoConformidad` — the field is `areaId`

#### Scenario: NoConformidad requires empresaId field
- **WHEN** a developer constructs a `NoConformidad` object without `empresaId`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: empresaId is typed as a required string
- **WHEN** a developer reads `noConformidad.empresaId`
- **THEN** TypeScript infers the type as `string`, not `string | undefined`

#### Scenario: documentosVinculados is typed as DocumentoVinculadoResumen array, not string array
- **WHEN** a developer reads `noConformidad.documentosVinculados[0]`
- **THEN** TypeScript infers a `DocumentoVinculadoResumen` object with `id`, `codigo`, `titulo`, `estado` — not a bare `string`

#### Scenario: documentosVinculados as string[] is a compile error
- **WHEN** a developer constructs a `NoConformidad` with `documentosVinculados: ['doc-001']`
- **THEN** TypeScript emits a compile error, since `'doc-001'` is not assignable to `DocumentoVinculadoResumen`
