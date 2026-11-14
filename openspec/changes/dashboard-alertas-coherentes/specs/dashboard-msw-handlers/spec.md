## ADDED Requirements

### Requirement: El summary del JCA en MSW trae las AC vencidas con el predicado de KPI-08
El handler de `GET /api/dashboard/summary` SHALL incluir `accionesCorrectivasVencidas` en el resumen de `JEFE_CALIDAD`: todas las AC de QE, NC e Incidentes de la empresa activa que cumplen el mismo predicado que `calcularKpi08` (una función `esAcVencida` compartida por ambos), ordenadas por `plazoFecha` ascendente. Los fixtures de QE SHALL incluir al menos un QE en `PENDIENTE_CIERRE` sin `resultadoCierre` y otro con `resultadoCierre` y sin `cerradoPorId`, para que el JCA vea `QE_REGISTRAR_CIERRE` y `QE_FIRMAR_CIERRE_JCA` en desarrollo.

#### Scenario: Lista y KPI-08 coinciden en MSW
- **WHEN** un `JEFE_CALIDAD_SYST` solicita `GET /api/dashboard/summary`
- **THEN** `data.data.accionesCorrectivasVencidas.length` es igual al `valor` de KPI-08 de `data.data.kpis`
