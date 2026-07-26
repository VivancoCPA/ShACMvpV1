## MODIFIED Requirements

### Requirement: resolveQEEditAccess combines RN-QE-014/015/016

The system SHALL export a pure function `resolveQEEditAccess(qe: QualityEvent, usuario: Pick<User, 'id' | 'rol' | 'areaIds'>, ahora: Date = new Date()): QEEditAccess` from `src/features/quality-events/utils/qualityEventPermissions.ts`, where `QEEditAccess` is `{ reporteInicial: boolean; severidad: boolean; mineral: boolean }`.

`reporteInicial` SHALL be `true` when `ventanaReporteInicialAbierta(qe, ahora)` is `true` AND (`usuario.id === qe.reportadoPorId` OR (`usuario.rol === 'SUPERVISOR'` AND `(usuario.areaIds ?? []).includes(qe.areaId)`)). A Supervisor's own `areaId` (their home department) is NOT used for this check — only `areaIds`, the explicit list of area FKs they are assigned to supervise for QE purposes (see `User.areaIds` in the user model, M6-S08).

`severidad` SHALL be `true` when `usuario.rol === 'JEFE_CALIDAD_SYST'` AND `qe.estado` is one of `'ABIERTO' | 'EN_INVESTIGACION' | 'ANALISIS_COMPLETADO' | 'EN_EJECUCION' | 'PENDIENTE_CIERRE'` (i.e. any state strictly before `CERRADO`).

`mineral` SHALL be `true` when the same role/state condition as `severidad` holds AND `qe.tipo` is `'CALIDAD'` or `'OPERACIONAL'`.

#### Scenario: Creator within window gets reporteInicial true, others false

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', tipo: 'SST', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-1', rol: 'OPERARIO', areaId: 'area-001' }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** the return value is `{ reporteInicial: true, severidad: false, mineral: false }`

#### Scenario: Supervisor whose areaIds includes the affected area (not creator) within window gets reporteInicial true

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', areaId: 'area-001', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-2', rol: 'SUPERVISOR', areaIds: ['area-001', 'area-002'] }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** `reporteInicial` is `true`

#### Scenario: Supervisor whose areaIds does not include the affected area gets reporteInicial false

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1', areaId: 'area-001', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'user-2', rol: 'SUPERVISOR', areaIds: ['area-002'] }, new Date('2026-05-01T09:00:00Z'))`
- **THEN** `reporteInicial` is `false`, even if the same Supervisor's own `areaId` field happens to equal `'area-001'`

#### Scenario: JEFE_CALIDAD_SYST gets severidad and mineral true for CALIDAD tipo before CERRADO

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'EN_EJECUCION', tipo: 'CALIDAD' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', areaId: 'area-007' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: true, mineral: true }`

#### Scenario: JEFE_CALIDAD_SYST gets mineral false for SST tipo

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'EN_INVESTIGACION', tipo: 'SST' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', areaId: 'area-007' })`
- **THEN** `severidad` is `true` and `mineral` is `false`

#### Scenario: JEFE_CALIDAD_SYST gets all edit flags false once CERRADO

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'CERRADO', tipo: 'CALIDAD' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', areaId: 'area-007' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: false, mineral: false }`

#### Scenario: Double-role user gets both reporteInicial and severidad/mineral true

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'jc-1', tipo: 'OPERACIONAL', fechaHoraReporte: '2026-05-01T08:00:00Z' }, { id: 'jc-1', rol: 'JEFE_CALIDAD_SYST', areaId: 'area-007' }, new Date('2026-05-01T08:30:00Z'))`
- **THEN** the return value is `{ reporteInicial: true, severidad: true, mineral: true }`

#### Scenario: OPERARIO who is neither creator nor supervisor gets all flags false

- **WHEN** a developer calls `resolveQEEditAccess({ ...qe, estado: 'ABIERTO', reportadoPorId: 'user-1' }, { id: 'user-9', rol: 'OPERARIO' })`
- **THEN** the return value is `{ reporteInicial: false, severidad: false, mineral: false }`
