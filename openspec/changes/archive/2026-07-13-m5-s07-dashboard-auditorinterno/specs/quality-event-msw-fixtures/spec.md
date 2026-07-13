## ADDED Requirements

### Requirement: Al menos 2 QE de origen O3 tienen documentosVinculados no vacío, al menos 2 no tienen ninguno
De los QE fixture con `origen === 'O3_HALLAZGO_AUDITORIA'`, al menos 2 SHALL tener `documentosVinculados` con al menos 1 elemento (reutilizando IDs de documento ya existentes en `documents.fixtures.ts`, sin crear documentos nuevos), y al menos 2 SHALL mantener `documentosVinculados: []`, de modo que el widget de evidencias disponibles (`m5-s07-dashboard-auditorinterno`) tenga un caso positivo y uno negativo verificables.

#### Scenario: Al menos 2 hallazgos O3 con evidencia
- **WHEN** se filtran los QE fixture por `origen === 'O3_HALLAZGO_AUDITORIA'` y `documentosVinculados.length > 0`
- **THEN** el resultado tiene al menos 2 elementos

#### Scenario: Al menos 2 hallazgos O3 sin evidencia
- **WHEN** se filtran los QE fixture por `origen === 'O3_HALLAZGO_AUDITORIA'` y `documentosVinculados.length === 0`
- **THEN** el resultado tiene al menos 2 elementos

#### Scenario: Los IDs de documento referenciados existen en documents.fixtures.ts
- **WHEN** un QE `origen O3` tiene `documentosVinculados` no vacío
- **THEN** cada ID referenciado corresponde a un documento existente en `documents.fixtures.ts`, no un ID inventado
