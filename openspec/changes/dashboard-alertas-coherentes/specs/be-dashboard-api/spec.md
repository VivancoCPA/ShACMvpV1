## MODIFIED Requirements

### Requirement: KPI-08 — Acciones correctivas vencidas activas
El sistema SHALL calcular KPI-08 en tiempo real, sin filtrar por `periodo` y respondiendo `periodo: "TIEMPO_REAL"`, como el conteo de acciones correctivas de QE, NC e Incidentes que cumplen `DashboardKpiCalculator.EsAcVencida(estado, plazoFecha, ahora)`: `estado` no terminal (ni `CERRADA` ni `COMPLETADA`) y `plazoFecha < ahora`. Ese helper SHALL ser la única definición de "AC vencida" del dashboard: lo usan KPI-08, `JefeCalidadDashboardData.AccionesCorrectivasVencidas` y `SupervisorDashboardData.AccionesCorrectivasVencidas`. El semáforo SHALL ser `VERDE` si el conteo es 0, `AMARILLO` si está entre 1 y 3, y `ROJO` si es mayor a 3, en lugar del semáforo genérico de desviación ±20 %.

#### Scenario: Sin acciones vencidas
- **WHEN** ninguna acción correctiva de la empresa está vencida
- **THEN** KPI-08 responde `valor: 0` y `semaforo: 'VERDE'`

#### Scenario: Más de 3 acciones vencidas
- **WHEN** hay 4 o más acciones correctivas vencidas activas
- **THEN** KPI-08 responde `semaforo: 'ROJO'`

#### Scenario: EsAcVencida
- **WHEN** se evalúa `EsAcVencida` para una AC `EN_EJECUCION` con plazo de ayer, una `COMPLETADA` con plazo de ayer y una `PENDIENTE` con plazo de mañana
- **THEN** solo la primera es vencida

### Requirement: Resumen JEFE_CALIDAD
Para el rol `JEFE_CALIDAD_SYST` (mapeado a `rol: 'JEFE_CALIDAD'` en la respuesta), el sistema SHALL responder con alcance organizacional completo (toda la empresa activa, sin filtro de área): `{ kpis, qeCriticosAbiertos, ncPendientesVerificacion, distribucionQEPorTipo, qePorEstado, accionesCorrectivasPorVencer, accionesCorrectivasVencidas, tendenciaMensualVolumen, tendenciaMensualKpis, incidentesSinQeVencidos, incidentesSinQeVencidosTotal }`.
- `qePorEstado` SHALL inicializar en 0 los 8 estados persistibles de QE, aunque no haya datos.
- `tendenciaMensualVolumen` SHALL cubrir los últimos 12 meses (`abiertos` y `cerrados` por mes).
- `tendenciaMensualKpis` SHALL cubrir los últimos 12 meses (ver "Tendencia mensual de KPIs en los resúmenes JEFE_CALIDAD y ALTA_DIRECCION").
- `accionesCorrectivasVencidas` SHALL listar, como `AccionCorrectivaResumen`, **todas** las AC de QE, NC e Incidentes de la empresa que cumplen `EsAcVencida`, sin límite, de la más vencida a la menos (`plazoFecha` ascendente). Para el mismo set de datos y el mismo instante, su `Count` SHALL ser igual al valor de KPI-08. El `ResponsableNombre` de las AC de incidente SHALL resolverse con los nombres de usuario, igual que en Operario y Supervisor.
- `incidentesSinQeVencidos` SHALL listar, como `IncidenteResumen`, como máximo 10 incidentes activos sin QE que superaron su plazo para vincular un QE (RN-INC-006, con los mismos plazos que el escáner de vencimientos), del más vencido al menos.
- `incidentesSinQeVencidosTotal` SHALL contar todos esos incidentes, sin el límite de 10.

#### Scenario: Estado sin QE
- **WHEN** ningún QE de la empresa está en `estado: EN_VERIFICACION`
- **THEN** `qePorEstado.EN_VERIFICACION` responde `0`, no una clave ausente

#### Scenario: Incidentes sin QE vencidos ordenados y limitados
- **WHEN** la empresa tiene 12 incidentes activos sin QE con el plazo vencido y 1 en preaviso
- **THEN** `incidentesSinQeVencidos` tiene 10 elementos, el primero es el que lleva más tiempo vencido, y `incidentesSinQeVencidosTotal` es 12

#### Scenario: Incidentes de otra empresa o con QE no cuentan
- **WHEN** un incidente vencido pertenece a otra empresa o ya tiene `qeId`
- **THEN** no aparece en `incidentesSinQeVencidos`

#### Scenario: AC vencidas coinciden con KPI-08
- **WHEN** la empresa tiene AC vencidas en QE, NC e Incidentes, además de una AC `CERRADA` vencida, y otra empresa tiene AC vencidas
- **THEN** `accionesCorrectivasVencidas` incluye las AC vencidas de los tres orígenes de la empresa, excluye la `CERRADA` y las de la otra empresa, y su `Count` es igual al `valor` de KPI-08 calculado sobre los mismos datos
