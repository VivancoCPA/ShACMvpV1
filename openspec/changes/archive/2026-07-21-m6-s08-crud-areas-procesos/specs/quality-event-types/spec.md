## MODIFIED Requirements

### Requirement: QualityEvent interface

The system SHALL define a `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts` with the following required fields: `id` (string), `numero` (string, format `QE-YYYY-NNN`), `origen` (QEOrigin), `tipo` (QEType), `severidad` (QESeverity), `estado` (QEStatus), `ciclo` (number), `descripcion` (string), `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `fechaHoraEvento` (ISO 8601 string), `fechaHoraReporte` (ISO 8601 string), `reportadoPorId` (string), `documentosVinculados` (string[]), `requiereEvaluacionRiesgos` (boolean), `accionesCorrectivas` (AccionCorrectivaQE[]), `auditTrail` (QEAuditTrailEntry[]), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `mineralInvolucrado` (string), `ncId` (string), `incidenteId` (string), `hallazgoCodigo` (string), `normativaVinculada` (`NormativaVinculada`, from `quality-event-normativa-catalog`), `reporteExternoRef` (ReporteExternoRef), `descripcionAmpliada` (string), `metodoAnalisis` (AnalisisCausaRaizMetodo), `cincoPorques` (CincoPorques[]), `ishikawa` (Ishikawa[]), `causaRaizDefinitiva` (string), `causaRaizAprobadaPorId` (string), `causaRaizFirmadaEn` (string), `evaluacionRiesgosRef` (string), `resultadoCierre` (string), `cerradoPorId` (string), `cierreFirmaSupervisorId` (string), `cierreFirmaSupervisorRol` (`'SUPERVISOR' | 'ALTA_DIRECCION'`), `fechaCierre` (ISO 8601 string), `plazoVerificacionDias` (number), `fechaVerificacionProgramada` (string), `fechaVerificacionRealizada` (string), `verificadoPorId` (string), `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `evidenciaVerificacion` (string), `auditorAsignadoId` (string). The interface SHALL NOT include a `hallazgoAuditoriaRef` field — it is replaced by `hallazgoCodigo` and `normativaVinculada`. The interface SHALL NOT include an `areaAfectada` field — it is replaced by `areaId`.

`hallazgoCodigo` and `normativaVinculada` are only meaningful for `origen === 'O3_HALLAZGO_AUDITORIA'`; they SHALL be absent for QEs of any other origin. Obligatoriedad condicional para origen O3 (RN-QE-010) SHALL be enforced at the Zod schema level (`quality-event-schemas`), not by the TypeScript type itself — both fields remain optional at the interface level so existing non-O3 QEs (and QEs under construction before origin is selected) type-check without them.

`auditorAsignadoId` identifies the `AUDITOR_INTERNO` user responsible for the REG-EFEC-001 effectiveness verification once the QE reaches `EN_VERIFICACION`. It SHALL be absent for QEs that have not yet been assigned an auditor (including all QEs before `CERRADO`), and is set exclusively via the `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` flow described in `quality-event-verificacion`.

#### Scenario: QualityEvent rejects missing required fields

- **WHEN** a developer constructs a `QualityEvent` without `numero` or `areaId`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: QualityEvent accepts all optional fields absent

- **WHEN** a developer constructs a `QualityEvent` with only required fields
- **THEN** TypeScript accepts the object without error

#### Scenario: QualityEvent accepts ncId as string or undefined

- **WHEN** a developer reads `qe.ncId` on a QualityEvent
- **THEN** TypeScript infers the type as `string | undefined`

#### Scenario: QualityEvent accepts resultadoVerificacion as EFECTIVO or NO_EFECTIVO

- **WHEN** a developer assigns `qe.resultadoVerificacion = 'EFECTIVO'`
- **THEN** TypeScript accepts the assignment without error

#### Scenario: QualityEvent accepts cierreFirmaSupervisorRol as SUPERVISOR or ALTA_DIRECCION

- **WHEN** a developer assigns `qe.cierreFirmaSupervisorRol = 'ALTA_DIRECCION'`
- **THEN** TypeScript accepts the assignment without error

#### Scenario: QualityEvent accepts fechaCierre and evidenciaVerificacion as optional strings

- **WHEN** a developer constructs a `QualityEvent` with `fechaCierre` and `evidenciaVerificacion` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: QualityEvent accepts auditorAsignadoId as an optional string

- **WHEN** a developer constructs a `QualityEvent` with `auditorAsignadoId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: auditorAsignadoId is readable as string | undefined

- **WHEN** a developer reads `qe.auditorAsignadoId` on a QualityEvent
- **THEN** TypeScript infers the type as `string | undefined`

#### Scenario: QualityEvent accepts hallazgoCodigo and normativaVinculada for origin O3

- **WHEN** a developer constructs a `QualityEvent` with `origen: 'O3_HALLAZGO_AUDITORIA'`, `hallazgoCodigo: 'HAL-2026-001'`, `normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' }`
- **THEN** TypeScript accepts the object without error

#### Scenario: QualityEvent no longer has a hallazgoAuditoriaRef field

- **WHEN** a developer attempts to read or assign `qe.hallazgoAuditoriaRef`
- **THEN** TypeScript emits a compile error, as the property does not exist on `QualityEvent`

#### Scenario: QualityEvent no longer has an areaAfectada field

- **WHEN** a developer attempts to read or assign `qe.areaAfectada`
- **THEN** TypeScript emits a compile error, as the property does not exist on `QualityEvent` — the field is `areaId`

#### Scenario: areaId is typed as a required string

- **WHEN** a developer reads `qe.areaId` on a QualityEvent
- **THEN** TypeScript infers the type as `string`, not `string | undefined`
