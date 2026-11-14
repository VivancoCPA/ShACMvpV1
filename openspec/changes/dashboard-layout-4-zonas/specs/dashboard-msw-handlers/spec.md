## ADDED Requirements

### Requirement: GET /api/dashboard/kpis acepta período mensual, trimestral o anual
El handler de `GET /api/dashboard/kpis` SHALL aceptar `periodo` en los mismos 3 formatos que el backend (`yyyy-MM`, `yyyy-Qn` o `yyyy`), calcular los KPIs sobre el rango del período con las mismas reglas (`be-dashboard-api`, "Cálculo de KPIs en vivo"), devolver `valorPeriodoAnterior` para KPI-01, KPI-02, KPI-03, KPI-05 y KPI-07 (período equivalente anterior) y para KPI-04 (mismo período del año anterior), y `datosIncompletos: true` en KPI-04 cuando a algún mes del período le faltan `horasTrabajadasFixtures`. Un formato inválido SHALL responder 400 con `errorCode: 'PERIODO_INVALIDO'`. Sin `periodo`, se usa el mes actual.

El handler de `GET /api/dashboard/summary` SHALL incluir: KPI-02 y KPI-07 en `tendenciaMensualKpis` de JEFE_CALIDAD; `tendenciaMensualKpis` (KPI-01, KPI-04 y KPI-05) en ALTA_DIRECCION; y `{ documentosRevisionVencida, documentosRevisionProxima }` en JEFE_CONTROL_DOC, calculados sobre los documentos `PUBLICADO` de la empresa activa.

#### Scenario: Período trimestral
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-Q4`
- **THEN** la respuesta es 200 con 9 `KpiResult`, y KPI-01 tiene `periodo: '2026-Q4'` y un `valorPeriodoAnterior` numérico

#### Scenario: Período inválido
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-Q9`
- **THEN** la respuesta es 400

#### Scenario: Summary de JCD con conteos
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` solicita `GET /api/dashboard/summary`
- **THEN** `data.data` tiene `documentosRevisionVencida` y `documentosRevisionProxima` numéricos
