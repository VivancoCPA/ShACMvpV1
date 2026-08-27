## MODIFIED Requirements

### Requirement: Resumen AUDITOR
Para rol `AUDITOR_INTERNO` (mapeado a `rol: 'AUDITOR'`), el sistema SHALL responder con alcance organizacional completo sobre Quality Events de `origen: O3_HALLAZGO_AUDITORIA`: `{ hallazgosPorNorma, hallazgosPorEstado, evidenciasHallazgos, tasaCierreEnPlazoPorArea }`. `hallazgosPorEstado` SHALL inicializar los 8 estados persistibles de QE en 0. `evidenciasHallazgos` SHALL computarse contra la tabla puente `DocumentoQualityEvent` (ver `documento-qe-vinculacion`): `conEvidencia` es el conteo de hallazgos O3 con al menos un documento vinculado; `sinEvidencia` es el resto. `tasaCierreEnPlazoPorArea` SHALL listar solo áreas con al menos un hallazgo cerrado en el mes actual, ordenadas ascendentemente por tasa de cierre en plazo.

#### Scenario: Sin hallazgos de auditoría
- **WHEN** la empresa no tiene ningún QE con `origen: O3_HALLAZGO_AUDITORIA`
- **THEN** todas las colecciones del resumen responden vacías o en cero, sin error

#### Scenario: evidenciasHallazgos cuenta los hallazgos con documento vinculado
- **WHEN** la empresa tiene 3 QEs `origen: O3_HALLAZGO_AUDITORIA`, de los cuales 2 tienen al menos un documento vinculado en `DocumentoQualityEvent` y 1 no tiene ninguno
- **THEN** `evidenciasHallazgos` responde `{ conEvidencia: 2, sinEvidencia: 1 }`

#### Scenario: evidenciasHallazgos ya no es un sentinel fijo
- **WHEN** todos los hallazgos O3 de la empresa tienen al menos un documento vinculado
- **THEN** `evidenciasHallazgos.sinEvidencia` es `0`, no el total de hallazgos
