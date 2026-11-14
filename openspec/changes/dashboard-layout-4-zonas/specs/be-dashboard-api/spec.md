## MODIFIED Requirements

### Requirement: Cálculo de KPIs en vivo
El sistema SHALL exponer `GET /api/dashboard/kpis`, calculando los 9 KPIs (KPI-01 a KPI-09) en vivo en cada request, scoped a la empresa activa de la sesión, con query opcional `periodo`, que acepta 3 formatos: `yyyy-MM` (mes), `yyyy-Qn` (trimestre, `n` de 1 a 4) o `yyyy` (año). Si se omite, el sistema SHALL usar el mes actual en hora de Lima (`America/Lima`). Un `periodo` con otro formato (o con mes fuera de 01–12, o trimestre fuera de 1–4) SHALL responder **400** con `errorCode: "PERIODO_INVALIDO"`. Los KPIs dependientes del período SHALL calcularse sobre el rango `[inicio, fin)` del período pedido: KPI-01, KPI-02, KPI-04, KPI-05, KPI-07 y KPI-09 sobre ese rango; KPI-03 sobre el trimestre que contiene el mes (si el período es un mes), el trimestre pedido o el año pedido; KPI-06 y KPI-08 no dependen del período. El sistema SHALL restringir el acceso a los 6 roles con acceso al dashboard (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`).

`ValorPeriodoAnterior` SHALL calcularse así:
- KPI-01, KPI-02, KPI-03, KPI-05 y KPI-07: el mismo cálculo sobre el período **equivalente anterior** (el mes, trimestre o año previo; para KPI-03 con período mes, el trimestre anterior al que lo contiene);
- KPI-04 (meta `REDUCCION_INTERANUAL`): el mismo período del **año anterior**. Para un mes, el valor cargado en `Kpi04ValorAnioAnterior`, como hasta ahora; para un trimestre o un año, calculado con los incidentes y las horas del mismo período del año anterior, o `null` si a ese período le faltan horas de algún mes;
- KPI-06, KPI-08 y KPI-09: `null`.

KPI-04 SHALL sumar `HorasTrabajadas` de todos los meses del período. Si a algún mes del período le falta su fila de horas, el resultado SHALL llevar `DatosIncompletos: true`, con el valor calculado con las horas disponibles. Para los demás KPI, `DatosIncompletos` es `null`.

#### Scenario: Cálculo con periodo por defecto
- **WHEN** un usuario con un rol con acceso al dashboard solicita `GET /api/dashboard/kpis` sin `periodo`
- **THEN** el sistema responde 200 con un arreglo de 9 `KpiResult`, calculados sobre el mes calendario actual en hora de Lima

#### Scenario: Cálculo con periodo mensual
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-11`
- **THEN** KPI-01 se calcula sobre los QE cerrados en `[2026-11-01, 2026-12-01)` y su `ValorPeriodoAnterior` sobre `[2026-10-01, 2026-11-01)`; KPI-03 usa `Periodo: "2026-Q4"`

#### Scenario: Cálculo con periodo trimestral
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-Q4`
- **THEN** KPI-01 se calcula sobre `[2026-10-01, 2027-01-01)` y su `ValorPeriodoAnterior` sobre `[2026-07-01, 2026-10-01)`

#### Scenario: Cálculo con periodo anual
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026`
- **THEN** KPI-01 se calcula sobre `[2026-01-01, 2027-01-01)` y su `ValorPeriodoAnterior` sobre `[2025-01-01, 2026-01-01)`

#### Scenario: Periodo inválido
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-13` (o `2026-Q5`, o `nov-2026`)
- **THEN** el sistema responde 400 con `errorCode: "PERIODO_INVALIDO"`

#### Scenario: KPI-04 trimestral con un mes sin horas
- **WHEN** se solicita `periodo=2026-Q4` y hay horas cargadas para 2026-10 y 2026-11, pero no para 2026-12
- **THEN** el KPI-04 responde con `DatosIncompletos: true` y el valor calculado con las horas de octubre y noviembre

#### Scenario: KPI-04 mensual con horas completas
- **WHEN** se solicita `periodo=2026-11` y hay horas cargadas para 2026-11
- **THEN** el KPI-04 no lleva `DatosIncompletos: true`

#### Scenario: Rol sin acceso al dashboard
- **WHEN** un usuario con rol `SUPERADMIN`, `ADMINISTRADOR_EMPRESA` o `ADMINISTRADOR_SISTEMA` solicita `GET /api/dashboard/kpis`
- **THEN** el sistema responde 403

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401

### Requirement: Resumen JEFE_CONTROL_DOC
Para rol `JEFE_CONTROL_DOCUMENTARIO` (mapeado a `rol: 'JEFE_CONTROL_DOC'`), el sistema SHALL responder `data: { documentosRevisionVencida, documentosRevisionProxima }`, calculados sobre los documentos no eliminados de la empresa activa con `estado: PUBLICADO`: `documentosRevisionVencida` cuenta los que tienen `fechaRevisionProxima` anterior a hoy, y `documentosRevisionProxima` los que tienen `fechaRevisionProxima` entre hoy y hoy + 30 días, ambos inclusive. Los documentos sin `fechaRevisionProxima` no cuentan en ninguno de los dos.

#### Scenario: Jefe de Control Documentario solicita el resumen
- **WHEN** un usuario `JEFE_CONTROL_DOCUMENTARIO` solicita `GET /api/dashboard/summary` y la empresa activa tiene 3 documentos `PUBLICADO`: uno con revisión vencida hace 2 días, otro con revisión en 10 días y otro con revisión en 90 días
- **THEN** el sistema responde 200 con `data: { documentosRevisionVencida: 1, documentosRevisionProxima: 1 }`

#### Scenario: Documentos no publicados no cuentan
- **WHEN** un documento en `BORRADOR` tiene `fechaRevisionProxima` vencida
- **THEN** no cuenta en `documentosRevisionVencida`

## ADDED Requirements

### Requirement: Tendencia mensual de KPIs en los resúmenes JEFE_CALIDAD y ALTA_DIRECCION
El resumen de `JEFE_CALIDAD` SHALL incluir en `tendenciaMensualKpis` las series de los últimos 12 meses de KPI-01, KPI-02, KPI-04, KPI-05 y KPI-07 (cada entrada `{ periodo: 'yyyy-MM', valor }`, del mes más antiguo al actual). El resumen de `ALTA_DIRECCION` SHALL incluir `tendenciaMensualKpis` con las series de KPI-01, KPI-04 y KPI-05, construidas igual.

#### Scenario: Series del Jefe de Calidad
- **WHEN** un `JEFE_CALIDAD_SYST` solicita el resumen
- **THEN** `tendenciaMensualKpis` tiene las claves `KPI-01`, `KPI-02`, `KPI-04`, `KPI-05` y `KPI-07`, cada una con 12 entradas

#### Scenario: Series de Alta Dirección
- **WHEN** un `ALTA_DIRECCION` solicita el resumen
- **THEN** `tendenciaMensualKpis` tiene las claves `KPI-01`, `KPI-04` y `KPI-05`, cada una con 12 entradas que terminan en el mes actual
