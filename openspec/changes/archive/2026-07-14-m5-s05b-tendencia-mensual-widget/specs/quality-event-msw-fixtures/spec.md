## ADDED Requirements

### Requirement: fechaHoraReporte y fechaCierre distribuidos en los 12 meses de tendencia mensual
Además de la distribución de `fechaHoraEvento` en los últimos 6 meses (ver requisito existente), las fixtures SHALL colectivamente cubrir con al menos una entrada por mes los 12 meses hacia atrás desde la fecha de referencia del sistema tanto para `fechaHoraReporte` como para `fechaCierre`, de forma que el widget de tendencia mensual (`dashboard-trend-widget`) no muestre `0` estructural en `tendenciaMensualVolumen.abiertos` para ningún mes del rango de 12 meses. Los ajustes de fecha SHALL preservar las restricciones narrativas ya existentes de cada fixture (`causaRaizFirmadaEn` < `fechaCierre` < `fechaVerificacionProgramada`/`fechaVerificacionRealizada`/fecha actual del sistema) y SHALL priorizar mover fechas de registros existentes antes que agregar fixtures nuevos, para no alterar las proporciones mínimas ya exigidas por los demás requisitos de esta spec (cobertura de enums, `ciclo > 1`, `VERIFICADO`, seeded ACs).

#### Scenario: Cada uno de los 12 meses tiene al menos un fechaHoraReporte
- **WHEN** se agrupan los 12 meses hacia atrás desde la fecha de referencia del sistema
- **THEN** cada mes tiene al menos una fixture con `fechaHoraReporte` dentro de ese mes

#### Scenario: La mayoría de los 12 meses tiene al menos un fechaCierre
- **WHEN** se agrupan los 12 meses hacia atrás desde la fecha de referencia del sistema
- **THEN** al menos 10 de los 12 meses tienen al menos una fixture con `fechaCierre` dentro de ese mes (los meses sin cierre, si los hay, quedan documentados como gap aceptado en `design.md`, no forzados artificialmente)

#### Scenario: Los ajustes de fecha no rompen restricciones narrativas existentes
- **WHEN** se inspecciona cualquier fixture cuyo `fechaCierre` fue movido para esta spec
- **THEN** `fechaCierre` sigue siendo posterior a `causaRaizFirmadaEn` y anterior a `fechaVerificacionProgramada`/`fechaVerificacionRealizada` (cuando existan) y a la fecha actual del sistema
