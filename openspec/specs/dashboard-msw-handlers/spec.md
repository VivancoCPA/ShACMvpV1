# Spec: dashboard-msw-handlers

## Purpose

Define the MSW v2 handlers that serve Dashboard data (`GET /api/dashboard/kpis`, `GET /api/dashboard/summary`), aggregating in-memory reads over the live mutable stores of the other domain modules (Quality Events, Documentos, No Conformidades, Incidentes), and the store-getter contract those modules must expose to support that aggregation.

---

## Requirements

### Requirement: Getters de store en vivo expuestos por cada módulo de dominio
`quality-events.handlers.ts` SHALL exportar `getQeStore(): QualityEvent[]`, `documents.handlers.ts` SHALL exportar `getDocumentsStore(): Documento[]`, y `nonconformities.handlers.ts` SHALL exportar `getNonconformitiesStore(): NoConformidad[]`, cada uno retornando el array mutable `let` privado ya usado internamente por los handlers de ese módulo — replicando el patrón ya existente de `getIncidentsStore(): Incidente[]` en `incidents.handlers.ts`. Ningún handler existente de esos tres módulos SHALL cambiar de comportamiento por este cambio.

#### Scenario: getQeStore refleja mutaciones de otros handlers de QE
- **WHEN** un `PATCH /api/quality-events/:id/cerrar` exitoso muta el QE en el store interno de `quality-events.handlers.ts`
- **THEN** una llamada posterior a `getQeStore()` retorna el array con ese QE ya actualizado

#### Scenario: getDocumentsStore y getNonconformitiesStore existen y son funciones puras de lectura
- **WHEN** se importan `getDocumentsStore` y `getNonconformitiesStore`
- **THEN** ambas son funciones sin argumentos que retornan el array mutable interno, sin clonarlo ni filtrarlo

---

### Requirement: MSW v2 syntax exclusively en dashboard.handlers.ts
`src/mocks/handlers/dashboard.handlers.ts` SHALL usar únicamente `http.*` de `msw` (no `rest.*`), con `await delay(400)` al inicio de cada handler.

#### Scenario: Import verification
- **WHEN** se importa `dashboard.handlers.ts`
- **THEN** solo se importan `http`, `HttpResponse` y `delay` desde `msw` (más los getters de store de los otros módulos y `horasTrabajadasFixtures`)

---

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

---

