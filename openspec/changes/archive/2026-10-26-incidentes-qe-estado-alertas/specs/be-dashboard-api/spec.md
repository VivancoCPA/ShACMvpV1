## MODIFIED Requirements

### Requirement: Resumen JEFE_CALIDAD
Para el rol `JEFE_CALIDAD_SYST` (mapeado a `rol: 'JEFE_CALIDAD'` en la respuesta), el sistema SHALL responder con alcance organizacional completo (toda la empresa activa, sin filtro de área): `{ kpis, qeCriticosAbiertos, ncPendientesVerificacion, distribucionQEPorTipo, qePorEstado, accionesCorrectivasPorVencer, tendenciaMensualVolumen, tendenciaMensualKpis, incidentesSinQeVencidos, incidentesSinQeVencidosTotal }`.
- `qePorEstado` SHALL inicializar los 8 estados persistibles de QE en 0 aunque no haya datos.
- `tendenciaMensualVolumen` SHALL cubrir los últimos 12 meses (`abiertos`/`cerrados` por mes).
- `tendenciaMensualKpis` SHALL cubrir KPI-01/KPI-04/KPI-05 × 12 meses.
- `incidentesSinQeVencidos` SHALL listar, como `IncidenteResumen`, como máximo 10 incidentes activos sin QE que superaron su plazo para vincular un QE (RN-INC-006, mismos plazos que el escáner de vencimientos), ordenados del más vencido al menos.
- `incidentesSinQeVencidosTotal` SHALL contar todos esos incidentes, sin el límite de 10.

#### Scenario: Estado sin QE
- **WHEN** ningún QE de la empresa está en `estado: EN_VERIFICACION`
- **THEN** `qePorEstado.EN_VERIFICACION` responde `0`, no una clave ausente

#### Scenario: Incidentes sin QE vencidos ordenados y limitados
- **WHEN** la empresa tiene 12 incidentes activos sin QE con el plazo vencido y 1 en preaviso
- **THEN** `incidentesSinQeVencidos` tiene 10 elementos, el primero es el de mayor tiempo vencido, y `incidentesSinQeVencidosTotal` es 12

#### Scenario: Incidentes de otra empresa o con QE no cuentan
- **WHEN** un incidente vencido pertenece a otra empresa o ya tiene `qeId`
- **THEN** no aparece en `incidentesSinQeVencidos`
