# Spec: quality-event-permissions

## Purpose

RBAC permission derivation and business-rule validators for the Quality Event domain. Defines the `QEPermissions` interface, the `getQualityEventPermissions` helper, and the five business-rule invariant functions (RN-QE-002, 003, 004, 005, 008). All exports live in `src/features/quality-events/utils/qualityEventPermissions.ts` and `src/features/quality-events/utils/qualityEventHelpers.ts`.

---

## Requirements

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
| `puedeFirmarCierre` | false | PENDIENTE_CIERRE | false | false | PENDIENTE_CIERRE && esResponsable | false |
| `puedeVerificar` | false | false | EN_VERIFICACION | EN_VERIFICACION && esResponsable | false | false |
| `puedeReabrir` | false | false | EN_VERIFICACION | false | false | false |
| `soloLectura` | true | false | false | true (unless puedeVerificar) | true (unless puedeFirmarCierre) | true |

For `ALTA_DIRECCION`, `esResponsable` SHALL be interpreted by the caller as "this user is the resolved second-signer role for this QE" (i.e. `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada) === 'ALTA_DIRECCION'`), mirroring how `esResponsable` is already overloaded for `SUPERVISOR`'s `puedeEditarCabecera` and `AUDITOR_INTERNO`'s `puedeVerificar`.

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

#### Scenario: getQualityEventPermissions allows ALTA_DIRECCION to firmarCierre only when esResponsable in PENDIENTE_CIERRE
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', true)`
- **THEN** `puedeFirmarCierre` is `true` and `soloLectura` is `false`

#### Scenario: getQualityEventPermissions denies ALTA_DIRECCION firmarCierre when not esResponsable
- **WHEN** a developer calls `getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', false)`
- **THEN** `puedeFirmarCierre` is `false` and `soloLectura` is `true`

#### Scenario: getQualityEventPermissions allows JEFE_CALIDAD_SYST to verificar in EN_VERIFICACION
- **WHEN** a developer calls `getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)`
- **THEN** `puedeVerificar` is `true`

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

---

### Requirement: resolveRolSegundaFirma escalation helper
The system SHALL export a pure function `resolveRolSegundaFirma(primerFirmanteId: string, areaAfectada: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` from `src/features/quality-events/utils/qualityEventPermissions.ts`, implementing the RN-QE-004 escalation rule: if the user identified by `primerFirmanteId` has their own `rol === 'SUPERVISOR'` and `area === areaAfectada`, the function SHALL return `'ALTA_DIRECCION'`; otherwise (including when no matching user is found) it SHALL return `'SUPERVISOR'`.

