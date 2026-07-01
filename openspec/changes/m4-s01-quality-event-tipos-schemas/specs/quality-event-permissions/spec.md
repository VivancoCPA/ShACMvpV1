# Spec: quality-event-permissions

## Purpose

RBAC permission derivation and business-rule validators for the Quality Event domain. Defines the `QEPermissions` interface, the `getQualityEventPermissions` helper, and the five business-rule invariant functions (RN-QE-002, 003, 004, 005, 008). All exports live in `src/features/quality-events/utils/qualityEventPermissions.ts` and `src/features/quality-events/utils/qualityEventHelpers.ts`.

---

## ADDED Requirements

### Requirement: QEPermissions interface
The system SHALL define a `QEPermissions` interface in `src/features/quality-events/types/qualityEventPermissions.types.ts` with the following required boolean flags: `puedeEditarCabecera`, `puedeEditarCausaRaiz`, `puedeAvanzarEstado`, `puedeCerrar`, `puedeFirmarCierre`, `puedeVerificar`, `puedeReabrir`, `soloLectura`. All flags SHALL be required booleans with no optional members.

#### Scenario: QEPermissions has all eight flags as required booleans
- **WHEN** a developer constructs a `QEPermissions` object
- **THEN** TypeScript requires all eight flags to be explicitly assigned and rejects any extra properties

---

### Requirement: getQualityEventPermissions function
The system SHALL export a pure function `getQualityEventPermissions(estado: QEStatus, rol: UserRole, esResponsable: boolean): QEPermissions` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return a `QEPermissions` object with all flags set according to the RBAC matrix below. The function SHALL NOT throw.

**RBAC matrix:**

| Flag | OPERARIO | SUPERVISOR | JEFE_CALIDAD_SYST | AUDITOR_INTERNO | ALTA_DIRECCION | JEFE_CONTROL_DOCUMENTARIO |
|------|----------|------------|-------------------|-----------------|----------------|---------------------------|
| `puedeEditarCabecera` | false | ABIERTO && esResponsable | ABIERTO | false | false | false |
| `puedeEditarCausaRaiz` | false | false | EN_INVESTIGACION \| ANALISIS_COMPLETADO | false | false | false |
| `puedeAvanzarEstado` | false | ABIERTO→EN_INVESTIGACION only | all except VERIFICADO | false | false | false |
| `puedeCerrar` | false | false | PENDIENTE_CIERRE | false | false | false |
| `puedeFirmarCierre` | false | PENDIENTE_CIERRE | false | false | false | false |
| `puedeVerificar` | false | false | false | EN_VERIFICACION && esResponsable | false | false |
| `puedeReabrir` | false | false | EN_VERIFICACION | false | false | false |
| `soloLectura` | true | false | false | true (unless puedeVerificar) | true | true |

#### Scenario: getQualityEventPermissions returns all false and soloLectura true for JEFE_CONTROL_DOCUMENTARIO
- **WHEN** a developer calls `getQualityEventPermissions('ABIERTO', 'JEFE_CONTROL_DOCUMENTARIO', false)`
- **THEN** all action flags are `false` and `soloLectura` is `true`

#### Scenario: getQualityEventPermissions returns soloLectura true for ALTA_DIRECCION
- **WHEN** a developer calls `getQualityEventPermissions('EN_EJECUCION', 'ALTA_DIRECCION', false)`
- **THEN** `soloLectura` is `true` and all action flags are `false`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to edit causa raiz in EN_INVESTIGACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_INVESTIGACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeEditarCausaRaiz` is `true`

#### Scenario: getQualityEventPermissions allows SUPERVISOR to edit cabecera only in ABIERTO when esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('ABIERTO', 'SUPERVISOR', true)`
- **THEN** `puedeEditarCabecera` is `true`

#### Scenario: getQualityEventPermissions does not allow SUPERVISOR to edit cabecera in EN_INVESTIGACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_INVESTIGACION', 'SUPERVISOR', true)`
- **THEN** `puedeEditarCabecera` is `false`

#### Scenario: getQualityEventPermissions allows SUPERVISOR to firmarCierre in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'SUPERVISOR', false)`
- **THEN** `puedeFirmarCierre` is `true` and `puedeCerrar` is `false`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to cerrar in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeCerrar` is `true` and `puedeFirmarCierre` is `false`

#### Scenario: getQualityEventPermissions allows AUDITOR_INTERNO to verificar only when esResponsable in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'AUDITOR_INTERNO', true)`
- **THEN** `puedeVerificar` is `true` and `soloLectura` is `false`

