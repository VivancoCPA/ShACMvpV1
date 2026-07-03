# Spec: incident-types

## Purpose

TypeScript type definitions for the incident domain. Covers all union types, interfaces, and supporting constants needed by M3 feature modules. All types are defined in `src/features/incidents/types/incident.types.ts`.

---

## Requirements

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
The system SHALL define an `AccionCorrectivaIncidente` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `incidenteId` (string — provisional until M4), `descripcion` (string), `responsableId` (string), `fechaLimite` (ISO 8601 date string), `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'`), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `evidencia` (string or undefined), `qeId` (string or undefined — Modelo B: references the Quality Event that now owns this AC's continuation, when one exists).

#### Scenario: AccionCorrectivaIncidente requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` without `fechaLimite`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaIncidente accepts absence of evidencia
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` with `evidencia` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: AccionCorrectivaIncidente accepts qeId as undefined
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` with `qeId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: qeId is typed as string or undefined
- **WHEN** a developer reads `accionCorrectivaIncidente.qeId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

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

---

### Requirement: Local interface (ADD-03)
The system SHALL define a `Local` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `nombre` (string), `codigo` (string, format `LOC-NNN`), `activo` (boolean), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `direccion` (string), `planoPngUrl` (string — URL to a PNG floor plan image, ~300 KB; placeholder `/mock/plano-placeholder.png` until client delivers assets). A maximum of 5 locales may be active simultaneously (RN-LOC-001); this constraint is enforced at the API level, not in the TypeScript type.

#### Scenario: Local requires all mandatory fields
- **WHEN** a developer constructs a `Local` without `codigo`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: Local accepts planoPngUrl as undefined
- **WHEN** a developer constructs a `Local` with `planoPngUrl` omitted
- **THEN** TypeScript accepts the object without error

---

### Requirement: Zona interface (ADD-03)
The system SHALL define a `Zona` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `localId` (string — FK to `Local.id`), `nombre` (string), `codigo` (string, format `ZON-NNN`), `activo` (boolean), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional field: `descripcion` (string). Zones are exclusive to their local (RN-ZON-001); there is no upper limit on zones per local.

#### Scenario: Zona requires localId
- **WHEN** a developer constructs a `Zona` without `localId`
- **THEN** TypeScript emits a compile error for the missing required field

---

### Requirement: IncidenteUbicacion interface (ADD-03)
The system SHALL define an `IncidenteUbicacion` interface in `src/features/incidents/types/incident.types.ts` with two required number fields: `x` (percentage 0–100 of the PNG width) and `y` (percentage 0–100 of the PNG height). This coordinate system maps a pin position on the `Local.planoPngUrl` floor plan image.

#### Scenario: IncidenteUbicacion requires both x and y
- **WHEN** a developer constructs an `IncidenteUbicacion` with only `x`
- **THEN** TypeScript emits a compile error for the missing `y` field

---

### Requirement: Incidente interface extended with location fields (ADD-03)
The `Incidente` interface SHALL include the following additional optional fields from ADD-03: `localId` (string — FK to `Local.id`), `zonaId` (string — FK to `Zona.id`), `ubicacion` (`IncidenteUbicacion` — map pin coordinates on the local's floor plan), `localNombre` (string — denormalized join field for display), `zonaNombre` (string — denormalized join field for display). None of these fields are required; their absence MUST NOT break any existing Zod schema validation (RN-LOC-003). If `zonaId` is provided, it must belong to the `localId` indicated — this constraint is validated at the form level, not at the TypeScript type level (RN-ZON-003).

#### Scenario: Incidente accepts all location fields absent
- **WHEN** a developer constructs an `Incidente` with no `localId`, `zonaId`, `ubicacion`, `localNombre`, or `zonaNombre`
- **THEN** TypeScript accepts the object without error

#### Scenario: Incidente accepts all location fields present
- **WHEN** a developer constructs an `Incidente` with `localId: 'loc-001'`, `zonaId: 'zon-001'`, `ubicacion: { x: 45, y: 30 }`, `localNombre: 'Almacén Principal'`, `zonaNombre: 'Zona de Carga'`
- **THEN** TypeScript accepts the object without error

#### Scenario: ubicacion is typed as IncidenteUbicacion or undefined
- **WHEN** a developer reads `incidente.ubicacion`
- **THEN** TypeScript infers the type as `IncidenteUbicacion | undefined`
