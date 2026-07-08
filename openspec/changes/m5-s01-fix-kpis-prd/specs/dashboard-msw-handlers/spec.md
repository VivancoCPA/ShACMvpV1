## MODIFIED Requirements

### Requirement: GET /api/dashboard/kpis calcula los 9 KPIs sobre datos en vivo
El handler SHALL registrar `GET /api/dashboard/kpis`, aceptando un query param opcional `periodo` (`'YYYY-MM'`, default el mes actual del sistema). SHALL calcular cada uno de los 9 `KpiResult` de `KPI_DEFINITIONS` usando `getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()`, `getIncidentsStore()`, `horasTrabajadasFixtures` y `kpi04AnioAnteriorFixtures`, según las fórmulas de SHAC-PRD-003 §5.2 (ver `design.md` de este change), con `contarDiasHabiles` (no diferencia de milisegundos) para todo KPI en días. Para los 7 KPIs con `metaTipo: 'ABSOLUTO'` y `unidad` distinta de `CONTEO` con banda propia, SHALL asignar `semaforo: 'VERDE'` cuando el valor cumple la `meta`, `'AMARILLO'` cuando está dentro del 20% de desviación de la meta, y `'ROJO'` en cualquier otro caso. La respuesta SHALL ser un `ApiResponse<KpiResult[]>` con exactamente 9 elementos, uno por `KpiId`.

#### Scenario: Respuesta contiene los 9 KpiResult
- **WHEN** `GET /api/dashboard/kpis` es solicitado sin `periodo`
- **THEN** `data.data.length === 9` y cada `kpiId` de `KPI_DEFINITIONS` aparece exactamente una vez

#### Scenario: KPI-02 usa días hábiles, no calendario
- **WHEN** `GET /api/dashboard/kpis?periodo=2026-03` es solicitado y existe un QE cerrado en marzo 2026 cuyo `fechaCierre - fechaHoraReporte` cruza un fin de semana
- **THEN** el `valor` de `KPI-02` se calcula con `contarDiasHabiles`, excluyendo sábados y domingos del conteo

#### Scenario: Semáforo ROJO cuando el valor está lejos de la meta
- **WHEN** el valor calculado de un KPI con `metaTipo: 'ABSOLUTO'`, `unidad: 'PORCENTAJE'` y `meta: 90` es `50`
- **THEN** `semaforo === 'ROJO'` en el `KpiResult` correspondiente

#### Scenario: Sin datos en el periodo retorna KpiResult con valor 0, no un error
- **WHEN** `GET /api/dashboard/kpis?periodo=2020-01` es solicitado para un periodo sin fixtures de ningún dominio
- **THEN** la respuesta es 200 con los 9 `KpiResult`, cada uno con `valor: 0` (excepto `KPI-08`, que ignora `periodo` — ver requisito de KPI-08)

---

## ADDED Requirements

### Requirement: KPI-01 usa un plazo máximo por severidad (SHAC-PRD-003 §1.3), no una constante plana
`calcularKpi01` SHALL comparar `fechaCierre − fechaHoraReporte` (en días hábiles, vía `contarDiasHabiles`) contra `PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]`, no un valor fijo de 15 días para todas las severidades. `PLAZO_MAXIMO_QE_DIAS_HABILES` SHALL definir las 4 severidades con los valores `BAJA: 22`, `MEDIA: 17`, `ALTA: 14`, `CRITICA: 10`, derivados de sumar los plazos de `EN_INVESTIGACION` (por severidad), `ANALISIS_COMPLETADO` (2 días hábiles, fijo) y `PENDIENTE_CIERRE` (5 días hábiles, fijo) de SHAC-PRD-003 §1.3; `EN_EJECUCION` SHALL excluirse de la suma.

#### Scenario: QE BAJA cierra dentro de 22 días hábiles cuenta como "en plazo"
- **WHEN** un QE con `severidad: 'BAJA'` tiene `fechaCierre − fechaHoraReporte` de 20 días hábiles
- **THEN** ese QE cuenta en el numerador de `KPI-01` (en plazo)

#### Scenario: QE CRITICA con el mismo tiempo transcurrido que uno BAJA puede quedar fuera de plazo
- **WHEN** dos QE (uno `severidad: 'BAJA'`, otro `severidad: 'CRITICA'`) tienen ambos 12 días hábiles entre `fechaHoraReporte` y `fechaCierre`
- **THEN** el QE `BAJA` cuenta como en plazo (`12 <= 22`) y el QE `CRITICA` no (`12 > 10`)