#### Scenario: Escalates when the first signer is also the area's supervisor
- **WHEN** `resolveRolSegundaFirma('user-x', 'Operaciones')` is called and the user `user-x` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'ALTA_DIRECCION'`

#### Scenario: Does not escalate for the normal JEFE_CALIDAD_SYST first signer
- **WHEN** `resolveRolSegundaFirma('user-005', 'Calidad')` is called and `user-005` has `rol: 'JEFE_CALIDAD_SYST'`
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Does not escalate when the SUPERVISOR match is for a different area
- **WHEN** `resolveRolSegundaFirma('user-003', 'Almacén Norte')` is called and `user-003` has `rol: 'SUPERVISOR'` and `area: 'Operaciones'`
- **THEN** the return value is `'SUPERVISOR'`

#### Scenario: Falls back to SUPERVISOR when the user cannot be found
- **WHEN** `resolveRolSegundaFirma('user-desconocido', 'Calidad')` is called
- **THEN** the return value is `'SUPERVISOR'`

---

### Requirement: ventanaReporteInicialAbierta helper (RN-QE-010 time window)
The system SHALL export a pure function `ventanaReporteInicialAbierta(qe: QualityEvent, ahora: Date): boolean` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return `true` if and only if `qe.estado === 'ABIERTO'` AND the elapsed time between `qe.fechaHoraReporte` and `ahora` is less than or equal to 2 hours. Both conditions SHALL be evaluated together — the function SHALL return `false` the moment `qe.estado` is no longer `'ABIERTO'`, even if fewer than 2 hours have elapsed.

#### Scenario: Window open within 2 hours and estado ABIERTO
- **WHEN** a developer calls `ventanaReporteInicialAbierta({ ...qe, estado: 'ABIERTO', fechaHoraReporte: '2026-05-01T08:00:00Z' }, new Date('2026-05-01T09:30:00Z'))`
- **THEN** the return value is `true`

#### Scenario: Window closed after 2 hours even in ABIERTO
- **WHEN** a developer calls `ventanaReporteInicialAbierta({ ...qe, estado: 'ABIERTO', fechaHoraReporte: '2026-05-01T08:00:00Z' }, new Date('2026-05-01T10:01:00Z'))`
- **THEN** the return value is `false`

#### Scenario: Window closed once estado leaves ABIERTO, even within 2 hours
- **WHEN** a developer calls `ventanaReporteInicialAbierta({ ...qe, estado: 'EN_INVESTIGACION', fechaHoraReporte: '2026-05-01T08:00:00Z' }, new Date('2026-05-01T08:30:00Z'))`
- **THEN** the return value is `false`

---

### Requirement: resolveQEEditAccess combines RN-QE-010/011/012
The system SHALL export a pure function `resolveQEEditAccess(qe: QualityEvent, usuario: Pick<User, 'id' | 'rol' | 'areasAsignadas'>, ahora: Date = new Date()): QEEditAccess` from `src/features/quality-events/utils/qualityEventPermissions.ts`, where `QEEditAccess` is `{ reporteInicial: boolean; severidad: boolean; mineral: boolean }`.

`reporteInicial` SHALL be `true` when `ventanaReporteInicialAbierta(qe, ahora)` is `true` AND (`usuario.id === qe.reportadoPorId` OR (`usuario.rol === 'SUPERVISOR'` AND `(usuario.areasAsignadas ?? []).includes(qe.areaAfectada)`)). A Supervisor's own `area` (their home department) is NOT used for this check — only `areasAsignadas`, the explicit list of areas they are assigned to supervise for QE purposes (see `User.areasAsignadas` in the user model).

`severidad` SHALL be `true` when `usuario.rol === 'JEFE_CALIDAD_SYST'` AND `qe.estado` is one of `'ABIERTO' | 'EN_INVESTIGACION' | 'ANALISIS_COMPLETADO' | 'EN_EJECUCION' | 'PENDIENTE_CIERRE'` (i.e. any state strictly before `CERRADO`).

`mineral` SHALL be `true` when the same role/state condition as `severidad` holds AND `qe.tipo` is `'CALIDAD'` or `'OPERACIONAL'`.

#### Scenario: Creator within window gets reporteInicial true, others false
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', tipo: 'SST', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-1', rol: 'OPERARIO', area: 'Almacén' }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** the return value is `{ reporteInicial: true, severidad: false, mineral: false }`

#### Scenario: Supervisor whose areasAsignadas includes the affected area (not creator) within window gets reporteInicial true
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', areaAfectada: 'Almacén Norte', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-2', rol: 'SUPERVISOR', areasAsignadas: ['Almacén Norte', 'Almacén Sur'] }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** `reporteInicial` is `true`

#### Scenario: Supervisor whose areasAsignadas does not include the affected area gets reporteInicial false
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', areaAfectada: 'Almacén Norte', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-2', rol: 'SUPERVISOR', areasAsignadas: ['Almacén Sur'] }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** `reporteInicial` is `false`, even if the same Supervisor's own `area` field happens to equal `'Almacén Norte'`

#### Scenario: JEFE_CALIDAD_SYST gets severidad and mineral true for CALIDAD tipo before CERRADO
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'EN_EJECUCION', tipo: 'CALIDAD' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: true, mineral: true }`

#### Scenario: JEFE_CALIDAD_SYST gets mineral false for SST tipo
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'EN_INVESTIGACION', tipo: 'SST' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })`
- **THEN** `severidad` is `true` and `mineral` is `false`

#### Scenario: JEFE_CALIDAD_SYST gets all edit flags false once CERRADO
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'CERRADO', tipo: 'CALIDAD' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: false, mineral: false }`

#### Scenario: Double-role user gets both reporteInicial and severidad/mineral true
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'jc-1', tipo: 'OPERACIONAL', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' }, new Date('2026-05-01T08:30:00Z'))`
- **THEN** the return value is `{ reporteInicial: true, severidad: true, mineral: true }`

#### Scenario: OPERARIO who is neither creator nor supervisor gets all flags false
- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1' }, { id: 'user-9', rol: 'OPERARIO' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: false, mineral: false }`

---

### Requirement: puedeEditarQE helper (RN-QE-010/011/012 visibility)
The system SHALL export a pure function `puedeEditarQE(qe: QualityEvent, usuario: Pick<User, 'id' | 'rol' | 'areasAsignadas'>, ahora: Date = new Date()): boolean` from `src/features/quality-events/utils/qualityEventPermissions.ts`. The function SHALL return `resolveQEEditAccess(qe, usuario, ahora).reporteInicial || resolveQEEditAccess(qe, usuario, ahora).severidad || resolveQEEditAccess(qe, usuario, ahora).mineral`. This is the sole function `QualityEventList` SHALL use to decide whether the Acciones column renders an "Editar" icon for a given row.

#### Scenario: puedeEditarQE true when any access flag is true
- **WHEN** a developer calls `puedeEditarQE(qe, usuario, ahora)` where `resolveQEEditAccess` would return `{ reporteInicial: false, severidad: true, mineral: false }`
- **THEN** the return value is `true`

#### Scenario: puedeEditarQE false when all access flags are false
- **WHEN** a developer calls `puedeEditarQE(qe, usuario, ahora)` for an `OPERARIO` who is not the creator, on a QE outside the RN-QE-010 window
- **THEN** the return value is `false`

#### Scenario: puedeEditarQE defaults ahora to the current time
- **WHEN** a developer calls `puedeEditarQE(qe, usuario)` without a third argument
- **THEN** the function evaluates `ventanaReporteInicialAbierta` against `new Date()` internally without throwing
