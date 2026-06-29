## ADDED Requirements

### Requirement: IncidentType union type
The system SHALL define `IncidentType` as a TypeScript string literal union in `src/features/incidents/types/incident.types.ts` covering all classification values: `'ACCIDENTE' | 'INCIDENTE' | 'CUASI_ACCIDENTE' | 'CONDICION_INSEGURA'`.

#### Scenario: IncidentType covers all four SyST classification values
- **WHEN** a developer imports `IncidentType` from `src/features/incidents/types/incident.types.ts`
- **THEN** the union includes exactly four values and TypeScript rejects any other string

---

### Requirement: IncidentStatus union type
The system SHALL define `IncidentStatus` as a TypeScript string literal union: `'ABIERTO' | 'EN_INVESTIGACION' | 'ANALISIS_COMPLETADO' | 'EN_EJECUCION' | 'PENDIENTE_CIERRE' | 'CERRADO' | 'ANULADO'`. The union SHALL NOT include `'REABIERTO'` — incident reopening is handled as a new incident with reference to the original.

#### Scenario: IncidentStatus covers all seven lifecycle states
- **WHEN** a developer imports `IncidentStatus` from `src/features/incidents/types/incident.types.ts`
- **THEN** the union includes exactly seven values and TypeScript rejects any other string

#### Scenario: IncidentStatus does not include REABIERTO
- **WHEN** a developer assigns `'REABIERTO'` as an `IncidentStatus` value
- **THEN** TypeScript emits a compile error because that literal is not a member of the union

---

### Requirement: IncidentSeveridad union type
The system SHALL define `IncidentSeveridad` as a TypeScript string literal union with 4 levels: `'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'`, aligned with the SHAC severity scale used in Quality Events (`QESeverity`) and M2 (`NCSeveridad`).

#### Scenario: IncidentSeveridad covers all four SHAC severity levels
- **WHEN** a developer imports `IncidentSeveridad` from `src/features/incidents/types/incident.types.ts`
- **THEN** the union includes exactly the four values: `BAJA`, `MEDIA`, `ALTA`, `CRITICA`

---

### Requirement: IncidentTurno union type
The system SHALL define `IncidentTurno` as a TypeScript string literal union: `'DIA' | 'TARDE' | 'NOCHE' | 'TODOS'`. The `'TODOS'` value is valid only in filter contexts; a real incident record SHALL always have a specific turno.

#### Scenario: IncidentTurno includes TODOS for filter use
- **WHEN** a developer imports `IncidentTurno` from `src/features/incidents/types/incident.types.ts`
- **THEN** the union includes `'TODOS'` as a valid value alongside the three shift values

---

### Requirement: CondicionEntorno union type
The system SHALL define `CondicionEntorno` as a TypeScript string literal union: `'ILUMINACION' | 'PISO' | 'SENALIZACION' | 'EPP' | 'CLIMA' | 'OTRO'`. This type supports multi-selection in the investigation form.

#### Scenario: CondicionEntorno covers six environmental condition categories
- **WHEN** a developer imports `CondicionEntorno` from `src/features/incidents/types/incident.types.ts`
- **THEN** the union includes exactly six values and TypeScript rejects any other string

---

### Requirement: CondicionEntornoValues constant array
The system SHALL export a `CondicionEntornoValues` constant as a `readonly` tuple of all `CondicionEntorno` values, usable as the argument to `z.enum([...CondicionEntornoValues])` in Zod schemas without TypeScript errors.

#### Scenario: CondicionEntornoValues is usable in z.enum spread
- **WHEN** a developer writes `z.enum([...CondicionEntornoValues])`
- **THEN** TypeScript accepts the spread without a type error and Zod correctly infers the enum type

---

### Requirement: AccionCorrectivaIncidente interface
The system SHALL define an `AccionCorrectivaIncidente` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `incidenteId` (string — provisional until M4), `descripcion` (string), `responsableId` (string), `fechaLimite` (ISO 8601 date string), `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'`), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional field: `evidencia` (string or undefined).

#### Scenario: AccionCorrectivaIncidente requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` without `fechaLimite`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaIncidente accepts absence of evidencia
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` with `evidencia` omitted
- **THEN** TypeScript accepts the object without error

---

### Requirement: Incidente interface
The system SHALL define an `Incidente` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `numero` (string, format `INC-YYYY-NNN`), `tipo` (IncidentType), `estado` (IncidentStatus), `severidad` (IncidentSeveridad), `descripcion` (string, minimum 20 characters enforced at schema level), `areaId` (string), `turno` (IncidentTurno), `fechaEvento` (ISO 8601 datetime string), `fechaReporte` (ISO 8601 datetime string), `reportadoPorId` (string userId), `huboLesionados` (boolean), `auditTrail` (AuditTrailEntry[]), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `numPersonasAfectadas` (number — only meaningful when `huboLesionados === true`), `personalInvolucrado` (string[] — userIds), `testigos` (string[] — userIds or free names), `equiposInvolucrados` (string[]), `condicionesEntorno` (CondicionEntorno[]), `atencionMedicaRequerida` (boolean), `atencionMedicaDescripcion` (string), `notificacionAmbientalRequerida` (boolean), `informeMedicoAdjunto` (string — URL, required for closure of ACCIDENTE type per RN-INC-002, validated at component level), `qeId` (string — provisional stub for M4 linkage), `accionesCorrectivas` (AccionCorrectivaIncidente[]), `deletedAt` (ISO 8601 string — soft delete marker).

#### Scenario: Incidente rejects missing required fields
- **WHEN** a developer constructs an `Incidente` without `numero` or `areaId`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: Incidente accepts numPersonasAfectadas as undefined when huboLesionados is false
- **WHEN** a developer constructs an `Incidente` with `huboLesionados: false` and `numPersonasAfectadas` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: Incidente accepts deletedAt as soft-delete marker
- **WHEN** a developer constructs an `Incidente` with `deletedAt: '2025-06-01T10:00:00Z'`
- **THEN** TypeScript accepts the value and `deletedAt` is typed as `string | undefined`

#### Scenario: Incidente accepts informeMedicoAdjunto as optional
- **WHEN** a developer constructs an `Incidente` of tipo ACCIDENTE with `informeMedicoAdjunto` omitted
- **THEN** TypeScript accepts the object without error (closure validation is at component level)

#### Scenario: qeId is typed as string or undefined
- **WHEN** a developer reads `incidente.qeId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

---

### Requirement: Incident-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface in `src/features/incidents/types/incident.types.ts` scoped to the incident domain, with fields: `id` (string), `entidadTipo` (literal `'Incidente'`), `entidadId` (string), `accion` (string), `estadoAnterior` (string or undefined), `estadoNuevo` (string or undefined), `campoModificado` (string or undefined), `valorAnterior` (string or undefined), `valorNuevo` (string or undefined), `realizadoPorId` (string), `realizadoPorNombre` (string), `timestamp` (ISO 8601 UTC string), `ipOrigen` (string or undefined), `generadoPorIA` (boolean).

#### Scenario: Incident AuditTrailEntry entidadTipo is narrowed to Incidente
- **WHEN** a developer reads `auditEntry.entidadTipo` on an incident audit entry
- **THEN** TypeScript narrows the value to the literal `'Incidente'`