#### Scenario: El cutoff de KPI-01 no depende de la meta de KPI-02
- **WHEN** se inspecciona `calcularKpi01`
- **THEN** no referencia `KPI_DEFINITIONS['KPI-02'].meta` ni ningún otro valor de otro KPI para determinar "en plazo"

---

### Requirement: KPI-07 usa el timestamp de auditTrail de la transición a ANALISIS_COMPLETADO
`calcularKpi07` SHALL derivar `fechaAnalisisCompletado` de la entrada de `qe.auditTrail` con `accion === 'ESTADO_CAMBIADO'` y `estadoNuevo === 'ANALISIS_COMPLETADO'` (la más reciente, si existe más de una por reapertura), no de `qe.causaRaizFirmadaEn`. Un QE sin ninguna entrada de ese tipo SHALL excluirse del cálculo (no contar como `0` días).

#### Scenario: KPI-07 usa el timestamp de auditTrail, no causaRaizFirmadaEn
- **WHEN** un QE tiene una entrada de `auditTrail` con `estadoNuevo: 'ANALISIS_COMPLETADO'` en una fecha distinta a `causaRaizFirmadaEn`
- **THEN** `calcularKpi07` usa el `timestamp` de esa entrada de `auditTrail`, no `causaRaizFirmadaEn`

#### Scenario: QE reabierto usa la entrada más reciente de ANALISIS_COMPLETADO
- **WHEN** un QE tiene dos entradas de `auditTrail` con `estadoNuevo: 'ANALISIS_COMPLETADO'` (una por cada ciclo, tras una reapertura)
- **THEN** `calcularKpi07` usa el `timestamp` de la entrada más reciente

#### Scenario: QE sin transición a ANALISIS_COMPLETADO se excluye del cálculo
- **WHEN** un QE aún no tiene ninguna entrada de `auditTrail` con `estadoNuevo: 'ANALISIS_COMPLETADO'`
- **THEN** ese QE no se incluye en el promedio de `KPI-07` (ni en el numerador ni como un `0` en el denominador)

---

### Requirement: KPI-04 calcula reducción interanual, no un umbral absoluto
`calcularKpi04` SHALL mantener la fórmula de M5-S01 (incidentes con `huboLesionados=true` × 1,000,000 / horas trabajadas del período), pero el `KpiResult` resultante SHALL tener `metaTipo: 'REDUCCION_INTERANUAL'` y SHALL incluir `valorPeriodoAnterior`, obtenido de `kpi04AnioAnteriorFixtures` para el `periodo` solicitado. El semáforo SHALL calcularse como: `VERDE` si `(valorPeriodoAnterior - valor) / valorPeriodoAnterior * 100 >= meta` (10); `AMARILLO` si esa reducción está entre `0` y `meta` (mejora insuficiente); `ROJO` si el valor empeoró respecto al año anterior o si no existe `valorPeriodoAnterior` para ese período.

#### Scenario: Reducción interanual suficiente da VERDE
- **WHEN** `valorPeriodoAnterior` es `10` y el `valor` calculado del período actual es `8` (20% de reducción, meta 10%)
- **THEN** `semaforo === 'VERDE'`

#### Scenario: Reducción insuficiente da AMARILLO
- **WHEN** `valorPeriodoAnterior` es `10` y el `valor` calculado es `9.5` (5% de reducción, meta 10%)
- **THEN** `semaforo === 'AMARILLO'`

#### Scenario: Empeoramiento interanual da ROJO
- **WHEN** `valorPeriodoAnterior` es `10` y el `valor` calculado es `12`
- **THEN** `semaforo === 'ROJO'`

#### Scenario: Sin dato del año anterior, ROJO en vez de un falso VERDE
- **WHEN** `kpi04AnioAnteriorFixtures` no tiene entrada para el `periodo` solicitado
- **THEN** `valorPeriodoAnterior` es `undefined` y `semaforo === 'ROJO'` (nunca `VERDE` sin datos para justificarlo)

---

### Requirement: KPI-08 usa un semáforo de banda y no filtra por período
`calcularKpi08` SHALL contar, sin filtro de `periodo` (tiempo real), las ACs de `collectAllACs(getQeStore(), getNonconformitiesStore(), getIncidentsStore())` cuyo `estado` no sea `'CERRADA'` ni `'COMPLETADA'` y cuyo `plazoFecha` sea anterior a la fecha actual del sistema. El `KpiResult` de `KPI-08` SHALL tener `periodo: 'TIEMPO_REAL'` (no una cadena `'YYYY-MM'`) y su semáforo SHALL calcularse con una banda propia, no la regla genérica de ±20% de desviación: `valor === 0 → VERDE`, `1 <= valor <= 3 → AMARILLO`, `valor > 3 → ROJO`.

