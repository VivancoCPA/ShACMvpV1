# nonconformity-types

Core TypeScript type definitions for the M2 Gestión de No Conformidades domain. Consumed by all features, hooks, API clients, and MSW handlers that deal with non-conformities.

## ADDED Requirements

### Requirement: NCStatus union type
The system SHALL define `NCStatus` as a TypeScript string literal union covering all valid non-conformity lifecycle states: `DETECTADA | EN_INVESTIGACION | EN_CORRECCION | PENDIENTE_CIERRE | CERRADA | REABIERTA`.

#### Scenario: NCStatus covers all M2 lifecycle states
- **WHEN** a developer imports `NCStatus` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly the six values: `DETECTADA`, `EN_INVESTIGACION`, `EN_CORRECCION`, `PENDIENTE_CIERRE`, `CERRADA`, `REABIERTA` and TypeScript rejects any other string

### Requirement: NCOrigen union type
The system SHALL define `NCOrigen` as a TypeScript string literal union: `INSPECCION_INTERNA | AUDITORIA_INTERNA | AUDITORIA_EXTERNA | CLIENTE_RECLAMO | OPERACION_CAMPO | CONTROL_PROCESO`.

#### Scenario: NCOrigen is exhaustive for all detection sources
- **WHEN** a developer assigns a non-conformity origin value
- **THEN** TypeScript accepts only the six defined values and rejects any other string

### Requirement: NCTipo union type
The system SHALL define `NCTipo` as a TypeScript string literal union: `PROCESO | PRODUCTO | SERVICIO | SISTEMA | SST`.

#### Scenario: NCTipo covers all M2 non-conformity categories
- **WHEN** a developer assigns a non-conformity type value
- **THEN** TypeScript accepts only the five defined values and rejects any other string

### Requirement: NCSeveridad union type
The system SHALL define `NCSeveridad` as a TypeScript string literal union: `MENOR | MAYOR | CRITICA`.

#### Scenario: NCSeveridad uses ISO 9001 NC terminology
- **WHEN** a developer assigns a non-conformity severity value
- **THEN** TypeScript accepts only `MENOR`, `MAYOR`, or `CRITICA` and rejects `BAJA`, `MEDIA`, `ALTA`, or any other string

### Requirement: NCPermissions interface
The system SHALL define an `NCPermissions` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre`, `canCerrar`, `canReabrir`. All flags SHALL be required booleans with no optional members.

#### Scenario: NCPermissions has all nine flags as required booleans
- **WHEN** a developer constructs an `NCPermissions` object
- **THEN** TypeScript requires all nine flags to be explicitly assigned and rejects any extra properties

#### Scenario: canReabrir is only true for roles authorized to reopen
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` on a `CERRADA` NC
- **THEN** the returned `NCPermissions.canReabrir` is `false`

### Requirement: NoConformidad interface
The system SHALL define a `NoConformidad` interface with the following required fields: `id`, `numero` (format `NC-YYYY-NNN`), `origen`, `tipo`, `severidad`, `estado`, `descripcion`, `areaAfectada`, `reportadoPorId`, `fechaDeteccion`, `fechaReporte`, `documentosVinculados`, `adjuntos`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include the following optional fields: `mineralInvolucrado`, `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `responsableInvestigacionId`, `accionInmediata`, `accionInmediataFecha`, `correccion`, `correccionEvidenciaUrl`, `causaRaiz`, `corregidoPorId`, `verificadoPorId`, `fechaVerificacion`, `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `qeGeneradoId`.

#### Scenario: NoConformidad rejects missing required fields
- **WHEN** a developer constructs a `NoConformidad` object without `numero` or `areaAfectada`
- **THEN** TypeScript emits a compile error for each missing required field

#### Scenario: NoConformidad accepts valid optional fields as undefined
- **WHEN** a developer constructs a `NoConformidad` with `mineralInvolucrado` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: qeGeneradoId is typed as string or null
- **WHEN** a developer reads `noConformidad.qeGeneradoId`
- **THEN** TypeScript infers the type as `string | null` or `string | undefined`, not `string`

#### Scenario: resultadoVerificacion is a two-value union
- **WHEN** a developer assigns `resultadoVerificacion`
- **THEN** TypeScript accepts only `'EFECTIVO'` or `'NO_EFECTIVO'` and rejects any other string

### Requirement: NCFilters interface
The system SHALL define an `NCFilters` interface for list queries with the following optional fields: `estado`, `tipo`, `severidad`, `origen`, `areaAfectada`, `reportadoPorId`, `search`, `page`, `pageSize`.

#### Scenario: NCFilters is used as a query key parameter
- **WHEN** a developer passes an `NCFilters` object to a query key factory
- **THEN** TypeScript accepts it without casting

#### Scenario: NCFilters with no fields is valid
- **WHEN** a developer passes an empty object `{}` as `NCFilters`
- **THEN** TypeScript accepts it without error

### Requirement: NC-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface scoped to the non-conformity domain with fields: `id`, `entidadTipo` (literal `'NoConformidad'`), `entidadId`, `accion`, `estadoAnterior?`, `estadoNuevo?`, `campoModificado?`, `valorAnterior?`, `valorNuevo?`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `ipOrigen?`, `generadoPorIA`.

#### Scenario: NC AuditTrailEntry entidadTipo is narrowed to NoConformidad
- **WHEN** a developer reads `auditEntry.entidadTipo` on an NC audit entry
- **THEN** TypeScript narrows the value to the literal `'NoConformidad'`, not the generic union
