# Spec: nonconformity-types

## Purpose

Core TypeScript type definitions for the M2 Gestión de No Conformidades domain. Consumed by all features, hooks, API clients, and MSW handlers that deal with non-conformities. Includes the NC lifecycle states, domain classification, corrective action model, and all input/filter types.

---

## Requirements

### Requirement: NCStatus union type
The system SHALL define `NCStatus` as a TypeScript string literal union covering all valid non-conformity lifecycle states: `DETECTADA | EN_INVESTIGACION | EN_CORRECCION | PENDIENTE_CIERRE | CERRADA | REABIERTA | ANULADA`.

#### Scenario: NCStatus covers all M2 lifecycle states including ANULADA
- **WHEN** a developer imports `NCStatus` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly seven values: `DETECTADA`, `EN_INVESTIGACION`, `EN_CORRECCION`, `PENDIENTE_CIERRE`, `CERRADA`, `REABIERTA`, `ANULADA` and TypeScript rejects any other string

---

### Requirement: NCOrigen union type
The system SHALL define `NCOrigen` as a TypeScript string literal union: `INSPECCION_INTERNA | AUDITORIA_INTERNA | AUDITORIA_EXTERNA | CLIENTE_RECLAMO | OPERACION_CAMPO | CONTROL_PROCESO`.

#### Scenario: NCOrigen is exhaustive for all detection sources
- **WHEN** a developer assigns a non-conformity origin value
- **THEN** TypeScript accepts only the six defined values and rejects any other string

---

### Requirement: NCTipo union type
The system SHALL define `NCTipo` as a TypeScript string literal union: `PROCESO | PRODUCTO | SERVICIO | SISTEMA | SST`.

#### Scenario: NCTipo covers all M2 non-conformity categories
- **WHEN** a developer assigns a non-conformity type value
- **THEN** TypeScript accepts only the five defined values and rejects any other string

---

### Requirement: NCSeveridad union type
The system SHALL define `NCSeveridad` as a TypeScript string literal union with 4 levels: `BAJA | MEDIA | ALTA | CRITICA`, aligned with the SHAC severity scale used in Quality Events (`QESeverity`) and the shared `SeverityBadge` component.

#### Scenario: NCSeveridad covers 4 SHAC severity levels
- **WHEN** a developer imports `NCSeveridad` from `src/features/nonconformities/types/nonconformity.types.ts`
- **THEN** the union includes exactly the four values: `BAJA`, `MEDIA`, `ALTA`, `CRITICA` and TypeScript rejects any other string

#### Scenario: Previous NCSeveridad values are no longer valid
- **WHEN** a developer assigns `'MENOR'` or `'MAYOR'` as an `NCSeveridad` value
- **THEN** TypeScript emits a compile error because those literals are not members of the updated union

---

### Requirement: NCDominio union type
The system SHALL define `NCDominio` as a TypeScript string literal union: `'NC-CAL' | 'NC-SST' | 'NC-ADU' | 'NC-OPE' | 'NC-PRV'`. These codes correspond to the five organizational/regulatory domains (Calidad, SST, Aduanero, Operacional, Proveedores) and directly determine the `numero` prefix of a non-conformity.

#### Scenario: NCDominio covers all regulatory/organizational buckets
- **WHEN** a developer assigns a non-conformity domain value
- **THEN** TypeScript accepts only the five defined values (`'NC-CAL'`, `'NC-SST'`, `'NC-ADU'`, `'NC-OPE'`, `'NC-PRV'`) and rejects any other string

#### Scenario: NCDominio is orthogonal to NCTipo
- **WHEN** a developer constructs a `NoConformidad` with `dominio='NC-PRV'` and `tipo='SERVICIO'`
- **THEN** TypeScript accepts the combination without error, since both fields are independent

---

### Requirement: ACStatus union type
The system SHALL define `ACStatus` as a TypeScript string literal union: `'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA' | 'VENCIDA'`.

#### Scenario: ACStatus covers all AC lifecycle states
- **WHEN** a developer assigns an `AccionCorrectiva.estado` value
- **THEN** TypeScript accepts only the five defined values and rejects any other string

