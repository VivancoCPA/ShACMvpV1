## MODIFIED Requirements

### Requirement: Fixture de horas trabajadas por área y mes
El sistema SHALL definir `src/mocks/fixtures/horasTrabajadas.fixtures.ts` exportando `horasTrabajadasFixtures: HorasTrabajadasEntry[]`, donde `HorasTrabajadasEntry` es `{ area: string; periodo: string; horas: number }`. `periodo` SHALL tener el formato `'YYYY-MM'`. El fixture SHALL cubrir al menos 12 periodos mensuales consecutivos para cada una de las áreas listadas en `AREAS_SHAC` (`src/constants/shared.constants.ts`), incluyendo el mes actual del sistema, con valores de `horas` positivos y plausibles (entre 200 y 5000 horas/mes según el tamaño típico del área).

#### Scenario: Cobertura de al menos 12 meses por área
- **WHEN** se agrupa `horasTrabajadasFixtures` por `area`
- **THEN** cada área de `AREAS_SHAC` tiene al menos 12 entradas con `periodo` distintos

#### Scenario: El mes actual del sistema tiene datos de horas
- **WHEN** se filtra `horasTrabajadasFixtures` por el periodo del mes actual del sistema
- **THEN** existe al menos una entrada por cada área de `AREAS_SHAC`

#### Scenario: No hay horas negativas o nulas
- **WHEN** se itera `horasTrabajadasFixtures`
- **THEN** todo `horas` es un número mayor que 0

#### Scenario: periodo tiene formato YYYY-MM
- **WHEN** se inspecciona cualquier entrada de `horasTrabajadasFixtures`
- **THEN** `periodo` cumple el patrón `/^\d{4}-\d{2}$/`

---

### Requirement: Fixture exportado desde el índice de fixtures
`horasTrabajadasFixtures` SHALL re-exportarse desde `src/mocks/fixtures/index.ts` junto con los fixtures de los demás dominios, sin remover ninguna exportación existente.

#### Scenario: index.ts incluye horasTrabajadasFixtures
- **WHEN** se importa `src/mocks/fixtures/index.ts`
- **THEN** `horasTrabajadasFixtures` está disponible en las exportaciones, junto a `qualityEventFixtures`, `documentFixtures`, `incidentFixtures` y `nonconformityFixtures`
