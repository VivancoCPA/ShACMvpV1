## ADDED Requirements

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
