# Spec: quality-event-types

## Purpose

TypeScript type definitions for the Quality Event domain. Covers all union types, interfaces, the state-machine transition map, and sub-entity interfaces. All primary types are defined in `src/features/quality-events/types/qualityEvent.types.ts`.

---

## Requirements

### Requirement: QEOrigin union type
The system SHALL define `QEOrigin` as a TypeScript string literal union in `src/features/quality-events/types/qualityEvent.types.ts` covering exactly four values: `'O1_INCIDENTE_CAMPO' | 'O2_NC_DETECTADA' | 'O3_HALLAZGO_AUDITORIA' | 'O4_REPORTE_EXTERNO'`.

#### Scenario: QEOrigin covers all four origin values
- **WHEN** a developer imports `QEOrigin` from `src/features/quality-events/types/qualityEvent.types.ts`
- **THEN** the union includes exactly four values and TypeScript rejects any other string

---

### Requirement: QEType union type
The system SHALL define `QEType` as a TypeScript string literal union: `'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'`.

#### Scenario: QEType covers all four classification values
- **WHEN** a developer imports `QEType` from `src/features/quality-events/types/qualityEvent.types.ts`
- **THEN** the union includes exactly four values and TypeScript rejects any other string

---

### Requirement: QESeverity union type
The system SHALL define `QESeverity` as a TypeScript string literal union: `'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'`, aligned with the SHAC severity scale used in `IncidentSeveridad` (M3) and `NCSeveridad` (M2).

#### Scenario: QESeverity covers all four SHAC severity levels
- **WHEN** a developer imports `QESeverity` from `src/features/quality-events/types/qualityEvent.types.ts`
- **THEN** the union includes exactly the four values: `BAJA`, `MEDIA`, `ALTA`, `CRITICA`

---

### Requirement: QEStatus union type
The system SHALL define `QEStatus` as a TypeScript string literal union with nine states: `'ABIERTO' | 'EN_INVESTIGACION' | 'ANALISIS_COMPLETADO' | 'EN_EJECUCION' | 'PENDIENTE_CIERRE' | 'CERRADO' | 'EN_VERIFICACION' | 'VERIFICADO' | 'REABIERTO'`. Unlike `IncidentStatus`, `REABIERTO` is a valid persistent state in the QE lifecycle (not just a re-open action), as a QE can be reopened multiple times and re-enters the `EN_EJECUCION` state.

#### Scenario: QEStatus covers all nine lifecycle states including REABIERTO
- **WHEN** a developer imports `QEStatus` from `src/features/quality-events/types/qualityEvent.types.ts`
- **THEN** the union includes exactly nine values and TypeScript rejects any other string

#### Scenario: REABIERTO is a valid QEStatus assignment
- **WHEN** a developer assigns `'REABIERTO'` as a `QEStatus` value
- **THEN** TypeScript accepts the assignment without error

---

### Requirement: AnalisisCausaRaizMetodo union type
The system SHALL define `AnalisisCausaRaizMetodo` as a TypeScript string literal union: `'5_PORQUES' | 'ISHIKAWA'`.

#### Scenario: AnalisisCausaRaizMetodo covers both analysis methods
- **WHEN** a developer imports `AnalisisCausaRaizMetodo` from `src/features/quality-events/types/qualityEvent.types.ts`
- **THEN** the union includes exactly two values

---

### Requirement: CincoPorques interface
The system SHALL define a `CincoPorques` interface with two required string fields: `pregunta` and `respuesta`.

#### Scenario: CincoPorques requires both fields
- **WHEN** a developer constructs a `CincoPorques` without `respuesta`
- **THEN** TypeScript emits a compile error for the missing required field

---

### Requirement: IshikawaCategoria union type and Ishikawa interface
The system SHALL define `IshikawaCategoria` as a string literal union: `'METODO' | 'MAQUINA' | 'MATERIAL' | 'MANO_DE_OBRA' | 'MEDICION' | 'MEDIO_AMBIENTE'`. The system SHALL define an `Ishikawa` interface with two required fields: `categoria` (IshikawaCategoria) and `causa` (string).

#### Scenario: Ishikawa rejects an invalid categoria
- **WHEN** a developer constructs an `Ishikawa` with `categoria: 'OTRO'`
- **THEN** TypeScript emits a compile error because `'OTRO'` is not in `IshikawaCategoria`

---

### Requirement: ReporteExternoRef interface
The system SHALL define a `ReporteExternoRef` interface with two required string fields: `nombreCliente` and `fechaRecepcion` (ISO 8601 date string).

#### Scenario: ReporteExternoRef requires both fields
- **WHEN** a developer constructs a `ReporteExternoRef` with only `nombreCliente`
- **THEN** TypeScript emits a compile error for the missing `fechaRecepcion` field

---

### Requirement: AccionCorrectivaQE stub interface
The system SHALL define an `AccionCorrectivaQE` interface in `src/features/quality-events/types/qualityEvent.types.ts` with the following fields: `id` (string), `qeId` (string), `titulo` (string or undefined), `descripcion` (string), `responsableId` (string), `responsableNombre` (string), `plazoFecha` (ISO 8601 date string), `prioridad` (`'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'` or undefined), `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'CERRADA'`), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string), `descripcionEvidencia` (string or undefined), `evidenciaUrl` (string or undefined), `fechaCierre` (ISO 8601 string or undefined), `solicitudAjustePlazo` (`SolicitudAjustePlazoAC` or undefined).

