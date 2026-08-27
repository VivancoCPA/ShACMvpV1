## MODIFIED Requirements

### Requirement: Al menos 2 QE de origen O3 tienen documentosVinculados no vacío, al menos 2 no tienen ninguno
De los QE fixture con `origen === 'O3_HALLAZGO_AUDITORIA'`, al menos 2 SHALL tener `documentosVinculados` con al menos 1 elemento (objeto `DocumentoVinculadoResumen`, `{ id, codigo, titulo, estado }`, reutilizando documentos ya existentes en `documents.fixtures.ts` — reemplaza la forma previa de `string[]` de ids crudos), y al menos 2 SHALL mantener `documentosVinculados: []`, de modo que el widget de evidencias disponibles (`dashboard-auditor-view`) tenga un caso positivo y uno negativo verificables.

#### Scenario: Al menos 2 hallazgos O3 con evidencia
- **WHEN** se filtran los QE fixture por `origen === 'O3_HALLAZGO_AUDITORIA'` y `documentosVinculados.length > 0`
- **THEN** el resultado tiene al menos 2 elementos

#### Scenario: Al menos 2 hallazgos O3 sin evidencia
- **WHEN** se filtran los QE fixture por `origen === 'O3_HALLAZGO_AUDITORIA'` y `documentosVinculados.length === 0`
- **THEN** el resultado tiene al menos 2 elementos

#### Scenario: Los documentos referenciados existen en documents.fixtures.ts y son bidireccionalmente consistentes
- **WHEN** un QE `origen O3` tiene `documentosVinculados` no vacío
- **THEN** cada entrada corresponde a un documento existente en `documents.fixtures.ts`, no un id inventado, y ese documento fixture tiene a su vez este QE en su propio `qeVinculados`

#### Scenario: documentosVinculados entries are typed objects, not strings
- **WHEN** a developer reads `qualityEventFixtures[i].documentosVinculados[0]`
- **THEN** TypeScript infers a `DocumentoVinculadoResumen` object, not a bare `string`