### Requirement: GET /api/dashboard/summary retorna datos filtrados por rol
El handler SHALL registrar `GET /api/dashboard/summary`, resolviendo el usuario autenticado mediante el mismo mecanismo mock-auth usado por otros handlers (header `Authorization`), y determinando el tipo de respuesta con `getDashboardDataTypeForRole(usuario.rol)`. Cuando `usuario.rol === 'OPERARIO'`, SHALL filtrar `misIncidentesReportados`/`misQEReportados` a `reportadoPorId === usuario.id` y `documentosPendientesLectura` a `Documento.area === usuario.area`. Cuando `usuario.rol === 'SUPERVISOR'`, SHALL filtrar todos los datos agregados a QE/Incidentes/NC cuya área esté en `usuario.areasAsignadas`, calculando además: `qeAbiertosPorTipo` (conteo por `QEType` de los QE del área con `estado` distinto de `CERRADO`/`VERIFICADO`), `qesEnVerificacionArea` (QE del área con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` definido, proyectados a `QEResumen`), `accionesCorrectivasPendientesArea` (ACs del área con `estado` distinto de `CERRADA`, proyectadas a `AccionCorrectivaResumen`, sin exigir vencimiento), y `accionesCorrectivasVencidas` (ACs del área con `estado === 'EN_EJECUCION'` y `plazoFecha` anterior a la fecha actual del sistema — antes de este cambio el filtro aceptaba cualquier estado distinto de `CERRADA`). Los roles `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION` y `AUDITOR_INTERNO` SHALL recibir datos sin filtrar por área (alcance organizacional completo). Cuando `usuario.rol === 'JEFE_CONTROL_DOCUMENTARIO'`, la respuesta SHALL tener `rol: 'JEFE_CONTROL_DOC'` y `data: {}` (vía `buildJefeControlDocumentarioData()`) — ya no comparte la forma de `JefeCalidadDashboardData` ni pasa por `buildJefeCalidadData`. Sin token válido, SHALL retornar 401 con `success: false`. La proyección `toQEResumen` usada para construir cada elemento de `misQEReportados` SHALL incluir `fechaVerificacionProgramada` cuando el `QualityEvent` de origen lo tenga definido.

#### Scenario: OPERARIO recibe solo sus propios reportes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como un usuario `OPERARIO` con `id: 'user-op-1'`
- **THEN** la respuesta tiene `rol: 'OPERARIO'` y todo elemento de `data.misQEReportados` corresponde a un QE cuyo `reportadoPorId === 'user-op-1'`

#### Scenario: SUPERVISOR recibe datos limitados a areasAsignadas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte']`
- **THEN** `data.incidentesRecientes` solo contiene incidentes cuya área (resuelta vía `Local`/`Zona`) o `qePorEstado` solo cuenta QE cuya `areaAfectada === 'Almacén Norte'`

#### Scenario: SUPERVISOR con múltiples áreas ve datos combinados de todas
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `SUPERVISOR` con `areasAsignadas: ['Almacén Norte', 'Almacén Sur']`
- **THEN** `data.qeAbiertosPorTipo`, `data.qesEnVerificacionArea` y `data.accionesCorrectivasPendientesArea` incluyen elementos de ambas áreas, y ningún elemento de un área fuera de `areasAsignadas` aparece en la respuesta

#### Scenario: accionesCorrectivasVencidas excluye ACs en estado PENDIENTE
- **WHEN** un `SUPERVISOR` tiene en su área una AC con `estado: 'PENDIENTE'` y `plazoFecha` vencida, y otra con `estado: 'EN_EJECUCION'` también vencida
- **THEN** `data.accionesCorrectivasVencidas` solo contiene la AC en `EN_EJECUCION`; la AC `PENDIENTE` vencida solo aparece en `data.accionesCorrectivasPendientesArea`

#### Scenario: qeAbiertosPorTipo excluye QE cerrados o verificados
- **WHEN** un `SUPERVISOR` tiene en su área un QE de tipo `CALIDAD` con `estado: 'VERIFICADO'`
- **THEN** ese QE no incrementa el conteo de `data.qeAbiertosPorTipo.CALIDAD`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO recibe su propia forma de datos
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** la respuesta tiene `rol: 'JEFE_CONTROL_DOC'` y `data` es un objeto vacío (`{}`) — no la forma de `JefeCalidadDashboardData`

#### Scenario: JEFE_CALIDAD_SYST sigue recibiendo JefeCalidadDashboardData sin la rama especial de Control Documentario
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** la respuesta tiene `rol: 'JEFE_CALIDAD'` y `data.qeCriticosAbiertos` refleja todos los QE críticos abiertos organizacionales (sin el vaciado condicional que antes aplicaba cuando el usuario era `JEFE_CONTROL_DOCUMENTARIO`)

#### Scenario: ALTA_DIRECCION recibe datos organizacionales sin filtro de área
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `ALTA_DIRECCION`
- **THEN** `data.resumenPorModulo` refleja el conteo total de todos los dominios, sin restricción de área

#### Scenario: Sin token retorna 401
- **WHEN** `GET /api/dashboard/summary` es solicitado sin header `Authorization`
- **THEN** la respuesta status es 401 y `success: false`

#### Scenario: misQEReportados incluye fechaVerificacionProgramada cuando el QE la tiene
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `OPERARIO` y uno de sus QEs reportados tiene `estado: 'EN_VERIFICACION'` con `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** el elemento correspondiente en `data.misQEReportados` incluye `fechaVerificacionProgramada: '2026-07-10'`

---

### Requirement: GET /api/dashboard/summary calcula tendencia mensual de 12 meses para JEFE_CALIDAD
Cuando `usuario.rol` resuelve a `'JEFE_CALIDAD'` (`JEFE_CALIDAD_SYST`), `buildJefeCalidadData` SHALL calcular `tendenciaMensualVolumen` iterando los últimos 12 meses (`ultimosMeses(12)`), contando por mes los QE cuyo `fechaHoraReporte` cae en ese mes (`abiertos`, sin filtrar por `estado`) y los QE cuyo `fechaCierre` cae en ese mes (`cerrados`, sin filtrar por `estado` — mismo criterio exacto que ya usaba `buildTendenciaMensualCierres`, distinto del filtro `CERRADO`/`VERIFICADO` que sí exige KPI-01/02). SHALL además calcular `tendenciaMensualKpis` invocando `calcularKpi01`, `calcularKpi04` y `calcularKpi05` una vez por cada uno de los mismos 12 meses, sin recalcular semáforo por punto. Este cálculo SHALL tener alcance organizacional completo (sin filtro por `usuario.id` ni `usuario.area`), igual que el resto de `JefeCalidadDashboardData`. `JEFE_CONTROL_DOCUMENTARIO` resuelve a `'JEFE_CONTROL_DOC'` (`buildJefeControlDocumentarioData`, `data: {}`) y por lo tanto NO recibe `tendenciaMensualVolumen` ni `tendenciaMensualKpis` — ver requisito "GET /api/dashboard/summary retorna datos filtrados por rol".

#### Scenario: tendenciaMensualVolumen cuenta QE por fechaHoraReporte y fechaCierre
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** `data.tendenciaMensualVolumen` tiene 12 entradas y la entrada de un mes con QEs reportados en ese mes tiene `abiertos > 0`

#### Scenario: tendenciaMensualKpis reutiliza las funciones de cálculo existentes por mes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** `data.tendenciaMensualKpis['KPI-01'][i].valor` es igual al resultado de invocar la misma fórmula de KPI-01 con `periodo = data.tendenciaMensualKpis['KPI-01'][i].periodo`

#### Scenario: Alcance organizacional, sin filtro por usuario
- **WHEN** dos usuarios distintos con rol `JEFE_CALIDAD_SYST` solicitan `GET /api/dashboard/summary`
- **THEN** ambos reciben el mismo `tendenciaMensualVolumen` y `tendenciaMensualKpis`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO no recibe tendencia mensual
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** la respuesta tiene `rol: 'JEFE_CONTROL_DOC'` y `data: {}` — no incluye `tendenciaMensualVolumen` ni `tendenciaMensualKpis`

---

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

---

### Requirement: buildAltaDireccionData calcula QEs abiertos/vencidos, comparativa mensual, reaperturas y ACs con solicitud de ajuste de plazo pendiente
`buildAltaDireccionData()` SHALL calcular, sin duplicar lógica existente:
- `resumenPorModulo.qualityEvents.abiertos`: conteo de QE con `estado !== 'VERIFICADO'`.
- `resumenPorModulo.qualityEvents.vencidos`: subconjunto de los anteriores donde `contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date()) > PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]`, reutilizando la misma función y tabla de `kpi.constants.ts` que usa `calcularKpi01`.
- `comparativaMensual`: para cada uno de KPI-01/04/05, invoca `calcularKpi01`/`calcularKpi04`/`calcularKpi05` sobre los 2 períodos de `ultimosMeses(2)` y clasifica la tendencia con un umbral de 2 puntos (`Math.abs(actual - anterior) < 2` → `'ESTABLE'`).
- `reaperturas`: QE con `ciclo > 1`, proyectados a `QEReaperturaResumen` con `fechaReapertura` derivada de la entrada de `auditTrail` más reciente con `estadoNuevo === 'REABIERTO'` (fallback `actualizadoEn`), ordenados descendentemente por `fechaReapertura`.
- `acsConSolicitudAjustePlazo`: ACs de QEs con `severidad === 'ALTA' || severidad === 'CRITICA'` cuyo `solicitudAjustePlazo?.estado === 'PENDIENTE'`, proyectadas a `ACSolicitudAjustePlazoResumen`.

#### Scenario: vencidos es subconjunto de abiertos
- **WHEN** se calcula `resumenPorModulo.qualityEvents` para el store en vivo
- **THEN** todo QE contado en `vencidos` también está contado en `abiertos`

#### Scenario: comparativaMensual reutiliza calcularKpi01/04/05
- **WHEN** se calcula `comparativaMensual`
- **THEN** los valores `actual`/`anterior` de cada KPI son idénticos a invocar directamente `calcularKpi01`/`calcularKpi04`/`calcularKpi05` con los mismos 2 períodos de `ultimosMeses(2)`

#### Scenario: reaperturas ordenadas por fecha de reapertura descendente
- **WHEN** el store tiene al menos 2 QE con `ciclo > 1` y distintas `fechaReapertura`
- **THEN** `reaperturas[0].fechaReapertura >= reaperturas[1].fechaReapertura`

#### Scenario: acsConSolicitudAjustePlazo excluye severidad MEDIA/BAJA y estados no pendientes
- **WHEN** el store tiene ACs con `solicitudAjustePlazo.estado` en `'PENDIENTE'`, `'APROBADA'` y `'RECHAZADA'`, y QE de severidad `MEDIA`, `ALTA` y `CRITICA`
- **THEN** `acsConSolicitudAjustePlazo` solo incluye ACs con `solicitudAjustePlazo.estado === 'PENDIENTE'` cuyo QE padre es `ALTA` o `CRITICA`

---

### Requirement: Registrado en handlers/index.ts
`dashboardHandlers` SHALL importarse desde `dashboard.handlers.ts` y agregarse al array `handlers` en `src/mocks/handlers/index.ts` sin remover handlers de otros módulos.

#### Scenario: handlers/index.ts incluye dashboardHandlers
- **WHEN** se importa `handlers/index.ts`
- **THEN** el array `handlers` exportado contiene todos los handlers de `dashboardHandlers`