---

### Requirement: NCPermissions interface
The system SHALL define an `NCPermissions` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required boolean flags: `canRead`, `canEdit`, `canDelete`, `canComment`, `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre`, `canCerrar`, `canReabrir`, `canAnular`, `canAsignarAC`, `canCerrarAC`, `canVerAuditTrail`, `canCrearQE`. All flags SHALL be required booleans with no optional members.

#### Scenario: NCPermissions has all fourteen flags as required booleans
- **WHEN** a developer constructs an `NCPermissions` object
- **THEN** TypeScript requires all fourteen flags to be explicitly assigned and rejects any extra properties

#### Scenario: canReabrir is only true for roles authorized to reopen
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` on a `CERRADA` NC
- **THEN** the returned `NCPermissions.canReabrir` is `false`

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

#### Scenario: canCrearQE is false for OPERARIO regardless of state
- **WHEN** a developer calls `getNCPermissions` with role `OPERARIO` for any NC state
- **THEN** `canCrearQE` is always `false`

---

### Requirement: AccionCorrectiva interface
The system SHALL define an `AccionCorrectiva` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required fields: `id` (string), `ncId` (string), `descripcion` (string), `responsableId` (string), `responsableNombre` (string), `plazoFecha` (ISO 8601 string), `estado` (ACStatus), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `descripcionEvidencia` (string or undefined), `evidenciaUrl` (string or undefined), `fechaCierre` (ISO 8601 string or undefined), `qeId` (string or undefined — Modelo B: references the Quality Event that now owns this AC's continuation, when one exists).

#### Scenario: AccionCorrectiva requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectiva` without `plazoFecha`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectiva accepts absence of optional evidence fields
- **WHEN** a developer constructs an `AccionCorrectiva` with `descripcionEvidencia` and `evidenciaUrl` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: fechaCierre is only set when estado is COMPLETADA or VENCIDA
- **WHEN** a developer reads `accionCorrectiva.fechaCierre` on an AC in estado PENDIENTE
- **THEN** TypeScript allows `fechaCierre` to be `undefined` without narrowing error

#### Scenario: AccionCorrectiva accepts qeId as undefined
- **WHEN** a developer constructs an `AccionCorrectiva` with `qeId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: qeId is typed as string or undefined
- **WHEN** a developer reads `accionCorrectiva.qeId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

---

### Requirement: NCNotificacionComercioExterior interface
The system SHALL define an `NCNotificacionComercioExterior` interface in `src/features/nonconformities/types/nonconformity.types.ts` with required fields: `fecha` (ISO 8601 string), `referencia` (string), `descripcion` (string).

#### Scenario: NCNotificacionComercioExterior requires all three fields
- **WHEN** a developer constructs an `NCNotificacionComercioExterior` without `referencia`
- **THEN** TypeScript emits a compile error for the missing field

---

### Requirement: CreateACInput, UpdateACInput, and CerrarACInput types
The system SHALL define:
- `CreateACInput` with required fields: `descripcion` (string, min 5), `responsableId` (string UUID), `plazoFecha` (ISO 8601 date string).
- `UpdateACInput` as a partial object with optional fields: `estado` (ACStatus), `descripcion` (string), `responsableId` (string UUID), `plazoFecha` (ISO 8601 date string).
- `CerrarACInput` with required field `descripcionEvidencia` (string, min 1) and optional field `evidenciaUrl` (string URL or undefined).
These types SHALL be defined in or exported from the nonconformity types/schemas files.

#### Scenario: CreateACInput rejects payload missing descripcion
- **WHEN** a developer assigns a `CreateACInput` without `descripcion`
- **THEN** TypeScript emits a compile error

#### Scenario: CreateACInput rejects missing responsableId
- **WHEN** a developer parses an object without `responsableId` through the AC creation schema
- **THEN** Zod returns an error with path `['responsableId']`

#### Scenario: UpdateACInput accepts partial payload with only estado
- **WHEN** a developer constructs `UpdateACInput` with only `{ estado: 'EN_EJECUCION' }`
- **THEN** TypeScript accepts it without error

