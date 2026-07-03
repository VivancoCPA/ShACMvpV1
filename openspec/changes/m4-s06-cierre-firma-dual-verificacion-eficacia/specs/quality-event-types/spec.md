## MODIFIED Requirements

### Requirement: QualityEvent interface
The system SHALL define a `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts` with the following required fields: `id` (string), `numero` (string, format `QE-YYYY-NNN`), `origen` (QEOrigin), `tipo` (QEType), `severidad` (QESeverity), `estado` (QEStatus), `ciclo` (number), `descripcion` (string), `areaAfectada` (string), `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `fechaHoraEvento` (ISO 8601 string), `fechaHoraReporte` (ISO 8601 string), `reportadoPorId` (string), `documentosVinculados` (string[]), `requiereEvaluacionRiesgos` (boolean), `accionesCorrectivas` (AccionCorrectivaQE[]), `auditTrail` (QEAuditTrailEntry[]), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `mineralInvolucrado` (string), `ncId` (string), `incidenteId` (string), `hallazgoAuditoriaRef` (string), `reporteExternoRef` (ReporteExternoRef), `descripcionAmpliada` (string), `metodoAnalisis` (AnalisisCausaRaizMetodo), `cincoPorques` (CincoPorques[]), `ishikawa` (Ishikawa[]), `causaRaizDefinitiva` (string), `causaRaizAprobadaPorId` (string), `causaRaizFirmadaEn` (string), `evaluacionRiesgosRef` (string), `resultadoCierre` (string), `cerradoPorId` (string), `cierreFirmaSupervisorId` (string), `cierreFirmaSupervisorRol` (`'SUPERVISOR' | 'ALTA_DIRECCION'`), `fechaCierre` (ISO 8601 string), `plazoVerificacionDias` (number), `fechaVerificacionProgramada` (string), `fechaVerificacionRealizada` (string), `verificadoPorId` (string), `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `evidenciaVerificacion` (string).

#### Scenario: QualityEvent rejects missing required fields
- **WHEN** a developer constructs a `QualityEvent` without `numero` or `areaAfectada`
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

---

### Requirement: getValidQETransitions function
The system SHALL export a function `getValidQETransitions(estado: QEStatus): QEStatus[]` from `src/features/quality-events/utils/qualityEventTransitions.ts`. The function SHALL be backed by an exhaustive `Record<QEStatus, QEStatus[]>` map so that TypeScript enforces all states are covered. The valid transitions SHALL be:
- `ABIERTO` → `['EN_INVESTIGACION']`
- `EN_INVESTIGACION` → `['ANALISIS_COMPLETADO']`
- `ANALISIS_COMPLETADO` → `['EN_EJECUCION']`
- `EN_EJECUCION` → `['PENDIENTE_CIERRE']`
- `PENDIENTE_CIERRE` → `['CERRADO']`
- `CERRADO` → `['EN_VERIFICACION']`
- `EN_VERIFICACION` → `['VERIFICADO', 'REABIERTO']`
- `VERIFICADO` → `[]` (terminal state)
- `REABIERTO` → `['EN_INVESTIGACION']`

`REABIERTO` is retained as a valid `QEStatus` enum value (used as an audit-trail `accion`/motive marker) but is never written to `qe.estado` by the reapertura flow — reapertura sets `estado: 'EN_INVESTIGACION'` directly so root-cause analysis can be redone (see `quality-event-verificacion`). The map's `REABIERTO` entry exists only to keep the `Record<QEStatus, QEStatus[]>` exhaustive.

#### Scenario: getValidQETransitions returns correct successors for ABIERTO
- **WHEN** a developer calls `getValidQETransitions('ABIERTO')`
- **THEN** the returned array equals `['EN_INVESTIGACION']`

#### Scenario: getValidQETransitions returns empty array for VERIFICADO
- **WHEN** a developer calls `getValidQETransitions('VERIFICADO')`
- **THEN** the returned array is empty (`[]`)

#### Scenario: getValidQETransitions returns two options for EN_VERIFICACION
- **WHEN** a developer calls `getValidQETransitions('EN_VERIFICACION')`
- **THEN** the returned array contains both `'VERIFICADO'` and `'REABIERTO'`

#### Scenario: getValidQETransitions returns EN_INVESTIGACION for REABIERTO
- **WHEN** a developer calls `getValidQETransitions('REABIERTO')`
- **THEN** the returned array equals `['EN_INVESTIGACION']`
