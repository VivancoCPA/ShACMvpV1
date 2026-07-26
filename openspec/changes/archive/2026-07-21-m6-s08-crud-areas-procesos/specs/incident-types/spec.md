## MODIFIED Requirements

### Requirement: Incidente interface

The system SHALL define an `Incidente` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `numero` (string, format `INC-YYYY-NNN`), `tipo` (IncidentType), `estado` (IncidentStatus), `severidad` (IncidentSeveridad), `descripcion` (string, minimum 20 characters enforced at schema level), `areaId` (string — FK to `Area.id`, the M6-S08 administered area catalog), `turno` (IncidentTurno), `fechaEvento` (ISO 8601 datetime string), `fechaReporte` (ISO 8601 datetime string), `reportadoPorId` (string userId), `huboLesionados` (boolean), `auditTrail` (AuditTrailEntry[]), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `numPersonasAfectadas` (number — only meaningful when `huboLesionados === true`), `personalInvolucrado` (string[] — userIds), `testigos` (string[] — userIds or free names), `equiposInvolucrados` (string[]), `condicionesEntorno` (CondicionEntorno[]), `atencionMedicaRequerida` (boolean), `atencionMedicaDescripcion` (string), `notificacionAmbientalRequerida` (boolean), `informeMedicoAdjunto` (string — URL, required for closure of ACCIDENTE type per RN-INC-002, validated at component level), `qeId` (string — provisional stub for M4 linkage), `accionesCorrectivas` (AccionCorrectivaIncidente[]), `deletedAt` (ISO 8601 string — soft delete marker).

`areaId` is now a genuine foreign key: its value SHALL always correspond to an `Area.id` from the M6-S08 administered catalog (`area-admin-mocks`). Prior to M6-S08, `areaId` held the literal area name string sourced from the now-removed `AREAS_SHAC` constant (see `shared-constants`); despite the field's name being unchanged since its original introduction, this is a semantic behavior change — the value is no longer a free-text name but an opaque catalog identifier. Display of the area name in any UI consuming `Incidente.areaId` SHALL resolve it via `useAreas()` / `useArea(id)` (`area-admin-hooks`), not by displaying `areaId` directly.

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

#### Scenario: areaId on fixtures resolves to a real Area catalog entry

- **WHEN** an `Incidente` fixture is constructed with `areaId: 'area-001'`
- **THEN** `'area-001'` corresponds to an existing entry in `areaFixtures` (`area-admin-mocks`), not to a free-text area name