#### Scenario: getQualityEventPermissions returns soloLectura for AUDITOR_INTERNO when not esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('EN_EJECUCION', 'AUDITOR_INTERNO', false)`
- **THEN** `soloLectura` is `true` and `puedeVerificar` is `false`

#### Scenario: getQualityEventPermissions JEFE_CALIDAD_SYST can reabrir in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeReabrir` is `true`

#### Scenario: getQualityEventPermissions JEFE_CALIDAD_SYST cannot reabrir in VERIFICADO
- **WHEN** a developer calls `getQualityEventPermissions('VERIFICADO', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeReabrir` is `false`

---

### Requirement: validateTransitionToEnEjecucion function (RN-QE-002)
The system SHALL export a pure function `validateTransitionToEnEjecucion(qe: QualityEvent): { valid: boolean; reason?: string }` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return `{ valid: false, reason: 'Se requiere causa raíz definitiva aprobada y firmada antes de pasar a EN_EJECUCION' }` if `qe.causaRaizDefinitiva` is absent or empty OR if `qe.causaRaizFirmadaEn` is absent. Otherwise it SHALL return `{ valid: true }`.

#### Scenario: validateTransitionToEnEjecucion returns invalid when causaRaizDefinitiva is absent
- **WHEN** a developer calls `validateTransitionToEnEjecucion({ ...qe, causaRaizDefinitiva: undefined, causaRaizFirmadaEn: '2025-06-01T10:00:00Z' })`
- **THEN** `valid` is `false` and `reason` is a non-empty string

#### Scenario: validateTransitionToEnEjecucion returns invalid when causaRaizFirmadaEn is absent
- **WHEN** a developer calls `validateTransitionToEnEjecucion({ ...qe, causaRaizDefinitiva: 'Causa definida', causaRaizFirmadaEn: undefined })`
- **THEN** `valid` is `false` and `reason` is a non-empty string

#### Scenario: validateTransitionToEnEjecucion returns valid when both fields are present
- **WHEN** a developer calls `validateTransitionToEnEjecucion({ ...qe, causaRaizDefinitiva: 'Causa definida con contenido', causaRaizFirmadaEn: '2025-06-01T10:00:00Z' })`
- **THEN** `valid` is `true` and `reason` is undefined

---

### Requirement: validateTransitionToPendienteCierre function (RN-QE-003)
The system SHALL export a pure function `validateTransitionToPendienteCierre(qe: QualityEvent): { valid: boolean; reason?: string }` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return `{ valid: false, reason: 'Existen acciones correctivas pendientes o en ejecución sin evidencia' }` if `qe.accionesCorrectivas` contains any entry whose `estado` is `'PENDIENTE'` or `'EN_EJECUCION'` AND whose `evidencia` is absent or empty. Otherwise it SHALL return `{ valid: true }`.

#### Scenario: validateTransitionToPendienteCierre returns invalid when AC has estado PENDIENTE without evidencia
- **WHEN** a developer calls `validateTransitionToPendienteCierre({ ...qe, accionesCorrectivas: [{ id: '1', qeId: 'qe-1', descripcion: '...', responsableId: 'u1', fechaLimite: '2025-12-31', estado: 'PENDIENTE', evidencia: undefined, creadoEn: '...', actualizadoEn: '...' }] })`
- **THEN** `valid` is `false` and `reason` is a non-empty string

#### Scenario: validateTransitionToPendienteCierre returns valid when all ACs have estado CERRADA
- **WHEN** a developer calls `validateTransitionToPendienteCierre({ ...qe, accionesCorrectivas: [{ ...ac, estado: 'CERRADA', evidencia: 'url-evidencia' }] })`
- **THEN** `valid` is `true`

#### Scenario: validateTransitionToPendienteCierre returns valid when accionesCorrectivas is empty
- **WHEN** a developer calls `validateTransitionToPendienteCierre({ ...qe, accionesCorrectivas: [] })`
- **THEN** `valid` is `true`

#### Scenario: validateTransitionToPendienteCierre returns invalid when AC is EN_EJECUCION without evidencia
- **WHEN** a developer calls `validateTransitionToPendienteCierre({ ...qe, accionesCorrectivas: [{ ...ac, estado: 'EN_EJECUCION', evidencia: undefined }] })`
- **THEN** `valid` is `false`

---

