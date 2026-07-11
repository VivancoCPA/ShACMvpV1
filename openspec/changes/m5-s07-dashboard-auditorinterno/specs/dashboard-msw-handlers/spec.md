## ADDED Requirements

### Requirement: buildAuditorData calcula hallazgos por área, por estado, evidencias disponibles y tasa de cierre en plazo por área
`buildAuditorData()` SHALL calcular, sin duplicar lógica existente:
- `hallazgosPorArea`: QE con `origen === 'O3_HALLAZGO_AUDITORIA'` agrupados por `areaAfectada`, mismo patrón de `Map<area, count>` → `.sort((a, b) => b.total - a.total)` que usa `calcularKpi09` para su distribución.
- `hallazgosPorEstado`: mismo filtro de origen, reducido a `Record<QEStatus, number>` inicializado en `0` para los 9 estados (no un objeto disperso).
- `evidenciasHallazgos`: mismo filtro de origen, `conEvidencia` cuenta QE con `documentosVinculados.length > 0`, `sinEvidencia` el resto.
- `tasaCierreEnPlazoPorArea`: sobre **todos** los QE (sin filtro de origen), reutilizando `qeCerradosEnPeriodo(qes, start, end)` del período actual (`currentPeriodo()`/`monthRange()`) y `PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]` (misma tabla y función que `calcularKpi01`), agrupado por `areaAfectada` en vez de calculado globalmente. Áreas sin ningún QE en `qeCerradosEnPeriodo` para el período quedan excluidas del arreglo. Orden ascendente por `tasaCierreEnPlazo`.

#### Scenario: hallazgosPorArea y hallazgosPorEstado excluyen orígenes distintos de O3
- **WHEN** el store tiene QE con los 4 orígenes posibles
- **THEN** `hallazgosPorArea` y `hallazgosPorEstado` solo cuentan los QE con `origen === 'O3_HALLAZGO_AUDITORIA'`

#### Scenario: hallazgosPorEstado no tiene claves ausentes
- **WHEN** ningún QE `origen O3` está en estado `ABIERTO`
- **THEN** `hallazgosPorEstado.ABIERTO === 0`, no `undefined`

#### Scenario: evidenciasHallazgos usa documentosVinculados, no evidenciaUrl de las ACs
- **WHEN** un QE `origen O3` tiene `documentosVinculados: []` pero una de sus `accionesCorrectivas` tiene `evidenciaUrl` definido
- **THEN** ese QE se cuenta en `sinEvidencia`

#### Scenario: tasaCierreEnPlazoPorArea reutiliza qeCerradosEnPeriodo y PLAZO_MAXIMO_QE_DIAS_HABILES
- **WHEN** se calcula `tasaCierreEnPlazoPorArea` para un área con QE cerrados en el período
- **THEN** el subconjunto "en plazo" de esa área es idéntico al que produciría `calcularKpi01` filtrando manualmente ese mismo conjunto de QE por `areaAfectada` — misma fórmula, mismo agrupador aplicado después

#### Scenario: tasaCierreEnPlazoPorArea no filtra por origen
- **WHEN** el store tiene QE `origen O3` y de otros orígenes cerrados en el período, en distintas áreas
- **THEN** todos se consideran en `tasaCierreEnPlazoPorArea`, sin distinción de `origen`

#### Scenario: Áreas sin QE cerrados en el período quedan excluidas, no en 0/0
- **WHEN** un área no tiene ningún QE en `qeCerradosEnPeriodo` para el período actual
- **THEN** esa área no aparece en `tasaCierreEnPlazoPorArea`

#### Scenario: Orden ascendente por tasa de cierre en plazo
- **WHEN** `tasaCierreEnPlazoPorArea` tiene áreas con tasas `100`, `50` y `75`
- **THEN** el arreglo resultante está ordenado `50`, `75`, `100`