The system SHALL define a `SolicitudAjustePlazoAC` interface with the fields `fechaSolicitada` (ISO 8601 date string, the newly requested deadline), `justificacion` (string), `estado` (`'PENDIENTE' | 'APROBADA' | 'RECHAZADA'`), `solicitadoPorId` (string), `solicitadoEn` (ISO 8601 string). This is a read-only projection of a plazo-extension request: the interface does NOT include an approver field, a threshold-validation field, or any mutation endpoint — the approval workflow (written justification + 50% threshold validation, per QE-AC-007) remains an unimplemented M4 gap.

#### Scenario: AccionCorrectivaQE requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `plazoFecha`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaQE accepts absence of evidencia fields
- **WHEN** a developer constructs an `AccionCorrectivaQE` with `descripcionEvidencia`, `evidenciaUrl` and `fechaCierre` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: solicitudAjustePlazo is optional and absent by default
- **WHEN** a developer constructs an `AccionCorrectivaQE` without `solicitudAjustePlazo`
- **THEN** TypeScript accepts the object without error, and no plazo-extension request is implied

#### Scenario: solicitudAjustePlazo with estado PENDIENTE marks it as awaiting approval
- **WHEN** an `AccionCorrectivaQE` has `solicitudAjustePlazo.estado === 'PENDIENTE'`
- **THEN** the type does not expose any field to record who approved/rejected it or a threshold-validation result — only the request itself

---

### Requirement: QEAuditTrailEntry interface
The system SHALL define a `QEAuditTrailEntry` interface in `src/features/quality-events/types/qualityEvent.types.ts` scoped to the QE domain, with fields: `id` (string), `entidadTipo` (literal `'QualityEvent'`), `entidadId` (string), `accion` (string), `estadoAnterior` (string or undefined), `estadoNuevo` (string or undefined), `campoModificado` (string or undefined), `valorAnterior` (string or undefined), `valorNuevo` (string or undefined), `realizadoPorId` (string), `realizadoPorNombre` (string), `timestamp` (ISO 8601 UTC string), `ipOrigen` (string or undefined), `generadoPorIA` (boolean).

#### Scenario: QEAuditTrailEntry entidadTipo is narrowed to QualityEvent
- **WHEN** a developer reads `auditEntry.entidadTipo` on a QE audit entry
- **THEN** TypeScript narrows the value to the literal `'QualityEvent'`

---

### Requirement: QualityEvent interface
The system SHALL define a `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts` with the following required fields: `id` (string), `numero` (string, format `QE-YYYY-NNN`), `origen` (QEOrigin), `tipo` (QEType), `severidad` (QESeverity), `estado` (QEStatus), `ciclo` (number), `descripcion` (string), `areaAfectada` (string), `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `fechaHoraEvento` (ISO 8601 string), `fechaHoraReporte` (ISO 8601 string), `reportadoPorId` (string), `documentosVinculados` (string[]), `requiereEvaluacionRiesgos` (boolean), `accionesCorrectivas` (AccionCorrectivaQE[]), `auditTrail` (QEAuditTrailEntry[]), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `mineralInvolucrado` (string), `ncId` (string), `incidenteId` (string), `hallazgoCodigo` (string), `normativaVinculada` (`NormativaVinculada`, from `quality-event-normativa-catalog`), `reporteExternoRef` (ReporteExternoRef), `descripcionAmpliada` (string), `metodoAnalisis` (AnalisisCausaRaizMetodo), `cincoPorques` (CincoPorques[]), `ishikawa` (Ishikawa[]), `causaRaizDefinitiva` (string), `causaRaizAprobadaPorId` (string), `causaRaizFirmadaEn` (string), `evaluacionRiesgosRef` (string), `resultadoCierre` (string), `cerradoPorId` (string), `cierreFirmaSupervisorId` (string), `cierreFirmaSupervisorRol` (`'SUPERVISOR' | 'ALTA_DIRECCION'`), `fechaCierre` (ISO 8601 string), `plazoVerificacionDias` (number), `fechaVerificacionProgramada` (string), `fechaVerificacionRealizada` (string), `verificadoPorId` (string), `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `evidenciaVerificacion` (string), `auditorAsignadoId` (string). The interface SHALL NOT include a `hallazgoAuditoriaRef` field — it is replaced by `hallazgoCodigo` and `normativaVinculada`.

`hallazgoCodigo` and `normativaVinculada` are only meaningful for `origen === 'O3_HALLAZGO_AUDITORIA'`; they SHALL be absent for QEs of any other origin. Obligatoriedad condicional para origen O3 (RN-QE-010) SHALL be enforced at the Zod schema level (`quality-event-schemas`), not by the TypeScript type itself — both fields remain optional at the interface level so existing non-O3 QEs (and QEs under construction before origin is selected) type-check without them.

`auditorAsignadoId` identifies the `AUDITOR_INTERNO` user responsible for the REG-EFEC-001 effectiveness verification once the QE reaches `EN_VERIFICACION`. It SHALL be absent for QEs that have not yet been assigned an auditor (including all QEs before `CERRADO`), and is set exclusively via the `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` flow described in `quality-event-verificacion`.

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

---

### Requirement: QualityEvent tracks pending AC requests via solicitudesAC
The system SHALL add a `solicitudesAC: number` field (default `0`) to the `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts`, incremented each time an NC or Incident owner requests that a new AC be created against the QE.

#### Scenario: New QE defaults solicitudesAC to 0
- **WHEN** a `QualityEvent` fixture or newly created QE has no explicit `solicitudesAC`
- **THEN** `solicitudesAC` defaults to `0`

#### Scenario: solicitudesAC is typed as a required number
- **WHEN** a developer constructs a `QualityEvent` without `solicitudesAC`
- **THEN** TypeScript emits a compile error for the missing required field

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