### Requirement: validateTransitionToCerrado function (RN-QE-004)
The system SHALL export a pure function `validateTransitionToCerrado(qe: QualityEvent): { valid: boolean; reason?: string }` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return `{ valid: false, reason: 'Se requiere firma dual: Jefe Calidad y Supervisor' }` if `qe.cerradoPorId` is absent OR `qe.cierreFirmaSupervisorId` is absent. Otherwise it SHALL return `{ valid: true }`.

#### Scenario: validateTransitionToCerrado returns invalid when cerradoPorId is absent
- **WHEN** a developer calls `validateTransitionToCerrado({ ...qe, cerradoPorId: undefined, cierreFirmaSupervisorId: 'sup-1' })`
- **THEN** `valid` is `false` and `reason` is a non-empty string

#### Scenario: validateTransitionToCerrado returns invalid when cierreFirmaSupervisorId is absent
- **WHEN** a developer calls `validateTransitionToCerrado({ ...qe, cerradoPorId: 'jc-1', cierreFirmaSupervisorId: undefined })`
- **THEN** `valid` is `false` and `reason` is a non-empty string

#### Scenario: validateTransitionToCerrado returns valid when both signatures are present
- **WHEN** a developer calls `validateTransitionToCerrado({ ...qe, cerradoPorId: 'jc-1', cierreFirmaSupervisorId: 'sup-1' })`
- **THEN** `valid` is `true` and `reason` is undefined

---

### Requirement: requiereNotificacionUrgente helper (RN-QE-005)
The system SHALL export a pure function `requiereNotificacionUrgente(qe: QualityEvent): boolean` from `src/features/quality-events/utils/qualityEventHelpers.ts`. The function SHALL return `true` if and only if `qe.severidad === 'CRITICA'`. The actual notification dispatch is not part of this function — it only exposes the flag.

#### Scenario: requiereNotificacionUrgente returns true for severidad CRITICA
- **WHEN** a developer calls `requiereNotificacionUrgente({ ...qe, severidad: 'CRITICA' })`
- **THEN** the return value is `true`

#### Scenario: requiereNotificacionUrgente returns false for severidad ALTA
- **WHEN** a developer calls `requiereNotificacionUrgente({ ...qe, severidad: 'ALTA' })`
- **THEN** the return value is `false`

#### Scenario: requiereNotificacionUrgente returns false for severidad BAJA
- **WHEN** a developer calls `requiereNotificacionUrgente({ ...qe, severidad: 'BAJA' })`
- **THEN** the return value is `false`

---

### Requirement: estaVencidaVerificacion helper (RN-QE-008)
The system SHALL export a pure function `estaVencidaVerificacion(qe: QualityEvent, hoy: Date): boolean` from `src/features/quality-events/utils/qualityEventHelpers.ts`. The function SHALL return `true` if all of the following are true: (1) `qe.fechaVerificacionProgramada` is defined, (2) `qe.fechaVerificacionRealizada` is absent, (3) more than 10 business days (Monday through Friday, excluding weekends) have elapsed between `qe.fechaVerificacionProgramada` and `hoy`. The function SHALL return `false` in all other cases, including when `qe.fechaVerificacionProgramada` is absent.

#### Scenario: estaVencidaVerificacion returns true when 11 business days have passed without realizacion
- **WHEN** a developer calls `estaVencidaVerificacion({ ...qe, fechaVerificacionProgramada: '2025-06-02', fechaVerificacionRealizada: undefined }, new Date('2025-06-17'))`
- **THEN** the return value is `true` (2025-06-02 to 2025-06-17 is 10 business days, but 11 calendar days pass the 10-day threshold excluding weekends)

#### Scenario: estaVencidaVerificacion returns false when fechaVerificacionRealizada is present
- **WHEN** a developer calls `estaVencidaVerificacion({ ...qe, fechaVerificacionProgramada: '2025-06-02', fechaVerificacionRealizada: '2025-06-05' }, new Date('2025-06-17'))`
- **THEN** the return value is `false`

#### Scenario: estaVencidaVerificacion returns false when fechaVerificacionProgramada is absent
- **WHEN** a developer calls `estaVencidaVerificacion({ ...qe, fechaVerificacionProgramada: undefined, fechaVerificacionRealizada: undefined }, new Date('2025-06-17'))`
- **THEN** the return value is `false`

#### Scenario: estaVencidaVerificacion returns false when fewer than 10 business days have passed
- **WHEN** a developer calls `estaVencidaVerificacion({ ...qe, fechaVerificacionProgramada: '2025-06-09', fechaVerificacionRealizada: undefined }, new Date('2025-06-17'))`
- **THEN** the return value is `false` (only ~6 business days elapsed)