#### Scenario: CerrarACInput requires descripcionEvidencia
- **WHEN** a developer assigns a `CerrarACInput` without `descripcionEvidencia`
- **THEN** TypeScript emits a compile error

#### Scenario: CerrarACInput rejects empty descripcionEvidencia
- **WHEN** a developer parses `{ descripcionEvidencia: '' }` through the cerrar AC schema
- **THEN** Zod returns an error with path `['descripcionEvidencia']`

#### Scenario: CerrarACInput accepts payload without evidenciaUrl
- **WHEN** a developer constructs `CerrarACInput` with only `{ descripcionEvidencia: 'Evidencia adjunta' }`
- **THEN** TypeScript and Zod accept it without error

---

### Requirement: NoConformidad interface
The system SHALL define a `NoConformidad` interface with the following required fields: `id`, `numero` (format `NC-[DOMINIO_ABBR]-YYYY-NNN` where DOMINIO_ABBR is CAL, SST, ADU, OPE, or PRV), `dominio` (NCDominio), `titulo` (string), `origen`, `tipo`, `severidad`, `estado`, `descripcion`, `areaAfectada`, `reportadoPorId`, `fechaDeteccion`, `fechaReporte`, `requiereIPER` (boolean — only meaningful when `dominio === 'NC-SST'`), `accionesCorrectivas` (AccionCorrectiva[]), `documentosVinculados`, `adjuntos`, `auditTrail`, `creadoEn`, `actualizadoEn`. The interface SHALL also include the following optional fields: `detectadoPor` (string or undefined), `justificacionAnulacion` (string or undefined), `mineralInvolucrado`, `turno` (`'DIA' | 'TARDE' | 'NOCHE'`), `responsableInvestigacionId`, `accionInmediata`, `accionInmediataFecha`, `correccion`, `correccionEvidenciaUrl`, `causaRaiz`, `corregidoPorId`, `verificadoPorId`, `fechaVerificacion`, `resultadoVerificacion` (`'EFECTIVO' | 'NO_EFECTIVO'`), `qeGeneradoId`, `notificacionComercioExterior` (NCNotificacionComercioExterior — only meaningful when `dominio === 'NC-ADU'`).

#### Scenario: NoConformidad rejects missing required fields
- **WHEN** a developer constructs a `NoConformidad` without `numero` or `areaAfectada`
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

---

### Requirement: NoConformidad includes optional fechaCierre field
The system SHALL add a `fechaCierre?: string` optional field to the `NoConformidad` interface in `src/features/nonconformities/types/nonconformity.types.ts`. This field represents the expected closing deadline of the non-conformity (ISO 8601 date string), set by the supervisor when creating or updating the NC. It is distinct from `AccionCorrectiva.fechaCierre` (which is the actual close date of a corrective action). The field SHALL be optional to support NCs that have not yet had a closing deadline assigned.

#### Scenario: NoConformidad accepts fechaCierre as undefined
- **WHEN** a developer constructs a `NoConformidad` without `fechaCierre`
- **THEN** TypeScript accepts the object without error

#### Scenario: NoConformidad accepts a valid ISO date string as fechaCierre
- **WHEN** a developer constructs a `NoConformidad` with `fechaCierre: '2026-03-15'`
- **THEN** TypeScript accepts the value without error

#### Scenario: fechaCierre is typed as string or undefined
- **WHEN** a developer reads `noConformidad.fechaCierre`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`

---

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

---

### Requirement: NC-scoped AuditTrailEntry interface
The system SHALL define an `AuditTrailEntry` interface scoped to the non-conformity domain with fields: `id`, `entidadTipo` (literal `'NoConformidad'`), `entidadId`, `accion`, `estadoAnterior?`, `estadoNuevo?`, `campoModificado?`, `valorAnterior?`, `valorNuevo?`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `ipOrigen?`, `generadoPorIA`.

#### Scenario: NC AuditTrailEntry entidadTipo is narrowed to NoConformidad
- **WHEN** a developer reads `auditEntry.entidadTipo` on an NC audit entry
- **THEN** TypeScript narrows the value to the literal `'NoConformidad'`, not the generic union
