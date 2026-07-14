## ADDED Requirements

### Requirement: Fixtures cerrados o verificados incluyen fechaCierre top-level
Todo fixture de `qualityEventFixtures` cuyo `estado` sea `CERRADO`, `EN_VERIFICACION` o `VERIFICADO` SHALL tener el campo top-level `fechaCierre` poblado con una fecha ISO 8601 válida. `fechaCierre` SHALL ser posterior a `causaRaizFirmadaEn` (cuando esté presente) y anterior a `fechaVerificacionProgramada` y `fechaVerificacionRealizada` (cuando estén presentes), de modo que las fórmulas de KPI-03 (Tiempo Promedio de Cierre) y KPI-09 (Cumplimiento de Firma Dual en Cierre de QE Críticos) —ambas filtrando QE en `CERRADO`/`VERIFICADO` por `fechaCierre` dentro del periodo— calculen valores distintos de cero contra el seed.

#### Scenario: Todo fixture CERRADO/EN_VERIFICACION/VERIFICADO tiene fechaCierre
- **WHEN** `qualityEventFixtures` se filtra por `qe => ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO'].includes(qe.estado)`
- **THEN** todo elemento del resultado tiene `fechaCierre` definido y parseable como fecha válida

#### Scenario: fechaCierre es posterior a causaRaizFirmadaEn
- **WHEN** un fixture tiene `causaRaizFirmadaEn` y `fechaCierre` definidos
- **THEN** `new Date(fechaCierre) > new Date(causaRaizFirmadaEn)`

#### Scenario: fechaCierre es anterior a fechaVerificacionProgramada cuando existe
- **WHEN** un fixture tiene `fechaVerificacionProgramada` y `fechaCierre` definidos
- **THEN** `new Date(fechaCierre) < new Date(fechaVerificacionProgramada)`

#### Scenario: KPI-03 calcula un promedio distinto de cero contra el seed
- **WHEN** se calcula KPI-03 sobre `qualityEventFixtures` para el mes en que caen 2 o más `fechaCierre` de QE en `CERRADO`/`VERIFICADO`
- **THEN** el valor calculado es mayor que `0`

#### Scenario: KPI-09 calcula un porcentaje distinto de cero contra el seed
- **WHEN** existe al menos un fixture con `severidad: 'CRITICA'`, `estado` en `CERRADO`/`VERIFICADO`, `fechaCierre` dentro del periodo consultado, y `cierreFirmaSupervisorId` definido
- **THEN** el valor de KPI-09 calculado para ese periodo es mayor que `0`

---

### Requirement: Al menos un QE crítico cerrado con firma dual
`qualityEventFixtures` SHALL incluir al menos un elemento con `severidad: 'CRITICA'` y `estado` en `CERRADO`/`EN_VERIFICACION`/`VERIFICADO`, con `cierreFirmaSupervisorId` definido. Antes de este requisito, los únicos QE `CRITICA` del seed se encontraban en `ABIERTO`/`EN_INVESTIGACION`, haciendo que KPI-09 fuera estructuralmente `0` sin importar el periodo consultado.

#### Scenario: Existe al menos un QE CRITICA cerrado o verificado
- **WHEN** `qualityEventFixtures` se filtra por `qe => qe.severidad === 'CRITICA' && ['CERRADO', 'EN_VERIFICACION', 'VERIFICADO'].includes(qe.estado)`
- **THEN** el resultado tiene al menos 1 elemento, y ese elemento tiene `cierreFirmaSupervisorId` definido
