# nonconformity-types

## MODIFIED Requirements

### Requirement: NCStatus union type
The system SHALL define `NCStatus` as a TypeScript string literal union covering all valid non-conformity lifecycle states: `DETECTADA | EN_INVESTIGACION | EN_CORRECCION | PENDIENTE_CIERRE | CERRADA | REABIERTA | ANULADA`.

#### Scenario: NCStatus covers all M2 lifecycle states including ANULADA
- **WHEN** a developer imports `NCStatus` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly seven values: `DETECTADA`, `EN_INVESTIGACION`, `EN_CORRECCION`, `PENDIENTE_CIERRE`, `CERRADA`, `REABIERTA`, `ANULADA` and TypeScript rejects any other string

### Requirement: NCPermissions interface
The system SHALL define an `NCPermissions` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre`, `canCerrar`, `canReabrir`, `canAnular`, `canAsignarAC`, `canCerrarAC`, `canVerAuditTrail`. All flags SHALL be required booleans with no optional members.

#### Scenario: NCPermissions has all thirteen flags as required booleans
- **WHEN** a developer constructs an `NCPermissions` object
- **THEN** TypeScript requires all thirteen flags to be explicitly assigned and rejects any extra properties

#### Scenario: canAnular is false for OPERARIO regardless of state
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC state
- **THEN** `canAnular` is always `false`

#### Scenario: canAsignarAC is true for SUPERVISOR on non-terminal NCs
- **WHEN** a developer calls `getNCPermissions(nc, 'SUPERVISOR')` with `nc.estado = 'EN_CORRECCION'`
- **THEN** `canAsignarAC` is `true`

#### Scenario: canCerrarAC is true only for JEFE_CALIDAD_SYST
- **WHEN** a developer calls `getNCPermissions` with role `JEFE_CALIDAD_SYST` for any active NC
- **THEN** `canCerrarAC` is `true`

#### Scenario: canVerAuditTrail is false for OPERARIO
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC
- **THEN** `canVerAuditTrail` is `false`

## ADDED Requirements

### Requirement: NCDominio union type
The system SHALL define `NCDominio` as a TypeScript string literal union: `NC-CAL | NC-SST | NC-ADU | NC-OPE | NC-PRV`.

#### Scenario: NCDominio covers all regulatory/organizational buckets
- **WHEN** a developer assigns a non-conformity domain value
- **THEN** TypeScript accepts only the five defined values and rejects any other string

### Requirement: ACStatus union type
The system SHALL define `ACStatus` as a TypeScript string literal union: `PENDIENTE | EN_EJECUCION | COMPLETADA | CERRADA | VENCIDA`.

#### Scenario: ACStatus covers all AC lifecycle states
- **WHEN** a developer assigns an `AccionCorrectiva.estado` value
- **THEN** TypeScript accepts only the five defined values and rejects any other string

### Requirement: AccionCorrectiva interface
The system SHALL define an `AccionCorrectiva` interface with required fields: `id` (string), `ncId` (string), `descripcion` (string), `responsableId` (string), `responsableNombre` (string), `plazoFecha` (ISO 8601 string), `estado` (ACStatus), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). Optional fields: `fechaCierre` (ISO 8601 string or undefined), `descripcionEvidencia` (string or undefined), `evidenciaUrl` (string or undefined).

#### Scenario: AccionCorrectiva rejects missing required fields
- **WHEN** a developer constructs an `AccionCorrectiva` object without `plazoFecha` or `responsableId`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: AccionCorrectiva accepts valid optional fields as undefined
- **WHEN** a developer constructs an `AccionCorrectiva` with `descripcionEvidencia` omitted
- **THEN** TypeScript accepts the object without error

### Requirement: CreateACInput type
The system SHALL define a `CreateACInput` type (or export it from the Zod schema) with required fields: `descripcion` (string, min 5), `responsableId` (string UUID), `plazoFecha` (ISO 8601 date string).

#### Scenario: CreateACInput rejects missing responsableId
- **WHEN** a developer parses an object without `responsableId` through the AC creation schema
- **THEN** Zod returns an error with path `['responsableId']`

### Requirement: UpdateACInput type
The system SHALL define an `UpdateACInput` type as a partial object with optional fields: `estado` (ACStatus), `descripcion` (string), `responsableId` (string UUID), `plazoFecha` (ISO 8601 date string).

#### Scenario: UpdateACInput accepts partial payload with only estado
- **WHEN** a developer constructs `UpdateACInput` with only `{ estado: 'EN_EJECUCION' }`
- **THEN** TypeScript accepts it without error

### Requirement: CerrarACInput type
The system SHALL define a `CerrarACInput` type with required field `descripcionEvidencia` (string, min 1) and optional field `evidenciaUrl` (string URL or undefined).

#### Scenario: CerrarACInput rejects empty descripcionEvidencia
- **WHEN** a developer parses `{ descripcionEvidencia: '' }` through the cerrar AC schema
- **THEN** Zod returns an error with path `['descripcionEvidencia']`

#### Scenario: CerrarACInput accepts payload without evidenciaUrl
- **WHEN** a developer constructs `CerrarACInput` with only `{ descripcionEvidencia: 'Evidencia adjunta' }`
- **THEN** TypeScript and Zod accept it without error

### Requirement: NoConformidad interface extended with dominio and requiereIPER
The system SHALL add `dominio` (NCDominio, required), `titulo` (string, required), `detectadoPor` (string, optional), `requiereIPER` (boolean, required), `justificacionAnulacion` (string or undefined), and `fechaCierre` (ISO 8601 string or undefined) to the `NoConformidad` interface.

#### Scenario: NoConformidad rejects missing dominio
- **WHEN** a developer constructs a `NoConformidad` object without `dominio`
- **THEN** TypeScript emits a compile error

#### Scenario: NoConformidad accepts justificacionAnulacion when estado is ANULADA
- **WHEN** a developer reads `nc.justificacionAnulacion` on a `NoConformidad` with `estado === 'ANULADA'`
- **THEN** TypeScript infers the type as `string | undefined` without narrowing errors