#### Scenario: Cero ACs vencidas da VERDE
- **WHEN** no existe ninguna AC con `plazoFecha` anterior a hoy en estado no terminal
- **THEN** el `KpiResult` de `KPI-08` tiene `valor: 0` y `semaforo === 'VERDE'`

#### Scenario: Banda aceptable da AMARILLO, no ROJO
- **WHEN** existen exactamente 3 ACs vencidas en estado no terminal
- **THEN** `semaforo === 'AMARILLO'` (no `'ROJO'`, a diferencia de lo que la regla genérica de ±20% de desviación produciría)

#### Scenario: Más de 3 ACs vencidas da ROJO
- **WHEN** existen 4 o más ACs vencidas en estado no terminal
- **THEN** `semaforo === 'ROJO'`

#### Scenario: KPI-08 ignora el query param periodo
- **WHEN** `GET /api/dashboard/kpis?periodo=2020-01` es solicitado
- **THEN** el `KpiResult` de `KPI-08` refleja el conteo actual en tiempo real, no `0` por falta de datos en `2020-01`

---

### Requirement: KPI-09 retorna una distribución por área, no un valor escalar único
`calcularKpi09` SHALL contar QE por `areaAfectada` cuyo `fechaHoraReporte` cae en el `periodo` solicitado, agrupando y ordenando de mayor a menor. El `KpiResult` de `KPI-09` SHALL tener `semaforo: 'INFORMATIVO'`, `distribucion` con una entrada `{ area, valor }` por cada área con al menos 1 QE en el período (áreas con `0` QE no aparecen), y `valor` igual al conteo del área con más QE (la primera entrada de `distribucion`).

#### Scenario: Distribución ordenada de mayor a menor
- **WHEN** en el período hay 5 QE en `'Almacén Norte'`, 2 en `'Calidad'` y 1 en `'Laboratorio de Calidad'`
- **THEN** `distribucion` es `[{ area: 'Almacén Norte', valor: 5 }, { area: 'Calidad', valor: 2 }, { area: 'Laboratorio de Calidad', valor: 1 }]` y `valor` (top-level) es `5`

#### Scenario: Áreas sin QE en el período no aparecen en distribucion
- **WHEN** una de las 19 áreas de `AREAS_SHAC` no tiene ningún QE con `fechaHoraReporte` en el período
- **THEN** esa área no tiene entrada en `distribucion`

#### Scenario: Sin QE en el período retorna distribucion vacía, no un error
- **WHEN** no existe ningún QE con `fechaHoraReporte` en el `periodo` solicitado
- **THEN** el `KpiResult` de `KPI-09` tiene `distribucion: []` y `valor: 0`

---

### Requirement: KPI-05 escopa la verificación a ACs de origen QE/NC
`calcularKpi05` SHALL considerar únicamente ACs de origen `'QE'` o `'NC'` (vía `collectACsWithOrigin`, excluyendo `'INCIDENTE'`) con `estado === 'CERRADA'`. Una AC SHALL contarse como parte del denominador ("ACs totales verificadas") únicamente si su entidad padre (`QualityEvent` o `NoConformidad`) tiene `resultadoVerificacion` definido (`'EFECTIVO'` o `'NO_EFECTIVO'`), y como parte del numerador ("ACs con verificación Efectiva") únicamente si ese valor es `'EFECTIVO'`.

#### Scenario: AC de Incidente no cuenta ni en numerador ni denominador
- **WHEN** existe una AC cerrada cuyo origen es un `Incidente`
- **THEN** esa AC no se incluye en el cálculo de `KPI-05` (`Incidente` no tiene `resultadoVerificacion`)

#### Scenario: AC de QE sin resultadoVerificacion no cuenta como verificada
- **WHEN** existe una AC cerrada de un QE cuyo `resultadoVerificacion` es `undefined`
- **THEN** esa AC no se incluye en el denominador de `KPI-05`

#### Scenario: AC de NC con resultadoVerificacion EFECTIVO cuenta en numerador y denominador
- **WHEN** existe una AC cerrada de una `NoConformidad` con `resultadoVerificacion: 'EFECTIVO'`
- **THEN** esa AC se cuenta tanto en el numerador como en el denominador de `KPI-05`
